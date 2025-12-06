from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from dotenv import load_dotenv
from google.cloud import speech
from google.cloud import translate_v2 as translate
from google.cloud import texttospeech
from asgiref.sync import async_to_sync
from transformers import VitsModel, AutoTokenizer

import edge_tts
import asyncio
import os
import base64
import torch
import logging
import scipy.io.wavfile
import numpy as np
import io

# Init

load_dotenv()
logger = logging.getLogger(__name__)

try:
    speech_client = speech.SpeechClient()
    translate_client = translate.Client()
    tts_client = texttospeech.TextToSpeechClient()

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")

except Exception as e:
    logger.error(f"Failed to initialize Google Cloud clients: {e}")
    translate_client = None
    speech_client = None
    tts_client = None


# Homepage
def index(request):
    return render(request, "translator/index.html")


# Detect Language
def detect_language(text):
    if translate_client is None:
        logger.warning("Translate client is None, defaulting to 'en'")
        return "en"
    try:
        result = translate_client.detect_language(text)
        return result["language"]
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
    return "en"


@csrf_exempt
def translate_text(request):
    if request.method != "POST":
        return JsonResponse({"Error": "POST required"}, status=400)

    text_content = request.POST.get("text", "")
    target_lang = request.POST.get("target_lang", "en")
    audio = request.POST.get("with_audio", "false").lower() == "true"

    if not text_content:
        return JsonResponse({"Error": "Missing text content"}, status=400)
    
    if translate_client is None:
        return JsonResponse({"Error": "Translation service unavailable"}, status=503)

    # translate the text
    try:
        response = translate_client.translate(text_content, target_language=target_lang)
        translated_text = response["translatedText"]
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return JsonResponse(
                {"error": "Translation failed", "detail":str(e)}, status=400)

    # generating audio right after translation
    audio_b64 = None
    if audio:
        try:
            audio_b64 = generate_tts(translated_text, target_lang)
        except Exception as e:
            logger.error(f"TTS faileed: {e}")

    return JsonResponse({
            "original_text": text_content,
            "translated_text": translated_text,
            "audio_b64": audio_b64})

async def generate_edge_tts_async(text, voice, rate):
    """Async helper function to generate audio using edge-tts."""
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data

# Global cache for Oromo model
OROMO_MODEL = None
OROMO_TOKENIZER = None

def get_oromo_model():
    global OROMO_MODEL, OROMO_TOKENIZER
    if OROMO_MODEL is None:
        logger.info("Loading Oromo MMS model...")
        OROMO_MODEL = VitsModel.from_pretrained("facebook/mms-tts-orm")
        OROMO_TOKENIZER = AutoTokenizer.from_pretrained("facebook/mms-tts-orm")
    return OROMO_MODEL, OROMO_TOKENIZER

def generate_oromo_tts(text):
    """Generate Oromo audio using Meta MMS model."""
    try:
        model, tokenizer = get_oromo_model()
        inputs = tokenizer(text, return_tensors="pt")
        
        with torch.no_grad():
            output = model(**inputs).waveform
        
        waveform = output.numpy()[0]
        
        # Save to in-memory WAV
        buffer = io.BytesIO()
        scipy.io.wavfile.write(buffer, model.config.sampling_rate, waveform)
        audio_content = buffer.getvalue()
            
        return base64.b64encode(audio_content).decode("utf-8")
    except Exception as e:
        logger.error(f"Oromo TTS failed: {e}")
        return None


def generate_tts(text, language, gender="NEUTRAL", speed=1.0):
    """Helper function to generate TTS audio and return base64-encoded MP3."""
    
    # Handle Somali with Edge-TTS
    if language in ["so", "so-ET", "so-SO"]:
        voice = "so-SO-MuuseNeural" if gender == "MALE" else "so-SO-UbaxNeural"
        
        # Convert speed (float) to percentage string (e.g., "+50%", "-20%")
        rate_pct = int((float(speed) - 1.0) * 100)
        rate_str = f"{rate_pct:+d}%"
        
        try:
            logger.info(f"Generating Somali TTS with voice {voice} and rate {rate_str}")
            audio_content = async_to_sync(generate_edge_tts_async)(text, voice, rate_str)
            return base64.b64encode(audio_content).decode("utf-8")
        except Exception as e:
            logger.error(f"Edge-TTS failed: {e}")
            return None

    # Handle Oromo with Meta MMS
    if language in ["om", "om-ET"]:
        try:
            logger.info(f"Generating Oromo TTS for: {text}")
            return generate_oromo_tts(text)
        except Exception as e:
            logger.error(f"Oromo TTS failed: {e}")
            return None

    if tts_client is None:
        logger.error("Google TTS client is not initialized")
        return None

    synth_input = texttospeech.SynthesisInput(text=text)
    
    # Google voice codess
    lang_map = {
        "en": "en-US",
        "am": "am-ET",
        "so": "so-SO",
    }
    voice_lang = lang_map.get(language, "en-US")
    
    # Map gender string to enum
    gender_map = {
        "MALE": texttospeech.SsmlVoiceGender.MALE,
        "FEMALE": texttospeech.SsmlVoiceGender.FEMALE,
        "NEUTRAL": texttospeech.SsmlVoiceGender.NEUTRAL,
    }
    ssml_gender = gender_map.get(gender, texttospeech.SsmlVoiceGender.NEUTRAL)
    
    voice = texttospeech.VoiceSelectionParams(
        language_code=voice_lang,
        ssml_gender=ssml_gender,
    )
    
    audio_cfg = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=float(speed)
    )
    
    try:
        tts_response = tts_client.synthesize_speech(
            input=synth_input,
            voice=voice,
            audio_config=audio_cfg,
        )
        return base64.b64encode(tts_response.audio_content).decode("utf-8")
    except Exception as e:
        logger.error(f"Google TTS failed: {e}")
        return None


@csrf_exempt
def text_to_speech(request):
    """Standalone endpoint for text-to-speech conversion."""
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)
    
    text = request.POST.get("text", "")
    language = request.POST.get("language", "en")
    gender = request.POST.get("gender", "NEUTRAL")
    speed = request.POST.get("speed", 1.0)
    
    if not text:
        return JsonResponse({"error": "Missing text"}, status=400)
    
    try:
        audio_b64 = generate_tts(text, language, gender, speed)
        if audio_b64 is None:
             return JsonResponse({"error": "Failed to generate audio"}, status=500)
        return JsonResponse({"audio_b64": audio_b64})
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return JsonResponse(
            {"error": "Text-to-speech failed", "detail": str(e)}, status=500
        )


# ------------------------------
# Main STT → Translate → TTS API
# ------------------------------

@csrf_exempt
def upload_audio(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    b64 = request.POST.get("audio")
    target_lang = request.POST.get("target_lang", "en")
    source_hint = request.POST.get("source_hint", None)
    gender = request.POST.get("gender", "NEUTRAL")
    speed = request.POST.get("speed", 1.0)

    if not b64:
        return JsonResponse({"error": "Missing audio"}, status=400)
    
    if speech_client is None:
         return JsonResponse({"error": "Speech service unavailable"}, status=503)

    # Decode Base64 audio
    try:
        audio_bytes = base64.b64decode(
            b64.split(",", 1)[1] if "," in b64 else b64
        )
    except Exception:
        return JsonResponse({"error": "Invalid base64 audio"}, status=400)

    # ------------------------------
    # Speech-to-Text
    # ------------------------------

    audio = speech.RecognitionAudio(content=audio_bytes)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=48000,
        language_code=source_hint or "en-US",
        enable_automatic_punctuation=True,
    )

    try:
        stt_response = speech_client.recognize(config=config, audio=audio)
        logger.info(f"STT Response: {stt_response}")
        transcript = " ".join(
            [r.alternatives[0].transcript for r in stt_response.results]
        )
        logger.info(f"Transcript: '{transcript}'")
    except Exception as e:
        logger.error(f"STT Error: {e}")
        return JsonResponse(
            {"error": "Speech to text failed", "detail": str(e)}, status=500
        )

    # ------------------------------
    # Translation
    # ------------------------------

    if translate_client is None:
        return JsonResponse({"error": "Translation service unavailable"}, status=503)

    try:
        translated = translate_client.translate(
            transcript,
            target_language=target_lang
        )
        translated_text = translated["translatedText"]
    except Exception as e:
        return JsonResponse(
            {"error": "Translation failed", "detail": str(e)}, status=500
        )

    # ------------------------------
    # Text-to-Speech
    # ------------------------------

    try:
        audio_b64 = generate_tts(translated_text, target_lang, gender, speed)
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        audio_b64 = None

    return JsonResponse(
        {
            "transcript": transcript,
            "translated_text": translated_text,
            "audio_b64": audio_b64,
        }
    )

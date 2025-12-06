
import os
import django
from django.conf import settings
from django.test import RequestFactory
import json
import base64
import time

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'TenaTalk.settings')
django.setup()

from translator.views import text_to_speech

languages_to_test = [
    {"code": "en", "name": "English", "text": "Hello, this is a test."},
    {"code": "am", "name": "Amharic", "text": "ሰላም፣ ይህ የድምጽ ሙከራ ነው።"},
    {"code": "so", "name": "Somali", "text": "Waa salaaman tahay, kani waa tijaabo."},
    {"code": "om", "name": "Oromo", "text": "Akkam, kuni yaalii sagaleeti."} 
]

factory = RequestFactory()

print("--- Starting Multilingual TTS Verification ---")

failed_langs = []

for lang in languages_to_test:
    print(f"\nTesting {lang['name']} ({lang['code']})...")
    start_time = time.time()
    
    payload = {
        'text': lang['text'],
        'language': lang['code'],
        'gender': 'NEUTRAL',
        'speed': '1.0'
    }
    
    try:
        request = factory.post('/api/text_to_speech/', payload)
        response = text_to_speech(request)
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = json.loads(response.content)
            if 'audio_b64' in data and data['audio_b64']:
                b64 = data['audio_b64']
                size_kb = len(b64) / 1024
                print(f"✅ Success! Generated {size_kb:.2f} KB of audio in {duration:.2f}s")
            else:
                print(f"❌ Failed! No audio_b64 in response. data: {data}")
                failed_langs.append(lang['name'])
        else:
             print(f"❌ Failed! Status Code: {response.status_code}")
             print(f"Response: {response.content.decode('utf-8')}")
             failed_langs.append(lang['name'])
             
    except Exception as e:
        print(f"❌ Exception: {e}")
        failed_langs.append(lang['name'])

print("\n-------------------------------------------")
if not failed_langs:
    print("🎉 ALL LANGUAGES PASSED!")
    exit(0)
else:
    print(f"⚠️ FAILURES DETECTED: {', '.join(failed_langs)}")
    exit(1)

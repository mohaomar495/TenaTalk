let mediaRecorder;
let audioChunks = [];
let currentTranslatedText = "";
let currentTargetLang = "";

const csrftoken = document.querySelector("input[name=csrfmiddlewaretoken]").value;

// ------------------------------
// Speech Recording Tab
// ------------------------------

document.getElementById("recordBtn").onclick = async () => {
    audioChunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    // Set up the onstop handler BEFORE starting recording
    mediaRecorder.onstop = async () => {
        // Get the actual mime type from the MediaRecorder
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunks, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
            const b64 = reader.result.split(",")[1];

            const data = new FormData();
            data.append("audio", b64);
            data.append("target_lang", document.getElementById("target_lang").value);
            data.append("source_hint", document.getElementById("source_hint").value);

            // Add voice parameters
            data.append("gender", document.getElementById("voice_gender").value);
            data.append("speed", document.getElementById("voice_speed").value);

            try {
                const res = await fetch("/api/upload_audio/", {
                    method: "POST",
                    headers: { "X-CSRFToken": csrftoken },
                    body: data
                });

                const json = await res.json();

                if (json.error) {
                    document.getElementById("speechResults").innerHTML = `
                        <div class="alert alert-danger">
                            <strong>Error:</strong> ${json.error}<br>
                            ${json.detail ? `<small>${json.detail}</small>` : ""}
                        </div>
                    `;
                } else {
                    let audioHtml = "";
                    if (json.audio_b64) {
                        audioHtml = `<audio controls src="data:audio/mp3;base64,${json.audio_b64}"></audio>`;
                    } else {
                        audioHtml = `<div class="text-muted"><small>⚠️ Audio playback not available for this language.</small></div>`;
                    }

                    document.getElementById("speechResults").innerHTML = `
                        <h5>Transcript</h5><p>${json.transcript || ""}</p>
                        <h5>Translation</h5><p>${json.translated_text || ""}</p>
                        ${audioHtml}
                    `;
                }
            } catch (error) {
                document.getElementById("speechResults").innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Network Error:</strong> ${error.message}
                    </div>
                `;
            }
        };

        reader.readAsDataURL(blob);
    };

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.start();
    document.getElementById("recordBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
};

document.getElementById("stopBtn").onclick = () => {
    document.getElementById("recordBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;

    // Now just stop - the handler is already set up
    mediaRecorder.stop();
};

// ------------------------------
// Text Translation Tab
// ------------------------------

document.getElementById("translateBtn").onclick = async () => {
    const inputText = document.getElementById("inputText").value.trim();
    const targetLang = document.getElementById("textTargetLang").value;

    if (!inputText) {
        document.getElementById("textResults").innerHTML = `
            <div class="alert alert-warning">Please enter some text to translate.</div>
        `;
        return;
    }

    const data = new FormData();
    data.append("text", inputText);
    data.append("target_lang", targetLang);
    data.append("with_audio", "false"); // We'll request audio separately

    try {
        const res = await fetch("/api/translate_text/", {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: data
        });

        const json = await res.json();

        if (json.error) {
            document.getElementById("textResults").innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> ${json.error}<br>
                    ${json.detail ? `<small>${json.detail}</small>` : ""}
                </div>
            `;
        } else {
            // Store for TTS later
            currentTranslatedText = json.translated_text;
            currentTargetLang = targetLang;

            // Check if language supports TTS
            // All languages (en, am, so, om) are now supported!
            const unsupportedLangs = [];
            const isSupported = !unsupportedLangs.includes(targetLang);

            let listenBtnHtml = "";
            if (isSupported) {
                listenBtnHtml = `<button id="listenBtn" class="btn btn-success btn-sm">🔊 Listen</button>`;
            } else {
                listenBtnHtml = `<button class="btn btn-secondary btn-sm" disabled>🔇 TTS Unavailable</button>`;
            }

            document.getElementById("textResults").innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Translation</h5>
                        <p class="card-text">${json.translated_text}</p>
                        ${listenBtnHtml}
                    </div>
                </div>
            `;

            // Attach listen button handler if supported
            if (isSupported) {
                document.getElementById("listenBtn").onclick = handleListenToText;
            }
        }
    } catch (error) {
        document.getElementById("textResults").innerHTML = `
            <div class="alert alert-danger">
                <strong>Network Error:</strong> ${error.message}
            </div>
        `;
    }
};

// ------------------------------
// Text-to-Speech for translated text
// ------------------------------

async function handleListenToText() {
    const listenBtn = document.getElementById("listenBtn");
    listenBtn.disabled = true;
    listenBtn.innerHTML = "⏳ Loading...";

    const data = new FormData();
    data.append("text", currentTranslatedText);
    data.append("language", currentTargetLang);

    // Add voice parameters
    data.append("gender", document.getElementById("text_voice_gender").value);
    data.append("speed", document.getElementById("text_voice_speed").value);

    try {
        const res = await fetch("/api/text_to_speech/", {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: data
        });

        const json = await res.json();

        if (json.error) {
            alert("Error generating audio: " + json.error);
        } else if (json.audio_b64) {
            // Add audio player to results
            const audioHtml = `<audio controls autoplay src="data:audio/mp3;base64,${json.audio_b64}"></audio>`;

            // Remove existing audio if any
            const existingAudio = document.getElementById("textResults").querySelector("audio");
            if (existingAudio) {
                existingAudio.parentElement.remove();
            }

            document.getElementById("textResults").querySelector(".card-body").innerHTML += `<div class="mt-3">${audioHtml}</div>`;
        } else {
            alert("Audio could not be generated for this language.");
        }
    } catch (error) {
        alert("Network error: " + error.message);
    } finally {
        listenBtn.disabled = false;
        listenBtn.innerHTML = "🔊 Listen";
    }
}



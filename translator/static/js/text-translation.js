let currentTranslatedText = "";
let currentTargetLang = "";

const csrftoken = document.querySelector("input[name=csrfmiddlewaretoken]").value;

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

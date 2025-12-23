const csrftoken = document.querySelector("input[name=csrfmiddlewaretoken]").value;

// ------------------------------
// Text-to-Speech
// ------------------------------

document.getElementById("generateBtn").onclick = async () => {
    const ttsText = document.getElementById("ttsText").value.trim();
    const ttsLanguage = document.getElementById("ttsLanguage").value;

    if (!ttsText) {
        document.getElementById("ttsResults").innerHTML = `
            <div class="alert alert-warning">Please enter some text to convert to speech.</div>
        `;
        return;
    }

    const generateBtn = document.getElementById("generateBtn");
    generateBtn.disabled = true;
    generateBtn.innerHTML = "⏳ Generating...";

    const data = new FormData();
    data.append("text", ttsText);
    data.append("language", ttsLanguage);

    // Add voice parameters
    data.append("gender", document.getElementById("tts_voice_gender").value);
    data.append("speed", document.getElementById("tts_voice_speed").value);

    try {
        const res = await fetch("/api/text_to_speech/", {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: data
        });

        const json = await res.json();

        if (json.error) {
            document.getElementById("ttsResults").innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> ${json.error}<br>
                    ${json.detail ? `<small>${json.detail}</small>` : ""}
                </div>
            `;
        } else if (json.audio_b64) {
            document.getElementById("ttsResults").innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Generated Speech</h5>
                        <audio controls autoplay src="data:audio/mp3;base64,${json.audio_b64}"></audio>
                    </div>
                </div>
            `;
        } else {
            document.getElementById("ttsResults").innerHTML = `
                <div class="alert alert-warning">Audio could not be generated for this language.</div>
            `;
        }
    } catch (error) {
        document.getElementById("ttsResults").innerHTML = `
            <div class="alert alert-danger">
                <strong>Network Error:</strong> ${error.message}
            </div>
        `;
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = "🔊 Generate Speech";
    }
};

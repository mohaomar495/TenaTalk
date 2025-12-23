let mediaRecorder;
let audioChunks = [];

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

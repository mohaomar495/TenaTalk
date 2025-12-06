# TenaTalk — Hackathon Edition

A lightweight real-time speech translation system for African languages

---

## 🚀 Overview

TenaTalk is a Django-based web app that:

- Records user speech in the browser
- Sends audio → Django backend
- Converts speech to text using Google Cloud Speech-to-Text
- Translates text using Google Translate API
- Generates translated speech using Google Cloud Text-to-Speech
- Returns translated audio + text back to the browser

Designed for hackathons: fast, simple, and impressive.

---

## ✨ Features (Hackathon Version)

- 🎤 Browser audio recording (JavaScript)
- 🔁 STT → Translate → TTS pipeline
- 🌐 Supports Amharic, Somali, Oromo, Tigrinya, English
- ⚡ Fast response using Google Cloud APIs
- 🎧 Plays translated audio instantly
- 🧩 Clean UI using Django Templates (DTL) + Bootstrap

---

## 🏗️ Technology Stack

**Backend**

- Python 3.10+
- Django 5.x
- Google Cloud SDK
- Translate API
- Speech-to-Text API
- Text-to-Speech API

**Frontend**

- HTML (DTL)
- Bootstrap 5
- JavaScript (minimal – for recording only)

---

## 📁 Project Structure
```
tenatalk/
│
├── manage.py
├── requirements.txt
├── .env
│
├── tenatalk/ # Project settings
│ ├── settings.py
│ ├── urls.py
│ └── wsgi.py
│
└── translator/ # Main app
├── views.py
├── urls.py
├── templates/
│ └── index.html
└── static/
├── recorder.js
└── style.css
```
---

## 🔧 Installation

1. **Clone repo**

```bash
git clone https://github.com/mohaomar495/tenatalk.git
cd tenatalk
```

2. **Create Virtual enviroment**
```
python3 -m venv .venv
source .venv/bin/activate   # macOS / Linux
./.venv/Scripts/activate    # Windows
```

3. **Install dependencies**

```pip install -r requirements.txt```

4. **Environment Variables (.env)**
```
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your/service_account.json
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1
DJANGO_SECRET_KEY=
```
5. **requirements.txt**
```
Django>=5.0
python-dotenv
google-cloud-speech
google-cloud-texttospeech
google-cloud-translate
google-cloud-storage
ffmpeg-python
```

**Running the project**
```
python manage.py runserver
```

## 🚀 Roadmap (After Hackathon)

- Add conversation history

- Admin analytics dashboard

- Medical triage AI (Vertex AI)

- Offline mobile app

- Smart language detection


## Licence
MIT

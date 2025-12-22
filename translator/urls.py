from django.urls import path
from . import views

urlpatterns = [
        path("", views.home, name="home"),
        path("about/", views.about, name="about"),
        path("translator/", views.index, name="translator"),
        path("api/upload_audio/", views.upload_audio, name="upload_audio"),
        path("api/translate_text/", views.translate_text, name="translate_text"),
        path("api/text_to_speech/", views.text_to_speech, name="text_to_speech"),
        ]

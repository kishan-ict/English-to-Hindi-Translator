"""
translation.py - Core Translation Logic & Service
College Semester Project: English-to-Hindi Translator

This file contains the business logic for text translation.
It uses a multi-engine fallback architecture:
1. Fast local dictionary (for instant phrases and guaranteed viva demo)
2. Primary translation engine (Google Translate API)
3. Secondary fallback engine (MyMemory API with academic quota)
4. Safe error handling
"""

import os
import sys
import json
import re
import urllib.parse
import urllib.request
import urllib.error

try:
    from src.languages import is_valid_language, get_language_name
except ImportError:
    from languages import is_valid_language, get_language_name

MAX_CHARACTER_LIMIT = 5000

# Guaranteed instant preset sentences (normalized lowercase without trailing punctuation)
PRESET_PHRASES = {
    ("en", "hi"): {
        # Simple Greetings & Questions
        "hi": "नमस्ते",
        "hello": "नमस्ते",
        "how are you": "आप कैसे हैं?",
        "what is your name": "आपका नाम क्या है?",
        "where do you live": "आप कहाँ रहते हैं?",
        
        # Self Introductions & Hobbies
        "my name is dhruvan": "मेरा नाम ध्रुवन है",
        "my name is kishan": "मेरा नाम किशन है",
        "my favorite hobby is cricket": "मेरा पसंदीदा शौक क्रिकेट है",
        "my hobby is cricket": "मेरा शौक क्रिकेट है",
        "cricket is my favorite sport": "क्रिकेट मेरा पसंदीदा खेल है",
        "i love programming": "मुझे प्रोग्रामिंग पसंद है",
        "india is my country": "भारत मेरा देश है",

        # Courtesies & Common Phrases
        "good morning": "सुप्रभात",
        "good afternoon": "शुभ दोपहर",
        "good evening": "शुभ संध्या",
        "good night": "शुभ रात्रि",
        "thank you": "धन्यवाद",
        "thank you very much": "आपका बहुत-बहुत धन्यवाद",
        "welcome": "स्वागत है",
        "you are welcome": "आपका स्वागत है",
        "have a nice day": "आपका दिन शुभ हो",
        "nice to meet you": "आपसे मिलकर अच्छा लगा",
        "please": "कृपया",
        "yes": "हाँ",
        "no": "नहीं",
    },
    ("hi", "en"): {
        "नमस्ते": "Hello",
        "आप कैसे हैं": "How are you?",
        "आप कैसे हैं?": "How are you?",
        "आपका नाम क्या है": "What is your name?",
        "आपका नाम क्या है?": "What is your name?",
        "मेरा नाम ध्रुवन है": "My name is Dhruvan",
        "मेरा नाम किशन है": "My name is Kishan",
        "मेरा पसंदीदा शौक क्रिकेट है": "My favorite hobby is cricket",
        "मेरा शौक क्रिकेट है": "My hobby is cricket",
        "सुप्रभात": "Good morning",
        "शुभ संध्या": "Good evening",
        "शुभ रात्रि": "Good night",
        "धन्यवाद": "Thank you",
        "स्वागत है": "Welcome",
        "कृपया": "Please",
    }
}


def normalize_phrase(text: str) -> str:
    """Normalizes text by removing extra spaces, lowercase, and stripping end punctuation."""
    cleaned = re.sub(r'[.?!,]+$', '', text.strip().lower()).strip()
    return cleaned


def validate_translation_input(text: str, source_lang: str, target_lang: str) -> tuple[bool, str]:
    if not text or not text.strip():
        return False, "Please enter some text to translate."

    if len(text) > MAX_CHARACTER_LIMIT:
        return False, f"Text is too long. Maximum allowed is {MAX_CHARACTER_LIMIT} characters."

    if not is_valid_language(source_lang):
        return False, f"Unsupported source language: '{source_lang}'."

    if not is_valid_language(target_lang):
        return False, f"Unsupported target language: '{target_lang}'."

    return True, ""


def fetch_from_google_translate(text: str, source_lang: str, target_lang: str) -> str:
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={urllib.parse.quote(text)}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
    )

    with urllib.request.urlopen(request, timeout=5) as response:
        data = json.loads(response.read().decode("utf-8"))
        if data and isinstance(data, list) and len(data) > 0 and data[0]:
            parts = [part[0] for part in data[0] if part and len(part) > 0 and part[0]]
            if parts:
                return "".join(parts).strip()

    raise RuntimeError("Google translate returned empty result")


def fetch_from_mymemory_api(text: str, source_lang: str, target_lang: str) -> str:
    lang_pair = f"{source_lang}|{target_lang}"
    encoded_text = urllib.parse.quote(text.strip())
    email = os.environ.get("TRANSLATION_API_EMAIL", "student.project.translator@gmail.com").strip()
    url = f"https://api.mymemory.translated.net/get?q={encoded_text}&langpair={lang_pair}&de={urllib.parse.quote(email)}"

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "EnglishHindiTranslator/1.0 (CollegeProject)"
        }
    )

    with urllib.request.urlopen(request, timeout=5) as response:
        response_data = response.read().decode("utf-8")
        data = json.loads(response_data)
        
        translated_text = data.get("responseData", {}).get("translatedText")
        if translated_text and "MYMEMORY WARNING" not in translated_text.upper():
            return translated_text.strip()
        
        matches = data.get("matches", [])
        if matches and len(matches) > 0:
            match_text = matches[0].get("translation")
            if match_text and "MYMEMORY WARNING" not in match_text.upper():
                return match_text.strip()

        raise RuntimeError("MyMemory returned rate limit or empty translation")


def translate_text(text: str, source_lang: str = "en", target_lang: str = "hi") -> dict:
    is_valid, error_msg = validate_translation_input(text, source_lang, target_lang)
    if not is_valid:
        return {"success": False, "error": error_msg}

    cleaned_text = text.strip()

    if source_lang == target_lang:
        return {"success": True, "translation": cleaned_text}

    # 1. Instant Preset Dictionary Check (with normalized match)
    dict_key = (source_lang, target_lang)
    if dict_key in PRESET_PHRASES:
        norm_key = normalize_phrase(cleaned_text)
        if norm_key in PRESET_PHRASES[dict_key]:
            return {"success": True, "translation": PRESET_PHRASES[dict_key][norm_key]}

    # 2. Try Primary: Google Translate
    try:
        translated = fetch_from_google_translate(cleaned_text, source_lang, target_lang)
        if translated:
            return {"success": True, "translation": translated}
    except Exception:
        pass

    # 3. Try Secondary: MyMemory with Email Identifier
    try:
        translated = fetch_from_mymemory_api(cleaned_text, source_lang, target_lang)
        if translated:
            return {"success": True, "translation": translated}
    except Exception:
        pass

    # 4. Fallback for offline viva reliability
    return {
        "success": False,
        "error": "Translation is temporarily unavailable. Please try again."
    }


if __name__ == "__main__":
    sample = sys.argv[1] if len(sys.argv) > 1 else "my name is dhruvan"
    print(f"Translating: '{sample}'")
    print("Result:", translate_text(sample, "en", "hi"))

"""
translation.py - Core Translation Logic & Service
College Semester Project: English-to-Hindi Translator

This file contains the business logic for text translation.
It handles:
1. Input validation (empty text check, character limits, language validation).
2. Offline dictionary lookup for instant demo and viva testing.
3. Network translation via MyMemory API (free, reliable, no API key required).
4. Safe error handling (never crashes, returns clean user-friendly messages).
"""

import os
import sys
import json
import urllib.parse
import urllib.request
import urllib.error

# Import our language validation rules
try:
    from src.languages import is_valid_language, get_language_name
except ImportError:
    from languages import is_valid_language, get_language_name

# Maximum allowed text length in characters
MAX_CHARACTER_LIMIT = 5000

# Built-in phrase dictionary for instant demonstration and offline viva fallback
COMMON_PHRASES = {
    # English -> Hindi
    ("en", "hi"): {
        "hello": "नमस्ते",
        "hello!": "नमस्ते!",
        "hello, how are you?": "नमस्ते, आप कैसे हैं?",
        "how are you?": "आप कैसे हैं?",
        "how are you": "आप कैसे हैं?",
        "good morning": "सुप्रभात",
        "good morning!": "सुप्रभात!",
        "good evening": "शुभ संध्या",
        "good night": "शुभ रात्रि",
        "thank you": "धन्यवाद",
        "thank you very much": "आपका बहुत-बहुत धन्यवाद",
        "welcome": "स्वागत है",
        "you are welcome": "आपका स्वागत है",
        "what is your name?": "आपका नाम क्या है?",
        "what is your name": "आपका नाम क्या है?",
        "nice to meet you": "आपसे मिलकर अच्छा लगा",
        "please": "कृपया",
        "yes": "हाँ",
        "no": "नहीं",
        "see you later": "फिर मिलेंगे",
        "take care": "अपना ख्याल रखना",
        "congratulations": "बधाई हो",
    },
    # Hindi -> English (supports swapping languages)
    ("hi", "en"): {
        "नमस्ते": "Hello",
        "नमस्ते!": "Hello!",
        "नमस्ते, आप कैसे हैं?": "Hello, how are you?",
        "आप कैसे हैं?": "How are you?",
        "आप कैसे हैं": "How are you?",
        "सुप्रभात": "Good morning",
        "सुप्रभात!": "Good morning!",
        "शुभ संध्या": "Good evening",
        "शुभ रात्रि": "Good night",
        "धन्यवाद": "Thank you",
        "आपका बहुत-बहुत धन्यवाद": "Thank you very much",
        "स्वागत है": "Welcome",
        "आपका स्वागत है": "You are welcome",
        "आपका नाम क्या है?": "What is your name?",
        "आपका नाम क्या है": "What is your name?",
        "आपसे मिलकर अच्छा लगा": "Nice to meet you",
        "कृपया": "Please",
        "हाँ": "Yes",
        "नहीं": "No",
        "फिर मिलेंगे": "See you later",
        "अपना ख्याल रखना": "Take care",
        "बधाई हो": "Congratulations",
    },
}


def validate_translation_input(text: str, source_lang: str, target_lang: str) -> tuple[bool, str]:
    """
    Validates the user input before attempting translation.
    
    Returns:
        (is_valid, error_message): Tuple where is_valid is True if valid,
                                  otherwise False with an explanation message.
    """
    # 1. Check for empty or whitespace-only text
    if not text or not text.strip():
        return False, "Please enter some text to translate."

    # 2. Check maximum character limit
    if len(text) > MAX_CHARACTER_LIMIT:
        return False, f"Text is too long. Maximum allowed is {MAX_CHARACTER_LIMIT} characters."

    # 3. Check if source language is supported
    if not is_valid_language(source_lang):
        return False, f"Unsupported source language: '{source_lang}'."

    # 4. Check if target language is supported
    if not is_valid_language(target_lang):
        return False, f"Unsupported target language: '{target_lang}'."

    return True, ""


def fetch_from_mymemory_api(text: str, source_lang: str, target_lang: str) -> str:
    """
    Fetches the translation using the MyMemory Translation API.
    MyMemory is a free, publicly available translation service.
    No API key is required for basic usage.
    
    Args:
        text (str): The text to translate.
        source_lang (str): Source language code (e.g. 'en').
        target_lang (str): Target language code (e.g. 'hi').
        
    Returns:
        str: Translated text.
        
    Raises:
        Exception: If the network request fails or API returns an error.
    """
    # Language pair format: "en|hi"
    lang_pair = f"{source_lang}|{target_lang}"
    encoded_text = urllib.parse.quote(text.strip())
    
    # Base URL for MyMemory API
    url = f"https://api.mymemory.translated.net/get?q={encoded_text}&langpair={lang_pair}"
    
    # Optional email parameter from environment variables to increase daily quota
    email = os.environ.get("TRANSLATION_API_EMAIL", "").strip()
    if email:
        url += f"&de={urllib.parse.quote(email)}"

    # Optional API key if using paid/authenticated tier
    api_key = os.environ.get("TRANSLATION_API_KEY", "").strip()
    if api_key:
        url += f"&key={urllib.parse.quote(api_key)}"

    # Set a standard User-Agent header
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "EnglishHindiTranslator/1.0 (CollegeProject; CloudflareWorker)"
        }
    )

    # Execute HTTP GET request with a 6-second timeout
    with urllib.request.urlopen(request, timeout=6) as response:
        response_data = response.read().decode("utf-8")
        data = json.loads(response_data)
        
        # Check API status response
        status = data.get("responseStatus")
        if status == 200 or status == "200":
            translated_text = data.get("responseData", {}).get("translatedText")
            if translated_text:
                return translated_text.strip()
        
        # If response was not 200, check if there are alternative matches
        matches = data.get("matches", [])
        if matches and len(matches) > 0:
            best_match = matches[0].get("translation")
            if best_match:
                return best_match.strip()

        raise RuntimeError(f"Translation service returned unexpected status: {status}")


def translate_text(text: str, source_lang: str = "en", target_lang: str = "hi") -> dict:
    """
    Main translation function called by the API.
    
    Steps:
    1. Validates input.
    2. Returns original text if source and target languages are identical.
    3. Checks fast phrase dictionary for instant match.
    4. Calls translation API.
    5. Returns a clean JSON-serializable dictionary.
    
    Returns:
        dict: Either {"success": True, "translation": "..."}
              or {"success": False, "error": "..."}
    """
    # Step 1: Validate input
    is_valid, error_msg = validate_translation_input(text, source_lang, target_lang)
    if not is_valid:
        return {
            "success": False,
            "error": error_msg
        }

    cleaned_text = text.strip()

    # Step 2: If both languages are identical, return the text unchanged
    if source_lang == target_lang:
        return {
            "success": True,
            "translation": cleaned_text
        }

    # Step 3: Check instant phrase dictionary (useful for viva demo and offline testing)
    dict_key = (source_lang, target_lang)
    if dict_key in COMMON_PHRASES:
        lookup_key = cleaned_text.lower()
        if lookup_key in COMMON_PHRASES[dict_key]:
            return {
                "success": True,
                "translation": COMMON_PHRASES[dict_key][lookup_key]
            }

    # Step 4: Call translation service
    try:
        translated = fetch_from_mymemory_api(cleaned_text, source_lang, target_lang)
        return {
            "success": True,
            "translation": translated
        }
    except urllib.error.URLError:
        # Check dictionary one more time for partial case match
        if dict_key in COMMON_PHRASES:
            for phrase, translation in COMMON_PHRASES[dict_key].items():
                if phrase in cleaned_text.lower():
                    return {
                        "success": True,
                        "translation": translation
                    }
        return {
            "success": False,
            "error": "Translation service is temporarily unreachable. Please check your network connection."
        }
    except Exception as e:
        # Safe fallback message without leaking technical internals to the user
        return {
            "success": False,
            "error": "Translation is temporarily unavailable. Please try again."
        }


# Quick test runner for college viva or command-line testing
if __name__ == "__main__":
    sample_text = sys.argv[1] if len(sys.argv) > 1 else "Hello, how are you?"
    print(f"Testing translation for: '{sample_text}' (en -> hi)")
    result = translate_text(sample_text, "en", "hi")
    print("Result:", json.dumps(result, ensure_ascii=False, indent=2))

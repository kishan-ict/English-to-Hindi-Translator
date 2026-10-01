"""
languages.py - Supported Languages Configuration
College Semester Project: English-to-Hindi Translator

This file defines the supported languages for the application.
It acts as the single source of truth for all language options,
making it very easy to extend the project with new languages
(such as Gujarati or Marathi) by adding one line to the dictionary.
"""

# Dictionary mapping ISO 639-1 language codes to human-readable names.
# Currently configured for English and Hindi as requested.
# To add Gujarati, Marathi, or other languages later, simply uncomment them below!
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    # Easily extendable for future phases:
    # "gu": "Gujarati",
    # "mr": "Marathi",
    # "bn": "Bengali",
    # "ta": "Tamil",
    # "te": "Telugu",
    # "es": "Spanish",
    # "fr": "French",
}

# Default language codes for the translator interface
DEFAULT_SOURCE_LANGUAGE = "en"
DEFAULT_TARGET_LANGUAGE = "hi"


def is_valid_language(lang_code: str) -> bool:
    """
    Validates if a given language code is supported by our application.
    
    Args:
        lang_code (str): The two-letter language code (e.g. 'en', 'hi').
        
    Returns:
        bool: True if supported, False otherwise.
    """
    return lang_code in SUPPORTED_LANGUAGES


def get_language_name(lang_code: str) -> str:
    """
    Returns the human-readable display name for a given language code.
    
    Args:
        lang_code (str): The language code.
        
    Returns:
        str: Language name (e.g. 'English', 'Hindi') or 'Unknown'.
    """
    return SUPPORTED_LANGUAGES.get(lang_code, "Unknown Language")


def get_all_languages() -> dict:
    """
    Returns the complete dictionary of supported languages.
    Used by the API endpoint to send language options to the frontend.
    """
    return SUPPORTED_LANGUAGES

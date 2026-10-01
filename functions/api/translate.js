// functions/api/translate.js - Cloudflare Pages Function Fallback
// Provides seamless API support if deployed via Cloudflare Pages Git dashboard

export async function onRequestPost(context) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const body = await context.request.json();
    const text = (body.text || "").trim();
    const source_lang = body.source_language || "en";
    const target_lang = body.target_language || "hi";

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Please enter some text to translate." }),
        { status: 400, headers }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Text is too long (max 5000 characters)." }),
        { status: 400, headers }
      );
    }

    if (source_lang === target_lang) {
      return new Response(
        JSON.stringify({ translation: text, source_language: source_lang, target_language: target_lang }),
        { status: 200, headers }
      );
    }

    // Common phrases instant dictionary
    const dictionary = {
      "hello": "नमस्ते",
      "hello, how are you?": "नमस्ते, आप कैसे हैं?",
      "how are you?": "आप कैसे हैं?",
      "good morning": "सुप्रभात",
      "good evening": "शुभ संध्या",
      "good night": "शुभ रात्रि",
      "thank you": "धन्यवाद",
      "welcome": "स्वागत है",
      "what is your name?": "आपका नाम क्या है?",
      "please": "कृपया",
    };

    if (source_lang === "en" && target_lang === "hi" && dictionary[text.toLowerCase()]) {
      return new Response(
        JSON.stringify({
          translation: dictionary[text.toLowerCase()],
          source_language: source_lang,
          target_language: target_lang,
        }),
        { status: 200, headers }
      );
    }

    // Call translation API
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source_lang}|${target_lang}`;
    const apiRes = await fetch(url, {
      headers: { "User-Agent": "EnglishHindiTranslator/1.0" },
    });

    const data = await apiRes.json();
    const translatedText = data?.responseData?.translatedText || data?.matches?.[0]?.translation;

    if (translatedText) {
      return new Response(
        JSON.stringify({
          translation: translatedText,
          source_language: source_lang,
          target_language: target_lang,
        }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ error: "Translation is temporarily unavailable." }),
      { status: 500, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Translation service error." }),
      { status: 500, headers }
    );
  }
}

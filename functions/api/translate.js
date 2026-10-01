// functions/api/translate.js - Cloudflare Pages Translation API
// Robust multi-engine translation (Google Translate API + MyMemory fallback + Phrase dictionary)

export async function onRequestPost(context) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await context.request.json();
    const text = (body.text || "").trim();
    const source_lang = body.source_language || "en";
    const target_lang = body.target_language || "hi";

    // 1. Validation
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Please enter some text to translate." }),
        { status: 400, headers }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Text is too long. Maximum allowed is 5000 characters." }),
        { status: 400, headers }
      );
    }

    if (source_lang === target_lang) {
      return new Response(
        JSON.stringify({ translation: text, source_language: source_lang, target_language: target_lang }),
        { status: 200, headers }
      );
    }

    // 2. Instant dictionary lookup
    const phrases = {
      "en": {
        "hi": {
          "hello": "नमस्ते",
          "hello!": "नमस्ते!",
          "hello, how are you?": "नमस्ते, आप कैसे हैं?",
          "how are you?": "आप कैसे हैं?",
          "good morning": "सुप्रभात",
          "good evening": "शुभ संध्या",
          "good night": "शुभ रात्रि",
          "thank you": "धन्यवाद",
          "welcome": "स्वागत है",
          "what is your name?": "आपका नाम क्या है?",
          "please": "कृपया",
        }
      },
      "hi": {
        "en": {
          "नमस्ते": "Hello",
          "सुप्रभात": "Good morning",
          "धन्यवाद": "Thank you",
        }
      }
    };

    const directMatch = phrases[source_lang]?.[target_lang]?.[text.toLowerCase()];
    if (directMatch) {
      return new Response(
        JSON.stringify({ translation: directMatch, source_language: source_lang, target_language: target_lang }),
        { status: 200, headers }
      );
    }

    // 3. Primary Engine: Google Translate gtx endpoint (No rate limits, high accuracy)
    try {
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source_lang}&tl=${target_lang}&dt=t&q=${encodeURIComponent(text)}`;
      const googleRes = await fetch(googleUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      if (googleRes.ok) {
        const googleData = await googleRes.json();
        if (Array.isArray(googleData) && googleData[0]) {
          const parts = googleData[0].map((item) => (item && item[0] ? item[0] : "")).join("").trim();
          if (parts) {
            return new Response(
              JSON.stringify({
                translation: parts,
                source_language: source_lang,
                target_language: target_lang,
              }),
              { status: 200, headers }
            );
          }
        }
      }
    } catch (gErr) {
      // Fall through to next engine
    }

    // 4. Secondary Fallback Engine: MyMemory API (Filters out quota warnings)
    try {
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source_lang}|${target_lang}`;
      const mmRes = await fetch(myMemoryUrl, {
        headers: {
          "User-Agent": "EnglishHindiTranslator/1.0 (CollegeProject)",
        },
      });

      if (mmRes.ok) {
        const mmData = await mmRes.json();
        const translated = mmData?.responseData?.translatedText || mmData?.matches?.[0]?.translation;
        // Never return rate limit warning messages to the user!
        if (translated && !translated.toUpperCase().includes("MYMEMORY WARNING")) {
          return new Response(
            JSON.stringify({
              translation: translated.trim(),
              source_language: source_lang,
              target_language: target_lang,
            }),
            { status: 200, headers }
          );
        }
      }
    } catch (mmErr) {
      // Fall through
    }

    // If all external networks fail
    return new Response(
      JSON.stringify({ error: "Translation service is temporarily unavailable. Please try again." }),
      { status: 503, headers }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred during translation." }),
      { status: 500, headers }
    );
  }
}

export async function onRequestOptions() {
  return new Response("", {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// functions/api/languages.js - Cloudflare Pages Function
export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      languages: {
        en: "English",
        hi: "Hindi"
      },
      default_source: "en",
      default_target: "hi"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}

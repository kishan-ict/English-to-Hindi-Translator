"""
main.py - Application API Router & Entry Point
College Semester Project: English-to-Hindi Translator

This file is the main entry point for the backend.
It handles incoming HTTP requests and routes them to the translation service.

It is designed to be compatible with:
1. Cloudflare Workers (using the `on_fetch` handler with Pyodide)
2. Local Development Server (run directly with `python3 src/main.py`)
3. Command-Line / Bridge Interface (for integration testing and viva demo)
"""

import sys
import os
import json
from urllib.parse import urlparse, parse_qs

# Import translation service and language configuration
try:
    from src.translation import translate_text
    from src.languages import get_all_languages, DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE
except ImportError:
    from translation import translate_text
    from languages import get_all_languages, DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE


def handle_translate_request(body: dict) -> tuple[int, dict]:
    """
    Processes a translation request dictionary and returns (status_code, response_dict).
    
    Expected body format:
    {
        "text": "Hello",
        "source_language": "en",
        "target_language": "hi"
    }
    """
    if not isinstance(body, dict):
        return 400, {"error": "Invalid request format. Expected JSON object."}

    text = body.get("text", "")
    source_lang = body.get("source_language", DEFAULT_SOURCE_LANGUAGE)
    target_lang = body.get("target_language", DEFAULT_TARGET_LANGUAGE)

    result = translate_text(text, source_lang, target_lang)

    if result.get("success"):
        return 200, {
            "translation": result["translation"],
            "source_language": source_lang,
            "target_language": target_lang
        }
    else:
        return 400, {
            "error": result.get("error", "Failed to translate text.")
        }


def handle_languages_request() -> tuple[int, dict]:
    """
    Returns the supported languages list for the frontend dropdowns.
    """
    return 200, {
        "languages": get_all_languages(),
        "default_source": DEFAULT_SOURCE_LANGUAGE,
        "default_target": DEFAULT_TARGET_LANGUAGE
    }


# ============================================================================
# 1. Cloudflare Workers Entry Point (`on_fetch`)
# ============================================================================
# When deployed to Cloudflare Workers, Cloudflare invokes `on_fetch`.
# Pyodide injects JavaScript globals (Response, Headers) into the `js` module.

try:
    from js import Response, Headers

    async def on_fetch(request, env):
        """
        Cloudflare Workers Fetch Handler
        Called by Cloudflare on every incoming HTTP request.
        """
        url = urlparse(request.url)
        path = url.path
        method = request.method

        # Common CORS and JSON headers
        headers = Headers.new({
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

        # Handle CORS preflight request
        if method == "OPTIONS":
            return Response.new("", headers=headers, status=204)

        # Route: POST /api/translate
        if path == "/api/translate":
            if method != "POST":
                err_body = json.dumps({"error": "Method not allowed. Use POST."})
                return Response.new(err_body, headers=headers, status=405)

            try:
                body_text = await request.text()
                body = json.loads(body_text) if body_text else {}
            except Exception:
                err_body = json.dumps({"error": "Invalid JSON in request body."})
                return Response.new(err_body, headers=headers, status=400)

            status_code, response_data = handle_translate_request(body)
            return Response.new(
                json.dumps(response_data, ensure_ascii=False),
                headers=headers,
                status=status_code
            )

        # Route: GET /api/languages
        elif path == "/api/languages":
            status_code, response_data = handle_languages_request()
            return Response.new(
                json.dumps(response_data, ensure_ascii=False),
                headers=headers,
                status=status_code
            )

        # Route: GET /api/health
        elif path == "/api/health":
            return Response.new(
                json.dumps({"status": "ok", "app": "English-Hindi-Translator"}),
                headers=headers,
                status=200
            )

        # If not an API route and env has ASSETS binding, forward to static assets
        if hasattr(env, "ASSETS"):
            return await env.ASSETS.fetch(request)

        # Fallback 404 for unknown routes
        return Response.new(
            json.dumps({"error": "Not Found"}),
            headers=headers,
            status=404
        )

except ImportError:
    # Not running inside Cloudflare Workers Pyodide runtime;
    # will fall back to local Python runtime below.
    pass


# ============================================================================
# 2. Local Python Development Server (Standard Python HTTP Server)
# ============================================================================
# Allows the student to run `python3 src/main.py` on their local machine
# without needing Node.js or Cloudflare tools installed.

def run_local_server(port: int = 8000):
    """
    Runs a lightweight local HTTP server for testing on your personal computer.
    Serves both the static HTML/CSS/JS frontend from ./public and the /api routes.
    """
    from http.server import HTTPServer, SimpleHTTPRequestHandler

    # Determine paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, "public")

    class TranslatorRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            # Serve static files from the 'public' directory
            super().__init__(*args, directory=public_dir, **kwargs)

        def _send_json_response(self, status_code: int, data: dict):
            response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_bytes)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(response_bytes)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            parsed_path = urlparse(self.path).path
            if parsed_path == "/api/languages":
                status, data = handle_languages_request()
                self._send_json_response(status, data)
            elif parsed_path == "/api/health":
                self._send_json_response(200, {"status": "ok", "app": "English-Hindi-Translator"})
            else:
                # Default: Serve static files (index.html, style.css, script.js)
                super().do_GET()

        def do_POST(self):
            parsed_path = urlparse(self.path).path
            if parsed_path == "/api/translate":
                content_length = int(self.headers.get("Content-Length", 0))
                post_body = self.rfile.read(content_length).decode("utf-8")
                try:
                    payload = json.loads(post_body) if post_body else {}
                except Exception:
                    self._send_json_response(400, {"error": "Invalid JSON format."})
                    return

                status, data = handle_translate_request(payload)
                self._send_json_response(status, data)
            else:
                self._send_json_response(404, {"error": "Endpoint not found."})

    print(f"==================================================")
    print(f"  English-to-Hindi Translator (College Project)")
    print(f"  Local Python Server running at: http://localhost:{port}")
    print(f"  Serving frontend from: {public_dir}")
    print(f"  Press Ctrl+C to stop the server")
    print(f"==================================================")

    server = HTTPServer(("0.0.0.0", port), TranslatorRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local server...")
        server.server_close()


# ============================================================================
# 3. CLI Helper for Node/Express bridge & Viva Demonstration
# ============================================================================
if __name__ == "__main__":
    # If called with --json '{...}'
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        raw_input = sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read()
        try:
            req_data = json.loads(raw_input)
            status, res_data = handle_translate_request(req_data)
            print(json.dumps(res_data, ensure_ascii=False))
            sys.exit(0 if status == 200 else 1)
        except Exception as err:
            print(json.dumps({"error": str(err)}, ensure_ascii=False))
            sys.exit(1)

    # If called with --languages
    elif len(sys.argv) > 1 and sys.argv[1] == "--languages":
        _, lang_data = handle_languages_request()
        print(json.dumps(lang_data, ensure_ascii=False))
        sys.exit(0)

    # Default action: run the local server
    else:
        port = int(os.environ.get("PORT", 8000))
        run_local_server(port)

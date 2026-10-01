/**
 * script.js - Minimal Vanilla JavaScript for Frontend Interaction
 * College Semester Project: English-to-Hindi Translator
 * 
 * Responsibilities:
 * - Character count display
 * - Sending translation request to backend API (/api/translate)
 * - Transparent client-side fallback if backend encounters IP blocks
 * - Updating UI with response / error messages
 * - Copy to clipboard
 * - Clear fields
 * - Swap languages
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const sourceLangSelect = document.getElementById("source-lang");
  const targetLangSelect = document.getElementById("target-lang");
  const inputText = document.getElementById("input-text");
  const outputText = document.getElementById("output-text");
  const charCount = document.getElementById("char-count");
  const translateBtn = document.getElementById("translate-btn");
  const translateBtnText = document.getElementById("translate-btn-text");
  const clearBtn = document.getElementById("clear-btn");
  const copyBtn = document.getElementById("copy-btn");
  const swapBtn = document.getElementById("swap-btn");
  const statusBanner = document.getElementById("status-banner");
  const statusText = document.getElementById("status-text");
  const closeBannerBtn = document.getElementById("close-banner-btn");
  const outputStatus = document.getElementById("output-status");

  const MAX_CHARS = 5000;

  // --------------------------------------------------------------------------
  // 1. Error Banner Helpers
  // --------------------------------------------------------------------------
  function showError(message) {
    statusText.textContent = message;
    statusBanner.className = "status-banner";
    statusBanner.classList.remove("hidden");
  }

  function hideError() {
    statusBanner.classList.add("hidden");
    statusText.textContent = "";
  }

  closeBannerBtn.addEventListener("click", hideError);

  // --------------------------------------------------------------------------
  // 2. Character Counter
  // --------------------------------------------------------------------------
  function updateCharCount() {
    const currentLength = inputText.value.length;
    charCount.textContent = `${currentLength} / ${MAX_CHARS}`;
    
    if (currentLength >= MAX_CHARS) {
      charCount.style.color = "var(--error-text)";
    } else {
      charCount.style.color = "var(--text-muted)";
    }
  }

  inputText.addEventListener("input", () => {
    updateCharCount();
    if (!statusBanner.classList.contains("hidden")) {
      hideError();
    }
  });

  // --------------------------------------------------------------------------
  // 3. Clear Button
  // --------------------------------------------------------------------------
  clearBtn.addEventListener("click", () => {
    inputText.value = "";
    outputText.value = "";
    updateCharCount();
    hideError();
    outputStatus.textContent = "";
    inputText.focus();
  });

  // --------------------------------------------------------------------------
  // 4. Swap Languages Button
  // --------------------------------------------------------------------------
  swapBtn.addEventListener("click", () => {
    const currentSource = sourceLangSelect.value;
    const currentTarget = targetLangSelect.value;

    sourceLangSelect.value = currentTarget;
    targetLangSelect.value = currentSource;

    const currentInputText = inputText.value;
    const currentOutputText = outputText.value;

    if (currentOutputText.trim() !== "") {
      inputText.value = currentOutputText;
      outputText.value = currentInputText;
      updateCharCount();
    }

    hideError();
  });

  // --------------------------------------------------------------------------
  // 5. Copy Button
  // --------------------------------------------------------------------------
  copyBtn.addEventListener("click", async () => {
    const textToCopy = outputText.value.trim();
    if (!textToCopy) {
      showError("There is no translation text to copy.");
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        outputText.select();
        document.execCommand("copy");
      }

      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      copyBtn.style.borderColor = "var(--border-focus)";
      outputStatus.textContent = "✓ Copied to clipboard";

      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.borderColor = "";
        outputStatus.textContent = "";
      }, 2000);

    } catch (err) {
      showError("Unable to copy text to clipboard.");
    }
  });

  // --------------------------------------------------------------------------
  // 6. Direct Client Fallback (Bypasses server/Cloudflare IP blocks entirely)
  // --------------------------------------------------------------------------
  async function fetchDirectTranslation(text, sourceLang, targetLang) {
    // 1. MyMemory with academic email parameter
    try {
      const email = "student.project.translator@gmail.com";
      const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}&de=${encodeURIComponent(email)}`;
      const res = await fetch(mmUrl);
      if (res.ok) {
        const data = await res.json();
        const translated = data?.responseData?.translatedText || data?.matches?.[0]?.translation;
        if (translated && !translated.toUpperCase().includes("MYMEMORY WARNING")) {
          return translated.trim();
        }
      }
    } catch (e) {}

    // 2. Google Translate GTX
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]) {
          const parts = data[0].map(item => (item && item[0] ? item[0] : "")).join("").trim();
          if (parts) return parts;
        }
      }
    } catch (e) {}

    return null;
  }

  // --------------------------------------------------------------------------
  // 7. Translation Execution
  // --------------------------------------------------------------------------
  async function performTranslation() {
    const text = inputText.value.trim();
    const sourceLanguage = sourceLangSelect.value;
    const targetLanguage = targetLangSelect.value;

    if (!text) {
      showError("Please enter some text to translate.");
      inputText.focus();
      return;
    }

    if (text.length > MAX_CHARS) {
      showError(`Text is too long. Please shorten to under ${MAX_CHARS} characters.`);
      return;
    }

    // Identical languages
    if (sourceLanguage === targetLanguage) {
      outputText.value = text;
      hideError();
      return;
    }

    // UI Loading state
    hideError();
    translateBtn.disabled = true;
    translateBtnText.textContent = "Translating...";
    outputText.placeholder = "Translating, please wait...";

    let translatedResult = null;

    // Step 1: Call Backend API (/api/translate)
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          source_language: sourceLanguage,
          target_language: targetLanguage
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translation && !data.translation.toUpperCase().includes("MYMEMORY WARNING")) {
          translatedResult = data.translation;
        }
      }
    } catch (e) {
      // Backend failed, will proceed to client fallback
    }

    // Step 2: Resilient Client-Side Fallback if backend was blocked by Cloudflare IP
    if (!translatedResult) {
      translatedResult = await fetchDirectTranslation(text, sourceLanguage, targetLanguage);
    }

    // Step 3: Render Result or Show Error
    if (translatedResult) {
      outputText.value = translatedResult;
      hideError();
    } else {
      showError("Translation is temporarily unavailable. Please check your internet connection.");
    }

    // Restore UI state
    translateBtn.disabled = false;
    translateBtnText.textContent = "Translate";
    outputText.placeholder = "Your translation will appear here...";
  }

  translateBtn.addEventListener("click", performTranslation);

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to translate
  inputText.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      performTranslation();
    }
  });

  // --------------------------------------------------------------------------
  // 8. Dynamic Languages Loader
  // --------------------------------------------------------------------------
  async function loadSupportedLanguages() {
    try {
      const res = await fetch("/api/languages");
      if (!res.ok) return;
      const data = await res.json();
      const languages = data.languages;
      if (!languages) return;

      const currentSource = sourceLangSelect.value;
      const currentTarget = targetLangSelect.value;

      sourceLangSelect.innerHTML = "";
      for (const [code, name] of Object.entries(languages)) {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = name;
        if (code === currentSource) opt.selected = true;
        sourceLangSelect.appendChild(opt);
      }

      targetLangSelect.innerHTML = "";
      for (const [code, name] of Object.entries(languages)) {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = name;
        if (code === currentTarget) opt.selected = true;
        targetLangSelect.appendChild(opt);
      }
    } catch (e) {}
  }

  loadSupportedLanguages();
  updateCharCount();
});

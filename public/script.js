/**
 * script.js - Minimal Vanilla JavaScript for Frontend Interaction
 * College Semester Project: English-to-Hindi Translator
 * 
 * Responsibilities:
 * - Character count display
 * - Sending translation request to Python backend API
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
    statusBanner.className = "status-banner"; // normal error style
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
    
    // Warn if reaching limit
    if (currentLength >= MAX_CHARS) {
      charCount.style.color = "var(--error-text)";
    } else {
      charCount.style.color = "var(--text-muted)";
    }
  }

  inputText.addEventListener("input", () => {
    updateCharCount();
    if (statusBanner.classList.contains("hidden") === false) {
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
    // Swap dropdown values
    const currentSource = sourceLangSelect.value;
    const currentTarget = targetLangSelect.value;

    sourceLangSelect.value = currentTarget;
    targetLangSelect.value = currentSource;

    // Swap text values if output has a translation
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
        // Fallback for older browsers
        outputText.select();
        document.execCommand("copy");
      }

      // Visual feedback
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
  // 6. Translation Request (API Call)
  // --------------------------------------------------------------------------
  async function performTranslation() {
    const text = inputText.value.trim();
    const sourceLanguage = sourceLangSelect.value;
    const targetLanguage = targetLangSelect.value;

    // Validation
    if (!text) {
      showError("Please enter some text to translate.");
      inputText.focus();
      return;
    }

    if (text.length > MAX_CHARS) {
      showError(`Text is too long. Please shorten to under ${MAX_CHARS} characters.`);
      return;
    }

    // Prepare UI for loading state
    hideError();
    translateBtn.disabled = true;
    translateBtnText.textContent = "Translating...";
    outputText.placeholder = "Translating, please wait...";

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

      const data = await response.json();

      if (response.ok && data.translation) {
        outputText.value = data.translation;
      } else {
        const errorMsg = data.error || "Translation is temporarily unavailable. Please try again.";
        showError(errorMsg);
      }
    } catch (networkError) {
      // Clean, polite network failure message (no stack trace)
      showError("Unable to connect to the translation server. Please check your network connection.");
    } finally {
      // Restore UI state
      translateBtn.disabled = false;
      translateBtnText.textContent = "Translate";
      outputText.placeholder = "Your translation will appear here...";
    }
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
  // 7. Initialize Dynamic Languages from Backend (Optional enhancement)
  // --------------------------------------------------------------------------
  async function loadSupportedLanguages() {
    try {
      const res = await fetch("/api/languages");
      if (!res.ok) return;
      const data = await res.json();
      const languages = data.languages;

      if (!languages) return;

      // Remember current selections
      const currentSource = sourceLangSelect.value;
      const currentTarget = targetLangSelect.value;

      // Populate source dropdown
      sourceLangSelect.innerHTML = "";
      for (const [code, name] of Object.entries(languages)) {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = name;
        if (code === currentSource) opt.selected = true;
        sourceLangSelect.appendChild(opt);
      }

      // Populate target dropdown
      targetLangSelect.innerHTML = "";
      for (const [code, name] of Object.entries(languages)) {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = name;
        if (code === currentTarget) opt.selected = true;
        targetLangSelect.appendChild(opt);
      }
    } catch (e) {
      // If language API call fails, the hardcoded HTML defaults (English & Hindi) remain intact
    }
  }

  // Load languages on startup
  loadSupportedLanguages();
  updateCharCount();
});

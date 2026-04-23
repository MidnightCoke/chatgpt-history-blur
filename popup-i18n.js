const popupTitle = document.getElementById("popupTitle");
const popupSubtitle = document.getElementById("popupSubtitle");
const popupLabelText = document.getElementById("popupLabel");
const popupToggleHint = document.getElementById("popupToggleHint");
const pinnedLabelText = document.getElementById("pinnedLabel");
const pinnedHint = document.getElementById("pinnedHint");
const blurAmountLabelText = document.getElementById("blurAmountLabel");
const languageLabel = document.getElementById("languageLabel");
const footerText = document.getElementById("footerText");
const languageSelectElement = document.getElementById("languageSelect");
const blurAmountInput = document.getElementById("blurAmount");

let popupMessages = {};

function getPopupMessage(key, fallback = "") {
  return popupMessages[key]?.message || fallback || key;
}

async function loadPopupMessages(language) {
  const localesToTry = [language, "en"];

  for (const locale of localesToTry) {
    if (!locale) continue;

    try {
      const response = await fetch(
        chrome.runtime.getURL(`_locales/${locale}/messages.json`),
      );

      if (!response.ok) {
        throw new Error(`Failed to load locale ${locale}`);
      }

      popupMessages = await response.json();
      return;
    } catch {
      // Try the next locale.
    }
  }

  popupMessages = {};
}

function updatePopupBlurAmountLabel() {
  if (!blurAmountLabelText || !blurAmountInput) return;

  blurAmountLabelText.innerHTML = `${getPopupMessage("blurAmount", "Blur amount")}: <strong>${blurAmountInput.value}</strong>px`;
}

function applyPopupTranslations() {
  document.title = getPopupMessage("appName", "ChatGPT History Blur");

  if (popupTitle) {
    popupTitle.textContent = getPopupMessage("appName", "ChatGPT History Blur");
  }

  if (popupSubtitle) {
    popupSubtitle.textContent = getPopupMessage(
      "popupSubtitle",
      "Privacy controls for your sidebar chats",
    );
  }

  if (languageLabel) {
    languageLabel.textContent = getPopupMessage("language", "Language");
  }

  if (popupLabelText) {
    popupLabelText.textContent = getPopupMessage(
      "blurToggle",
      "Blur ChatGPT History",
    );
  }

  if (popupToggleHint) {
    popupToggleHint.textContent = getPopupMessage(
      "popupToggleHint",
      "Blur sidebar chats until you hover them",
    );
  }

  if (pinnedLabelText) {
    pinnedLabelText.textContent = getPopupMessage(
      "showPinnedChats",
      "Show pinned chats",
    );
  }

  if (pinnedHint) {
    pinnedHint.textContent = getPopupMessage(
      "pinnedToggleHint",
      "Keep pinned chats always visible",
    );
  }

  if (footerText) {
    footerText.textContent = getPopupMessage(
      "popupFooter",
      "Changes are saved automatically",
    );
  }

  updatePopupBlurAmountLabel();
}

async function initializePopupTranslations() {
  try {
    const result = await chrome.storage.local.get(["selected_language"]);
    const selectedLanguage =
      result.selected_language || chrome.i18n.getUILanguage().split("-")[0];

    if (languageSelectElement) {
      languageSelectElement.value = selectedLanguage;
    }

    await loadPopupMessages(selectedLanguage);
    applyPopupTranslations();
  } catch {
    applyPopupTranslations();
  }
}

if (blurAmountInput) {
  blurAmountInput.addEventListener("input", updatePopupBlurAmountLabel);
}

initializePopupTranslations();

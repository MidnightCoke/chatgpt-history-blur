const toggle = document.getElementById("toggle");
const pinnedToggle = document.getElementById("pinnedToggle");
const popupLabel = document.getElementById("popupLabel");
const pinnedLabel = document.getElementById("pinnedLabel");
const languageSelect = document.getElementById("languageSelect");

const BLUR_KEY_SETTINGS = "blur_settings";
const SHOW_PINNED_KEY = "show_pinned_chats";
const LANGUAGE_KEY = "selected_language";

popupLabel.textContent = chrome.i18n.getMessage("blurToggle");
pinnedLabel.textContent = chrome.i18n.getMessage("showPinnedChats");

chrome.storage.local.get([LANGUAGE_KEY], (res) => {
  const savedLanguage = res[LANGUAGE_KEY] || chrome.i18n.getUILanguage().split('-')[0];
  languageSelect.value = savedLanguage;
  chrome.storage.local.set({ [LANGUAGE_KEY]: savedLanguage });
});

chrome.storage.local.get([BLUR_KEY_SETTINGS], (res) => {
  toggle.checked = res[BLUR_KEY_SETTINGS] !== false;
});

chrome.storage.local.get([SHOW_PINNED_KEY], (res) => {
  pinnedToggle.checked = res[SHOW_PINNED_KEY] === true;
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [BLUR_KEY_SETTINGS]: toggle.checked });
});

pinnedToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SHOW_PINNED_KEY]: pinnedToggle.checked });
});

languageSelect.addEventListener("change", (e) => {
  const selectedLanguage = e.target.value;
  chrome.storage.local.set({ [LANGUAGE_KEY]: selectedLanguage });
  location.reload();
});
const toggle = document.getElementById("toggle");
const pinnedToggle = document.getElementById("pinnedToggle");
const blurAmountSlider = document.getElementById("blurAmount");
const popupLabel = document.getElementById("popupLabel");
const pinnedLabel = document.getElementById("pinnedLabel");
const blurAmountLabel = document.getElementById("blurAmountLabel");
const languageSelect = document.getElementById("languageSelect");

const BLUR_KEY_SETTINGS = "blur_settings";
const SHOW_PINNED_KEY = "show_pinned_chats";
const BLUR_AMOUNT_KEY = "blur_amount";
const LANGUAGE_KEY = "selected_language";

if (popupLabel) {
  popupLabel.textContent = chrome.i18n.getMessage("blurToggle");
}

if (pinnedLabel) {
  pinnedLabel.textContent = chrome.i18n.getMessage("showPinnedChats");
}

function updateBlurAmountLabel(amount) {
  if (!blurAmountLabel) return;
  blurAmountLabel.innerHTML = `${chrome.i18n.getMessage("blurAmount")}: <strong>${amount}</strong>px`;
}
updateBlurAmountLabel(3.5);

chrome.storage.local.get([LANGUAGE_KEY], (res) => {
  const savedLanguage =
    res[LANGUAGE_KEY] || chrome.i18n.getUILanguage().split("-")[0];
  if (languageSelect) {
    languageSelect.value = savedLanguage;
  }
  chrome.storage.local.set({ [LANGUAGE_KEY]: savedLanguage });
});

chrome.storage.local.get([BLUR_KEY_SETTINGS], (res) => {
  if (toggle) {
    toggle.checked = res[BLUR_KEY_SETTINGS] !== false;
  }
});

chrome.storage.local.get([SHOW_PINNED_KEY], (res) => {
  if (pinnedToggle) {
    pinnedToggle.checked = res[SHOW_PINNED_KEY] === true;
  }
});

if (toggle) {
  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ [BLUR_KEY_SETTINGS]: toggle.checked });
  });
}

if (pinnedToggle) {
  pinnedToggle.addEventListener("change", () => {
    chrome.storage.local.set({ [SHOW_PINNED_KEY]: pinnedToggle.checked });
  });
}

chrome.storage.local.get([BLUR_AMOUNT_KEY], (res) => {
  const amount = res[BLUR_AMOUNT_KEY] ?? 3.5;
  if (blurAmountSlider) {
    blurAmountSlider.value = amount;
  }
  updateBlurAmountLabel(amount);
});

if (blurAmountSlider) {
  blurAmountSlider.addEventListener("input", () => {
    const amount = parseFloat(blurAmountSlider.value);
    updateBlurAmountLabel(amount);
    chrome.storage.local.set({ [BLUR_AMOUNT_KEY]: amount });
  });
}

if (languageSelect) {
  languageSelect.addEventListener("change", (e) => {
    const selectedLanguage = e.target.value;
    chrome.storage.local.set({ [LANGUAGE_KEY]: selectedLanguage });
    location.reload();
  });
}

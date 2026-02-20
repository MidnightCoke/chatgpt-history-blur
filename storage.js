const BLUR_KEY_SETTINGS = "blur_settings";
const BLUR_KEY_CURRENT = "current_blur_state";
const LANGUAGE_KEY = "selected_language";
const SHOW_PINNED_KEY = "show_pinned_chats";
const BLUR_AMOUNT_KEY = "blur_amount";

const storage = {
  async getBlurSettings() {
    return this.getValue(BLUR_KEY_SETTINGS);
  },

  async setBlurSettings(value) {
    return this.setValue(BLUR_KEY_SETTINGS, value);
  },

  async getBlurState() {
    return this.getValue(BLUR_KEY_CURRENT);
  },

  setBlurState(value) {
    this.setValue(BLUR_KEY_CURRENT, value);
  },

  async getShowPinned() {
    return this.getValue(SHOW_PINNED_KEY, true);
  },

  setShowPinned(value) {
    this.setValue(SHOW_PINNED_KEY, value);
  },

  async getBlurAmount() {
    try {
      if (!chrome.runtime?.id) return 3.5;
      const res = await new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get([BLUR_AMOUNT_KEY], resolve);
        } catch (e) {
          reject(e);
        }
      });
      return res?.[BLUR_AMOUNT_KEY] ?? 3.5;
    } catch {
      return 3.5;
    }
  },

  setBlurAmount(value) {
    this.setValue(BLUR_AMOUNT_KEY, value);
  },

  async getValue(key, defaultValue = true) {
    try {
      if (!chrome.runtime?.id) return defaultValue;
      const res = await new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get([key], resolve);
        } catch (e) {
          reject(e);
        }
      });
      return res?.[key] !== false;
    } catch {
      return defaultValue;
    }
  },

  setValue(key, value) {
    try {
      if (!chrome.runtime?.id) return;
      chrome.storage.local.set({ [key]: value });
    } catch {
      // Extension context invalidated
    }
  }
};

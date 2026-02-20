function isContextValid() {
  return !!chrome.runtime?.id;
}

function setItemBlur(item, enabled, showPinned, blurAmount) {
  const isActive = item.hasAttribute("data-active");
  const isPinned = showPinned && item.getAttribute("draggable") === "false";
  item.style.filter = (!enabled || isActive || isPinned) ? "none" : `blur(${blurAmount}px)`;
}

let translations = {};

async function getTranslation(key) {
  try {
    const res = await new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(["selected_language"], resolve);
      } catch (e) {
        reject(e);
      }
    });

    const language = res.selected_language || chrome.i18n.getUILanguage().split('-')[0];

    if (!translations[language]) {
      try {
        const url = chrome.runtime.getURL(`_locales/${language}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status}`);
        }
        translations[language] = await response.json();
      } catch (e) {
        console.warn(`Could not load language ${language}, falling back to English`, e);
        try {
          const url = chrome.runtime.getURL(`_locales/en/messages.json`);
          const response = await fetch(url);
          translations[language] = await response.json();
        } catch (fallbackError) {
          console.error("Failed to load English fallback", fallbackError);
          return key;
        }
      }
    }

    return translations[language][key]?.message || key;
  } catch {
    return key;
  }
}

async function applyBlur() {
  const enabled = await storage.getBlurState();
  const showPinned = await storage.getShowPinned();
  const blurAmount = await storage.getBlurAmount();

  document.querySelectorAll("#history > a").forEach((item) => {
    setItemBlur(item, enabled, showPinned, blurAmount);

    if (item.dataset.blurListenerAttached) return;
    item.dataset.blurListenerAttached = "true";
    item.style.transition = "filter 0.2s ease";

    item.addEventListener("mouseenter", () => {
      const isBlurEnabled = item.dataset.blurEnabled === "true";
      if (isBlurEnabled && !item.hasAttribute("data-active")) {
        item.style.filter = "none";
      }
    });

    item.addEventListener("mouseleave", () => {
      const isBlurEnabled = item.dataset.blurEnabled === "true";
      const isPinnedShown = item.dataset.showPinned === "true";
      const amount = parseFloat(item.dataset.blurAmount) || 3.5;
      setItemBlur(item, isBlurEnabled, isPinnedShown, amount);
    });
  });

  document.querySelectorAll("#history > a").forEach((item) => {
    item.dataset.blurEnabled = enabled ? "true" : "false";
    item.dataset.showPinned = showPinned ? "true" : "false";
    item.dataset.blurAmount = blurAmount;
  });
}

async function injectToggleText() {
  if (document.querySelector(".blur-toggle-wrapper")) return;

  const historyEl = document.querySelector("#history");
  const asideEl = document.querySelector("aside");
  if (!historyEl || !historyEl.parentElement || !asideEl) return;

  const wrapper = document.createElement("button");
  wrapper.className = "blur-toggle-wrapper text-token-text-tertiary";
  wrapper.style.cssText = "display: flex; align-items: center; justify-content: flex-start; gap: 2px; width: 100%; padding-left: 1rem; padding-right: 1rem; padding-top: 0.375rem; padding-bottom: 0.375rem; border: none; background: none; cursor: pointer;";

  const toggle = document.createElement("span");
  toggle.className = "blur-toggle-text";
  toggle.style.cssText = "cursor: pointer; user-select: none; font-weight: bold; font-size: 1.5rem;";

  let currentState = await storage.getBlurState();
  const showText = await getTranslation("showChats");
  const hideText = await getTranslation("hideChats");
  toggle.textContent = currentState ? showText : hideText;

  toggle.addEventListener("mouseenter", () => {
    toggle.style.opacity = "1";
  });

  toggle.addEventListener("mouseleave", () => {
    toggle.style.opacity = "0.7";
  });

  toggle.addEventListener("click", async (e) => {
    e.stopPropagation();
    currentState = !currentState;
    storage.setBlurState(currentState);
    const updatedShowText = await getTranslation("showChats");
    const updatedHideText = await getTranslation("hideChats");
    toggle.textContent = currentState ? updatedShowText : updatedHideText;
    applyBlur();
  });

  wrapper.appendChild(toggle);
  historyEl.parentElement.insertBefore(wrapper, historyEl);

  let isInAside = false;
  const scrollport = document.querySelector("[role='region'][data-testid='scrollport']") || historyEl.closest(".overflow-y-auto") || document.querySelector(".flex-col.flex-1.overflow-hidden");
  
  if (scrollport) {
    scrollport.addEventListener("scroll", () => {
      const scrolled = scrollport.scrollTop > 150;
      
      if (scrolled && !isInAside) {
        wrapper.remove();
        asideEl.appendChild(wrapper);
        isInAside = true;
      } else if (!scrolled && isInAside) {
        wrapper.remove();
        historyEl.parentElement.insertBefore(wrapper, historyEl);
        isInAside = false;
      }
    });
  }
}

let injectTimeout;
const observer = new MutationObserver(() => {
  if (!isContextValid()) { observer.disconnect(); return; }
  clearTimeout(injectTimeout);
  injectTimeout = setTimeout(() => {
    injectToggleText();
    applyBlur();
  }, 300);
});

observer.observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isContextValid()) return;
  if (areaName !== 'local') return;

  if (changes.blur_amount || changes.show_pinned_chats || changes.blur_settings) {
    applyBlur();
  }

  if (changes.selected_language) {
    const toggleEl = document.querySelector(".blur-toggle-text");
    if (toggleEl) {
      getTranslation("showChats").then(showText => {
        getTranslation("hideChats").then(hideText => {
          const currentState = toggleEl.textContent === showText || toggleEl.textContent === "Show chats";
          toggleEl.textContent = currentState ? showText : hideText;
        });
      });
    }
  }
});

if (isContextValid()) {
  initBlurState().then(() => {
    injectToggleText();
    applyBlur();
  });
}

async function initBlurState() {
  const initial = await storage.getBlurSettings();
  storage.setBlurState(initial);
  return initial;
}

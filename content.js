function setItemBlur(item, enabled) {
  const isActive = item.hasAttribute("data-active");
  item.style.filter = (!enabled || isActive) ? "none" : "blur(3.2px)";
}

let translations = {};

async function getTranslation(key) {
  return new Promise(async (resolve) => {
    chrome.storage.local.get(["selected_language"], async (res) => {
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
            resolve(key);
            return;
          }
        }
      }
      
      resolve(translations[language][key]?.message || key);
    });
  });
}

async function applyBlur() {
  const enabled = await storage.getBlurState();

  document.querySelectorAll("#history > a").forEach((item) => {
    setItemBlur(item, enabled);
    item.dataset.blurEnabled = enabled ? "true" : "false";

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
      setItemBlur(item, isBlurEnabled);
    });
  });
}

let scrollListenerAttached = false;
let isInAside = false;

function attachScrollListener(wrapper, historyEl, asideEl) {
  if (scrollListenerAttached) return;

  const scrollport = document.querySelector("[role='region'][data-testid='scrollport']") || historyEl.closest(".overflow-y-auto") || document.querySelector(".flex-col.flex-1.overflow-hidden");
  if (!scrollport) return;

  scrollport.addEventListener("scroll", () => {
    const currentWrapper = document.querySelector(".blur-toggle-wrapper");
    const currentHistory = document.querySelector("#history");
    const currentAside = document.querySelector("aside");
    if (!currentWrapper || !currentHistory || !currentAside) return;

    const scrolled = scrollport.scrollTop > 150;

    if (scrolled && !isInAside) {
      currentWrapper.remove();
      currentAside.appendChild(currentWrapper);
      isInAside = true;
    } else if (!scrolled && isInAside) {
      currentWrapper.remove();
      currentHistory.parentElement.insertBefore(currentWrapper, currentHistory);
      isInAside = false;
    }
  });

  scrollListenerAttached = true;
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
  isInAside = false;

  attachScrollListener(wrapper, historyEl, asideEl);
}

let injectTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(injectTimeout);
  injectTimeout = setTimeout(() => {
    injectToggleText();
    applyBlur();
  }, 300);
});

const historyEl = document.querySelector("#stage-slideover-sidebar");
if (historyEl) {
  observer.observe(historyEl, { childList: true, subtree: true });
}


chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.selected_language) {
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

initBlurState().then(() => {
  injectToggleText();
  applyBlur();
});

async function initBlurState() {
  const initial = await storage.getBlurSettings();
  storage.setBlurState(initial);
  return initial;
}

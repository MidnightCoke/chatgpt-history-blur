function isContextValid() {
  return !!chrome.runtime?.id;
}

function setItemBlur(item, enabled, showPinned, blurAmount) {
  const isActive = !!item.closest("[data-active]");
  const isHovered = item.dataset.hovered === "true";

  if (isActive || isHovered) {
    item.style.filter = "none";
    return;
  }

  const isPinned = showPinned && isPinnedChatItem(item);

  item.style.filter = !enabled || isPinned ? "none" : `blur(${blurAmount}px)`;
}

function isPinnedChatItem(item) {
  const row = item.closest("li, div, a");
  if (!row) return false;

  const text = row.textContent?.toLowerCase() || "";

  return (
    text.includes("pinned") ||
    !!row.querySelector(
      '[data-testid*="pin"], [aria-label*="Pin"], [aria-label*="Pinned"]',
    )
  );
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

    const language =
      res.selected_language || chrome.i18n.getUILanguage().split("-")[0];

    if (!translations[language]) {
      try {
        const url = chrome.runtime.getURL(`_locales/${language}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status}`);
        }
        translations[language] = await response.json();
      } catch (e) {
        console.warn(
          `Could not load language ${language}, falling back to English`,
          e,
        );
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

    return (
      translations[language]?.[key]?.message ||
      translations.en?.[key]?.message ||
      key
    );
  } catch {
    return key;
  }
}

async function applyBlur() {
  const enabled = await storage.getBlurState();
  const showPinned = await storage.getShowPinned();
  const blurAmount = await storage.getBlurAmount();

  document.querySelectorAll('#history a[href^="/c/"]').forEach((item) => {
    setItemBlur(item, enabled, showPinned, blurAmount);

    if (item.dataset.blurListenerAttached) return;
    item.dataset.blurListenerAttached = "true";
    item.dataset.hovered = "false";
    item.style.transition = "filter 0.2s ease";

    item.addEventListener("pointerenter", () => {
      item.dataset.hovered = "true";
      const isBlurEnabled = item.dataset.blurEnabled === "true";
      const isActive = !!item.closest("[data-active]");

      if (isBlurEnabled && !isActive) {
        item.style.filter = "none";
      }
    });

    item.addEventListener("pointerleave", () => {
      item.dataset.hovered = "false";
      const isBlurEnabled = item.dataset.blurEnabled === "true";
      const isPinnedShown = item.dataset.showPinned === "true";
      const amount = parseFloat(item.dataset.blurAmount) || 3.5;
      setItemBlur(item, isBlurEnabled, isPinnedShown, amount);
    });
  });

  document.querySelectorAll('#history a[href^="/c/"]').forEach((item) => {
    item.dataset.blurEnabled = enabled ? "true" : "false";
    item.dataset.showPinned = showPinned ? "true" : "false";
    item.dataset.blurAmount = blurAmount;
    setItemBlur(item, enabled, showPinned, blurAmount);
  });
}

function getToggleHost() {
  const historyEl = document.querySelector("#history");
  if (historyEl?.parentElement) return historyEl.parentElement;

  return (
    document.querySelector("aside nav") ||
    document.querySelector("aside") ||
    null
  );
}

async function updateToggleLabel() {
  const toggleEl = document.querySelector(".blur-toggle-text");
  if (!toggleEl) return;

  const currentState = await storage.getBlurState();
  const showText = await getTranslation("showChats");
  const hideText = await getTranslation("hideChats");

  toggleEl.textContent = currentState ? showText : hideText;
}

async function injectToggleText() {
  const host = getToggleHost();
  if (!host) return;

  let wrapper = document.querySelector(".blur-toggle-wrapper");
  let toggle = document.querySelector(".blur-toggle-text");

  if (wrapper && !document.contains(wrapper)) {
    wrapper = null;
    toggle = null;
  }

  if (!wrapper) {
    wrapper = document.createElement("button");
    wrapper.className = "blur-toggle-wrapper";
    wrapper.type = "button";
    wrapper.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 2px;
      width: 100%;
      padding-left: 1rem;
      padding-right: 1rem;
      padding-top: 0.375rem;
      padding-bottom: 0.375rem;
      border: none;
      background: none;
      cursor: pointer;
      color: inherit;
      opacity: 1;
      visibility: visible;
      position: relative;
      z-index: 10;
    `;

    toggle = document.createElement("span");
    toggle.className = "blur-toggle-text";
    toggle.style.cssText = `
      cursor: pointer;
      user-select: none;
      font-weight: bold;
      font-size: 1.5rem;
      line-height: 1.2;
      color: inherit;
      opacity: 0.7;
      visibility: visible;
      display: inline-block;
    `;

    toggle.addEventListener("mouseenter", () => {
      toggle.style.opacity = "1";
    });

    toggle.addEventListener("mouseleave", () => {
      toggle.style.opacity = "0.7";
    });

    wrapper.addEventListener("click", async (e) => {
      e.stopPropagation();
      const currentState = await storage.getBlurState();
      const nextState = !currentState;
      await storage.setBlurState(nextState);
      await updateToggleLabel();
      await applyBlur();
    });

    wrapper.appendChild(toggle);
    let isInAside = false;

    const scrollport =
      document.querySelector("[role='region'][data-testid='scrollport']") ||
      document.querySelector("aside .overflow-y-auto") ||
      document.querySelector(".flex-col.flex-1.overflow-hidden");

    if (scrollport && !scrollport.dataset.blurToggleScrollBound) {
      scrollport.dataset.blurToggleScrollBound = "true";

      scrollport.addEventListener("scroll", () => {
        const historyEl = document.querySelector("#history");
        const historyHost = historyEl?.parentElement;
        const asideEl = document.querySelector("aside");

        if (!wrapper || !asideEl || !historyHost) return;

        const scrolled = scrollport.scrollTop > 150;

        if (scrolled && !isInAside) {
          wrapper.remove();
          asideEl.prepend(wrapper);
          isInAside = true;
        } else if (!scrolled && isInAside) {
          wrapper.remove();
          historyHost.insertBefore(wrapper, historyEl);
          isInAside = false;
        }
      });
    }
  }

  const historyEl = document.querySelector("#history");

  if (historyEl?.parentElement) {
    if (wrapper.parentElement !== historyEl.parentElement) {
      wrapper.remove();
      historyEl.parentElement.insertBefore(wrapper, historyEl);
    }
  } else if (wrapper.parentElement !== host) {
    wrapper.remove();
    host.insertBefore(wrapper, host.firstChild);
  }

  await updateToggleLabel();
}

let injectTimeout;
const observer = new MutationObserver(() => {
  if (!isContextValid()) {
    observer.disconnect();
    return;
  }

  clearTimeout(injectTimeout);
  injectTimeout = setTimeout(async () => {
    await injectToggleText();
    await applyBlur();
  }, 200);
});

observer.observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isContextValid()) return;
  if (areaName !== "local") return;

  if (
    changes.blur_amount ||
    changes.show_pinned_chats ||
    changes.blur_settings
  ) {
    applyBlur();
  }

  if (changes.selected_language || changes.blur_settings) {
    updateToggleLabel();
  }
});

if (isContextValid()) {
  initBlurState().then(async () => {
    await injectToggleText();
    await applyBlur();
  });
}

async function initBlurState() {
  const initial = await storage.getBlurSettings();
  await storage.setBlurState(initial);
  return initial;
}

function isContextValid() {
  return !!chrome.runtime?.id;
}

const SELECTORS = {
  history: "#history",
  historyItems: '#history a[href^="/c/"]',
  pinnedIndicators:
    '[data-testid*="pin"], [aria-label*="Pin"], [aria-label*="Pinned"]',
  toggleWrapper: ".blur-toggle-wrapper",
  toggleText: ".blur-toggle-text",
  toggleScrollSlot: ".blur-toggle-scroll-slot",
  topMenuList: "ul.m-0.list-none.p-0",
  chatHistoryNav: "nav[aria-label='Chat history']",
  scrolledSidebarContainer:
    "#stage-slideover-sidebar > div > div.opacity-100.motion-safe\\:transition-opacity.motion-safe\\:duration-150.motion-safe\\:ease-linear.h-full.w-\\(--sidebar-width\\).overflow-x-clip.overflow-y-auto.text-clip.whitespace-nowrap.bg-\\(--sidebar-surface-primary\\)",
  stickySidebarSection:
    "#stage-slideover-sidebar > div > div.opacity-100.motion-safe\\:transition-opacity.motion-safe\\:duration-150.motion-safe\\:ease-linear.h-full.w-\\(--sidebar-width\\).overflow-x-clip.overflow-y-auto.text-clip.whitespace-nowrap.bg-\\(--sidebar-surface-primary\\) > nav > div.pt-\\(--sidebar-section-first-margin-top\\).last\\:mb-5.bg-\\(--sidebar-surface-primary\\).tall\\:sticky.tall\\:top-header-height.tall\\:z-20.not-tall\\:relative.\\[--sticky-spacer\\:6px\\]",
  fallbackToggleHosts: ["aside nav", "aside"],
  fallbackScrollports: [
    "[role='region'][data-testid='scrollport']",
    "aside .overflow-y-auto",
    ".flex-col.flex-1.overflow-hidden",
  ],
};

function queryFirst(selectors, root = document) {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    const element = root.querySelector(selector);
    if (element) return element;
  }

  return null;
}

function queryAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function getHistoryElement() {
  return queryFirst(SELECTORS.history);
}

function getHistoryItems() {
  return queryAll(SELECTORS.historyItems);
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
    text.includes("pinned") || !!row.querySelector(SELECTORS.pinnedIndicators)
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

  getHistoryItems().forEach((item) => {
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

  getHistoryItems().forEach((item) => {
    item.dataset.blurEnabled = enabled ? "true" : "false";
    item.dataset.showPinned = showPinned ? "true" : "false";
    item.dataset.blurAmount = blurAmount;
    setItemBlur(item, enabled, showPinned, blurAmount);
  });
}

function getToggleHost() {
  const historyEl = getHistoryElement();
  if (historyEl?.parentElement) return historyEl.parentElement;

  return queryFirst(SELECTORS.fallbackToggleHosts);
}

function getScrolledToggleHost() {
  return queryFirst([
    SELECTORS.stickySidebarSection,
    ...SELECTORS.fallbackToggleHosts,
  ]);
}

function getScrolledToggleSlot(host) {
  if (!host) return null;

  let slot = host.querySelector(SELECTORS.toggleScrollSlot);
  if (slot) return slot;

  slot = document.createElement("div");
  slot.className = "blur-toggle-scroll-slot";
  slot.style.cssText = "width: 100%;";

  const topMenuList = host.querySelector(SELECTORS.topMenuList);

  if (topMenuList?.parentElement === host) {
    host.insertBefore(slot, topMenuList);
    return slot;
  }

  host.insertBefore(slot, host.firstChild);
  return slot;
}

function getToggleScrollport() {
  return queryFirst([
    SELECTORS.chatHistoryNav,
    SELECTORS.scrolledSidebarContainer,
    ...SELECTORS.fallbackScrollports,
  ]);
}

function isToggleScrollportScrolled(scrollport) {
  if (!scrollport) return false;

  if (scrollport.matches(SELECTORS.chatHistoryNav)) {
    return (
      scrollport.hasAttribute("data-scrolled-from-top") ||
      scrollport.scrollTop > 150
    );
  }

  return scrollport.scrollTop > 150;
}

function placeToggleWrapper(wrapper, fallbackHost) {
  const scrollport = getToggleScrollport();
  const scrolledHost = getScrolledToggleHost();
  const scrolledSlot = getScrolledToggleSlot(scrolledHost);
  const historyEl = getHistoryElement();
  const isScrolled = isToggleScrollportScrolled(scrollport);

  if (isScrolled && scrolledSlot) {
    if (wrapper.parentElement !== scrolledSlot) {
      wrapper.remove();
      scrolledSlot.appendChild(wrapper);
    }
    return;
  }

  if (historyEl?.parentElement) {
    if (wrapper.parentElement !== historyEl.parentElement) {
      wrapper.remove();
      historyEl.parentElement.insertBefore(wrapper, historyEl);
    }
    return;
  }

  if (fallbackHost && wrapper.parentElement !== fallbackHost) {
    wrapper.remove();
    fallbackHost.insertBefore(wrapper, fallbackHost.firstChild);
  }
}

async function updateToggleLabel() {
  const toggleEl = queryFirst(SELECTORS.toggleText);
  if (!toggleEl) return;

  const currentState = await storage.getBlurState();
  const showText = await getTranslation("showChats");
  const hideText = await getTranslation("hideChats");

  toggleEl.textContent = currentState ? showText : hideText;
}

async function injectToggleText() {
  const host = getToggleHost();
  if (!host) return;

  let wrapper = queryFirst(SELECTORS.toggleWrapper);
  let toggle = queryFirst(SELECTORS.toggleText);

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
    const scrollport = getToggleScrollport();

    if (scrollport && !scrollport.dataset.blurToggleScrollBound) {
      scrollport.dataset.blurToggleScrollBound = "true";

      scrollport.addEventListener("scroll", () => {
        const currentWrapper = queryFirst(SELECTORS.toggleWrapper);
        if (!currentWrapper) return;
        placeToggleWrapper(currentWrapper, host);
      });
    }
  }

  placeToggleWrapper(wrapper, host);

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

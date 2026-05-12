// ─── Page content extraction ──────────────────────────────────────────────────

function extractPageContent() {
  const title = document.title;
  const url = window.location.href;
  const metaDescription =
    document.querySelector('meta[property="og:description"]')?.content ||
    document.querySelector('meta[name="description"]')?.content || "";

  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map(h => h.innerText.trim())
    .filter(Boolean)
    .slice(0, 10);

  const mainEl =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.querySelector('[role="main"]') ||
    document.body;

  const clone = mainEl.cloneNode(true);
  clone.querySelectorAll("script, style, nav, footer, header, aside, [role=navigation], .cookie-banner, .ad, .advertisement")
    .forEach(el => el.remove());

  const rawText = clone.innerText || clone.textContent || "";
  // Strip null bytes and control chars (except tab/newline) that break JSON encoding
  const text = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return { title, url, metaDescription, headings, text, wordCount };
}

// ─── Screenshot capture coordination ─────────────────────────────────────────

let _savedScrollY = 0;
let _savedScrollEl = null;
let _savedScrollElY = 0;
let _hiddenFixedEls = [];
let _scrollEl = null; // the element we actually scroll during capture

// Find the real scrollable container of the page.
// Many SPAs (ChatGPT, Notion, etc.) scroll a div, not window.
function findScrollContainer() {
  const vph = window.innerHeight;

  // If the document itself scrolls, use window
  if (document.documentElement.scrollHeight > vph + 50) {
    return null; // null = use window
  }

  // Walk all elements, find the one with the most scrollable content
  let best = null;
  let bestHeight = vph + 50;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (el.scrollHeight <= bestHeight) continue;
    const style = window.getComputedStyle(el);
    const ov = style.overflowY;
    if (ov === "scroll" || ov === "auto") {
      bestHeight = el.scrollHeight;
      best = el;
    }
  }
  return best;
}

function prepareCapture() {
  _savedScrollY = window.scrollY;
  _scrollEl = findScrollContainer();

  if (_scrollEl) {
    _savedScrollElY = _scrollEl.scrollTop;
    _scrollEl.scrollTo(0, 0);
  } else {
    window.scrollTo(0, 0);
  }

  // Hide fixed/sticky UI (navbars, toolbars) that would stamp on every screenshot
  _hiddenFixedEls = [];
  document.querySelectorAll("*").forEach(el => {
    const style = window.getComputedStyle(el);
    if ((style.position === "fixed" || style.position === "sticky") &&
        style.display !== "none" &&
        el.offsetHeight > 0 &&
        el.offsetHeight < window.innerHeight * 0.3) {
      el.style.setProperty("visibility", "hidden", "important");
      _hiddenFixedEls.push(el);
    }
  });

  const pageHeight = _scrollEl
    ? _scrollEl.scrollHeight
    : Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

  return {
    pageHeight,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

function scrollToCapture(position) {
  if (_scrollEl) {
    _scrollEl.scrollTo(0, position);
  } else {
    window.scrollTo(0, position);
  }
}

function restoreAfterCapture() {
  _hiddenFixedEls.forEach(el => el.style.removeProperty("visibility"));
  _hiddenFixedEls = [];

  if (_scrollEl) {
    _scrollEl.scrollTo(0, _savedScrollElY);
    _scrollEl = null;
  } else {
    window.scrollTo(0, _savedScrollY);
  }
}

// ─── Print CSS injection ───────────────────────────────────────────────────────

function injectPrintStyles() {
  if (document.getElementById("__ai-pdf-print-styles")) return;
  const style = document.createElement("style");
  style.id = "__ai-pdf-print-styles";
  style.media = "print";
  style.textContent = `
    nav, header, footer, aside, .cookie-banner, .popup, .modal,
    [role=banner], [role=navigation], .ad, .advertisement, .sidebar,
    .sticky, [class*="cookie"], [class*="gdpr"], [id*="cookie"] {
      display: none !important;
    }
    body { font-size: 12pt; color: #000; background: #fff; }
    a { color: #000; text-decoration: underline; }
    img { max-width: 100%; page-break-inside: avoid; }
    h1, h2, h3 { page-break-after: avoid; }
    p { orphans: 3; widows: 3; }
  `;
  document.head.appendChild(style);
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ alive: true });
    return true;
  }

  if (request.action === "EXTRACT_CONTENT") {
    sendResponse(extractPageContent());
    return true;
  }

  if (request.action === "PREPARE_CAPTURE") {
    // Slight delay to let any animations settle after extension click
    setTimeout(() => sendResponse(prepareCapture()), 100);
    return true;
  }

  if (request.action === "SCROLL_TO_CAPTURE") {
    scrollToCapture(request.position);
    // Wait for scroll + lazy content to render before background captures
    setTimeout(() => sendResponse({ done: true }), request.delay || 350);
    return true;
  }

  if (request.action === "RESTORE_SCROLL") {
    restoreAfterCapture();
    sendResponse({ done: true });
    return true;
  }

  if (request.action === "SCROLL_TO") {
    window.scrollTo({ top: request.position, behavior: "smooth" });
    setTimeout(() => sendResponse({ done: true }), 400);
    return true;
  }

  if (request.action === "TRIGGER_PRINT") {
    injectPrintStyles();
    window.print();
    sendResponse({ done: true });
    return true;
  }
});

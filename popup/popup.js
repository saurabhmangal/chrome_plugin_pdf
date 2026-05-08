// ─── DOM refs ─────────────────────────────────────────────────────────────────
const pageUrlEl      = document.getElementById("pageUrl");
const noKeyWarning   = document.getElementById("noKeyWarning");
const openSettingsEl = document.getElementById("openSettings");
const settingsBtn    = document.getElementById("settingsBtn");

const pdfBtn         = document.getElementById("pdfBtn");
const pdfBtnLabel    = document.getElementById("pdfBtnLabel");
const pdfStatus      = document.getElementById("pdfStatus");

const summaryState   = document.getElementById("summaryState");
const redoSummaryBtn = document.getElementById("redoSummaryBtn");
const summarizeBtn   = document.getElementById("summarizeBtn"); // initial button (replaced after first summary)

const chatMessages   = document.getElementById("chatMessages");
const chatInput      = document.getElementById("chatInput");
const sendBtn        = document.getElementById("sendBtn");
const clearChatBtn   = document.getElementById("clearChatBtn");
const agentStatus    = document.getElementById("agentStatus");

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Show current page URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pageUrlEl.textContent = tab?.url || "";

  // Check if API key is configured
  const settings = await chrome.storage.sync.get(["aiProvider", "geminiKey", "anthropicKey", "openaiKey"]);
  const provider = settings.aiProvider || "gemini";
  const keyMap = { gemini: settings.geminiKey, anthropic: settings.anthropicKey, openai: settings.openaiKey };
  if (!keyMap[provider]) {
    noKeyWarning.classList.remove("hidden");
  }

  // Restore chat history display
  const { chatHistory } = await chrome.storage.session.get("chatHistory");
  if (chatHistory && chatHistory.length > 0) {
    renderChatHistory(chatHistory, provider);
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
openSettingsEl?.addEventListener("click", e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

// ─── Agent status listener (background pushes these) ──────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "AGENT_STATUS") {
    agentStatus.classList.remove("hidden");
    agentStatus.innerHTML = `<div class="spinner"></div><span>${escapeHtml(msg.step)}</span>`;
  }
});

// ─── PDF export ───────────────────────────────────────────────────────────────

pdfBtn.addEventListener("click", async () => {
  setPdfState("loading");
  agentStatus.classList.remove("hidden");
  agentStatus.innerHTML = `<div class="spinner"></div><span>Starting capture...</span>`;

  const res = await chrome.runtime.sendMessage({ action: "EXPORT_PDF" });

  agentStatus.classList.add("hidden");
  if (res.success) {
    setPdfState("done", `Saved: ${res.filename}`);
  } else {
    setPdfState("error", res.error);
  }
});

function setPdfState(state, msg = "") {
  pdfBtn.disabled = state === "loading";
  switch (state) {
    case "idle":
      pdfBtnLabel.textContent = "Export to PDF";
      pdfStatus.textContent = "";
      pdfStatus.className = "status-line";
      break;
    case "loading":
      pdfBtnLabel.textContent = "Exporting...";
      pdfStatus.textContent = "";
      pdfStatus.className = "status-line";
      break;
    case "done":
      pdfBtnLabel.textContent = "Export to PDF";
      pdfStatus.textContent = "✓ " + msg;
      pdfStatus.className = "status-line success";
      break;
    case "error":
      pdfBtnLabel.textContent = "Export to PDF";
      pdfStatus.textContent = "✗ " + msg;
      pdfStatus.className = "status-line error";
      break;
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

async function triggerSummarize() {
  setSummaryState("loading");
  redoSummaryBtn.disabled = true;
  agentStatus.classList.remove("hidden");
  agentStatus.innerHTML = `<div class="spinner"></div><span>Starting summary...</span>`;

  const res = await chrome.runtime.sendMessage({ action: "SUMMARIZE_PAGE" });

  agentStatus.classList.add("hidden");
  redoSummaryBtn.disabled = false;

  if (res.success) {
    setSummaryState("done", res.summary);
  } else {
    setSummaryState("error", res.error);
  }
}

// The initial "Generate Summary" button (shown before any summary)
document.addEventListener("DOMContentLoaded", () => {
  const initialBtn = document.getElementById("summarizeBtn");
  if (initialBtn) initialBtn.addEventListener("click", triggerSummarize);
});

redoSummaryBtn.addEventListener("click", triggerSummarize);

function setSummaryState(state, content = "") {
  summaryState.className = "content-area";
  switch (state) {
    case "idle":
      summaryState.innerHTML = `<button id="summarizeBtn" class="btn-secondary">Generate Summary</button>`;
      document.getElementById("summarizeBtn").addEventListener("click", triggerSummarize);
      break;
    case "loading":
      summaryState.classList.add("loading");
      summaryState.innerHTML = `<div class="spinner"></div><span>Generating summary...</span>`;
      break;
    case "done": {
      const div = document.createElement("div");
      div.className = "summary-text";
      div.innerHTML = simpleMarkdown(content);
      summaryState.innerHTML = "";
      summaryState.appendChild(div);
      break;
    }
    case "error":
      summaryState.innerHTML = content === "NO_API_KEY"
        ? `<span style="color:#ff3b30">No API key. <a href="#" id="fixKey">Open Settings →</a></span>`
        : `<span style="color:#ff3b30">Error: ${escapeHtml(content)}</span>`;
      document.getElementById("fixKey")?.addEventListener("click", e => {
        e.preventDefault(); chrome.runtime.openOptionsPage();
      });
      break;
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  setChatInputState(false);

  appendChatMessage("user", text);

  agentStatus.classList.remove("hidden");
  agentStatus.innerHTML = `<div class="spinner"></div><span>Thinking...</span>`;

  const res = await chrome.runtime.sendMessage({ action: "CHAT_MESSAGE", message: text });

  agentStatus.classList.add("hidden");
  setChatInputState(true);

  if (res.success) {
    appendChatMessage("ai", res.reply);
  } else {
    const errMsg = res.error === "NO_API_KEY"
      ? "No API key configured. Open Settings to add one."
      : "Error: " + res.error;
    appendChatMessage("ai", errMsg);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

clearChatBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "CLEAR_CHAT" });
  chatMessages.innerHTML = "";
});

function setChatInputState(enabled) {
  chatInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  if (enabled) chatInput.focus();
}

function appendChatMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "U" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = role === "ai" ? simpleMarkdown(text) : escapeHtml(text);

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatHistory(history, provider) {
  history.forEach(msg => {
    // Handle both flat { role, content } and Gemini { role, parts } shapes
    let role, text;
    if (msg.role === "user" || msg.role === "function") {
      role = "user";
      text = extractText(msg, provider);
    } else {
      role = "ai";
      text = extractText(msg, provider);
    }
    if (text) appendChatMessage(role, text);
  });
}

function extractText(msg, provider) {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter(b => b.type === "text").map(b => b.text).join("") ||
           msg.content.filter(b => b.type === "tool_result").map(b => b.content).join("");
  }
  if (msg.parts) return msg.parts.filter(p => p.text).map(p => p.text).join("");
  return "";
}

// ─── Minimal markdown renderer ────────────────────────────────────────────────

function simpleMarkdown(text) {
  return escapeHtml(text)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

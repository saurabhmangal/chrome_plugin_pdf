import {
  callGemini, callAnthropic, callOpenAI,
  normalizeResponse, buildToolResultMessage, toProviderMessage,
  TOOLS_GEMINI, TOOLS_ANTHROPIC, TOOLS_OPENAI
} from "../shared/ai.js";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about the content of webpages.
You have tools to read the current page. Always use get_page_content or get_page_metadata before answering — never rely on training memory alone.
When you have gathered enough information, use answer_from_content to deliver your final answer in clear, well-formatted markdown.
Be concise. Prefer bullet points for lists of facts.`;

const SUMMARIZE_MESSAGE = `Summarize this webpage. Include:
1. A one-sentence overview of what it is about
2. The 3-5 main points or key takeaways
3. Who the intended audience appears to be
Format your response as clean markdown.`;

// ─── Tool executor ─────────────────────────────────────────────────────────

async function executeTool(toolName, toolInput, tabId) {
  switch (toolName) {
    case "get_page_content": {
      const res = await chrome.tabs.sendMessage(tabId, { action: "EXTRACT_CONTENT" });
      return res.text;
    }
    case "get_page_metadata": {
      const res = await chrome.tabs.sendMessage(tabId, { action: "EXTRACT_CONTENT" });
      const { text, ...meta } = res;
      return JSON.stringify(meta, null, 2);
    }
    case "scroll_to_section": {
      await chrome.tabs.sendMessage(tabId, { action: "SCROLL_TO", position: toolInput.position_px });
      return `Scrolled to position ${toolInput.position_px}px`;
    }
    case "answer_from_content": {
      return { __final_answer: toolInput.answer };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ─── LLM dispatcher ────────────────────────────────────────────────────────

function getTools(provider) {
  if (provider === "gemini") return TOOLS_GEMINI;
  if (provider === "anthropic") return TOOLS_ANTHROPIC;
  return TOOLS_OPENAI;
}

async function callLLM(provider, systemPrompt, messages, apiKey) {
  const tools = getTools(provider);
  if (provider === "gemini") return callGemini(systemPrompt, messages, apiKey, tools);
  if (provider === "anthropic") return callAnthropic(systemPrompt, messages, apiKey, tools);
  return callOpenAI(systemPrompt, messages, apiKey, tools);
}

// ─── Agent loop ────────────────────────────────────────────────────────────

async function runAgentLoop(userMessage, chatHistory, tabId, provider, apiKey) {
  const MAX_ITERATIONS = 6;

  // Build initial messages in provider format
  const userMsg = toProviderMessage("user", userMessage, provider);
  const messages = [...chatHistory, userMsg];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    pushStatus(`AI thinking (step ${i + 1})...`, "ai_call");

    const raw = await callLLM(provider, SYSTEM_PROMPT, messages, apiKey);
    const normalized = normalizeResponse(raw, provider);

    // Append assistant/model turn
    const assistantMsg = { ...normalized.rawContent };
    if (provider === "gemini") {
      messages.push({ role: "model", parts: assistantMsg.parts || [{ text: normalized.textContent }] });
    } else if (provider === "anthropic") {
      messages.push({ role: "assistant", content: normalized.rawContent });
    } else {
      messages.push(normalized.rawContent);
    }

    if (!normalized.toolCalls || normalized.toolCalls.length === 0) {
      return { reply: normalized.textContent, messages };
    }

    // Execute tools
    const toolResults = [];
    for (const tc of normalized.toolCalls) {
      pushStatus(`Calling tool: ${tc.name}...`, "tool_call");
      const result = await executeTool(tc.name, tc.input, tabId);
      if (result && result.__final_answer) {
        return { reply: result.__final_answer, messages };
      }
      toolResults.push({ toolCallId: tc.id, toolName: tc.name, result: String(result) });
    }

    // Append tool results
    const resultMsg = buildToolResultMessage(toolResults, provider);
    if (Array.isArray(resultMsg)) {
      messages.push(...resultMsg);
    } else {
      messages.push(resultMsg);
    }
  }

  return {
    reply: "I reached the maximum thinking steps. Please try rephrasing your question.",
    messages
  };
}

function pushStatus(step, phase) {
  chrome.runtime.sendMessage({ action: "AGENT_STATUS", step, phase }).catch(() => {});
}

// ─── Chat history ──────────────────────────────────────────────────────────

async function getChatHistory() {
  const data = await chrome.storage.session.get("chatHistory");
  return data.chatHistory || [];
}

async function saveChatHistory(messages) {
  await chrome.storage.session.set({ chatHistory: messages.slice(-20) });
}

// ─── Settings helper ───────────────────────────────────────────────────────

async function getProviderAndKey() {
  const s = await chrome.storage.sync.get(["aiProvider", "geminiKey", "anthropicKey", "openaiKey"]);
  const provider = s.aiProvider || "gemini";
  const keyMap = { gemini: s.geminiKey, anthropic: s.anthropicKey, openai: s.openaiKey };
  return { provider, apiKey: keyMap[provider] };
}

// ─── PDF export — screenshot stitching ────────────────────────────────────────

async function handlePdfExport(tab, sendResponse) {
  const tabId = tab.id;

  try {
    pushStatus("Preparing page capture...", "extract");

    // 1. Scroll to top, hide fixed overlays, get page dimensions
    const dims = await chrome.tabs.sendMessage(tabId, { action: "PREPARE_CAPTURE" });
    const { pageHeight, viewportHeight, viewportWidth } = dims;

    const screenshots = [];
    let scrollY = 0;
    let pageNum = 0;
    const MAX_PAGES = 50; // safety cap — ~50 screens

    // 2. Screenshot loop: scroll → wait → capture
    while (scrollY < pageHeight && pageNum < MAX_PAGES) {
      pageNum++;
      pushStatus(`Capturing screen ${pageNum}...`, "extract");

      await chrome.tabs.sendMessage(tabId, {
        action: "SCROLL_TO_CAPTURE",
        position: scrollY,
        // Give extra time on first scroll, less on subsequent ones
        delay: pageNum === 1 ? 500 : 300
      });

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: 92
      });

      screenshots.push(dataUrl);
      scrollY += viewportHeight;
    }

    // 3. Restore page scroll position and show fixed elements again
    await chrome.tabs.sendMessage(tabId, { action: "RESTORE_SCROLL" });

    // Height of the last slice (may be shorter than a full viewport)
    const remainder = pageHeight % viewportHeight;
    const lastSliceHeight = remainder > 0 ? remainder : viewportHeight;

    pushStatus(`Stitching ${screenshots.length} screens into PDF...`, "ai_call");

    // 4. Stitch screenshots into PDF via offscreen document
    const pdfBase64 = await stitchViaOffscreen(
      screenshots, viewportWidth, viewportHeight, lastSliceHeight
    );

    // 5. Download
    const filename = sanitizeFilename(tab.title) + "-" + Date.now() + ".pdf";
    await chrome.downloads.download({
      url: "data:application/pdf;base64," + pdfBase64,
      filename
    });

    sendResponse({ success: true, filename });
  } catch (err) {
    // Fallback: restore scroll even on error
    try { await chrome.tabs.sendMessage(tabId, { action: "RESTORE_SCROLL" }); } catch (_) {}
    sendResponse({ success: false, error: err.message });
  }
}

async function stitchViaOffscreen(screenshots, vpWidth, vpHeight, lastSliceHeight) {
  const offscreenUrl = chrome.runtime.getURL("offscreen/offscreen.html");

  // Create offscreen document if it doesn't exist yet
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ["DOM_SCRAPING"],
      justification: "Stitch screenshots into PDF using jsPDF"
    });
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "STITCH_PDF",
      screenshots,
      viewportWidth: vpWidth,
      viewportHeight: vpHeight,
      lastSliceHeight
    }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.success) {
        resolve(response.base64);
      } else {
        reject(new Error(response?.error || "PDF stitching failed"));
      }
    });
  });
}

// ─── Summarize ─────────────────────────────────────────────────────────────

async function handleSummarize(tab, sendResponse) {
  const { provider, apiKey } = await getProviderAndKey();
  if (!apiKey) { sendResponse({ success: false, error: "NO_API_KEY" }); return; }

  try {
    pushStatus("Extracting page content...", "extract");
    const { reply } = await runAgentLoop(SUMMARIZE_MESSAGE, [], tab.id, provider, apiKey);
    sendResponse({ success: true, summary: reply });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ─── Chat ──────────────────────────────────────────────────────────────────

async function handleChat(message, tab, sendResponse) {
  const { provider, apiKey } = await getProviderAndKey();
  if (!apiKey) { sendResponse({ success: false, error: "NO_API_KEY" }); return; }

  try {
    const history = await getChatHistory();
    const { reply, messages } = await runAgentLoop(message, history, tab.id, provider, apiKey);
    await saveChatHistory(messages);
    sendResponse({ success: true, reply });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ─── Validate key ──────────────────────────────────────────────────────────

async function handleValidateKey(provider, apiKey, sendResponse) {
  try {
    if (provider === "gemini") {
      const model = "gemini-1.5-flash-latest";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] })
        }
      );
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Status ${res.status}`); }
      sendResponse({ success: true, model });
    } else if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Status ${res.status}`); }
      sendResponse({ success: true, model: "claude-haiku-4-5-20251001" });
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Status ${res.status}`); }
      sendResponse({ success: true, model: "gpt-4o" });
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────

function sanitizeFilename(title) {
  return (title || "page")
    .replace(/[^a-z0-9\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "page";
}

// ─── Message router ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXPORT_PDF") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => handlePdfExport(tab, sendResponse));
    return true;
  }
  if (request.action === "SUMMARIZE_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => handleSummarize(tab, sendResponse));
    return true;
  }
  if (request.action === "CHAT_MESSAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => handleChat(request.message, tab, sendResponse));
    return true;
  }
  if (request.action === "CLEAR_CHAT") {
    chrome.storage.session.remove("chatHistory");
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "VALIDATE_API_KEY") {
    handleValidateKey(request.provider, request.apiKey, sendResponse);
    return true;
  }
});

# Schema Reference — AI Webpage PDF Assistant

> See [architecture.png](architecture.png) for a full visual overview.

---

## Message Passing Contracts

All inter-component messages follow `{ action, ...payload }` → `{ success, ...data }`.

### Popup → Background

| action | payload | response |
|---|---|---|
| `EXPORT_PDF` | — | `{ success, filename }` |
| `SUMMARIZE_PAGE` | — | `{ success, summary }` |
| `CHAT_MESSAGE` | `{ message: string }` | `{ success, reply }` |
| `CLEAR_CHAT` | — | `{ success }` |
| `VALIDATE_API_KEY` | `{ provider, apiKey }` | `{ success, model? }` |

### Background → Popup (unsolicited push)

| action | payload | purpose |
|---|---|---|
| `AGENT_STATUS` | `{ step: string, phase: string }` | Live progress during agent loop (spinner) |

### Background → Content Script

| action | payload | response |
|---|---|---|
| `PING` | — | `{ alive: true }` |
| `EXTRACT_CONTENT` | — | `{ title, url, text, headings, metaDescription, wordCount }` |
| `PREPARE_CAPTURE` | — | `{ pageHeight, viewportHeight, viewportWidth, devicePixelRatio }` |
| `SCROLL_TO_CAPTURE` | `{ position, delay? }` | `{ done: true }` |
| `RESTORE_SCROLL` | — | `{ done: true }` |
| `SCROLL_TO` | `{ position }` | `{ done: true }` |
| `TRIGGER_PRINT` | — | `{ done: true }` |

### Background → Offscreen Document

| action | payload | response |
|---|---|---|
| `STITCH_PDF` | `{ screenshots[], viewportWidth, viewportHeight, lastSliceHeight }` | `{ success, base64 }` |

---

## Chrome Storage Schema

### `chrome.storage.sync` — persists across sessions and devices

```js
{
  aiProvider:    "gemini" | "anthropic" | "openai" | "mistral",
  geminiKey:     string,   // AIza...
  anthropicKey:  string,   // sk-ant-...
  openaiKey:     string,   // sk-...
  mistralKey:    string    // uuO...
}
```

### `chrome.storage.session` — cleared when browser closes (chat is page-specific)

```js
{
  chatHistory: Message[]   // last 20 messages in provider format
}
```

---

## LLM Provider Message Formats

### Gemini (`v1beta`)

```js
// User message
{ role: "user",  parts: [{ text: string }] }

// Model message (may contain functionCall)
{ role: "model", parts: [{ text?: string }, { functionCall?: { name, args } }] }

// Tool result (response to functionCall)
{ role: "user",  parts: [{ functionResponse: { name, response: { result: string } } }] }
```

### Anthropic

```js
// User message
{ role: "user",    content: string | ContentBlock[] }

// Assistant message (may contain tool_use blocks)
{ role: "assistant", content: ContentBlock[] }
// ContentBlock: { type: "text", text } | { type: "tool_use", id, name, input }

// Tool result
{ role: "user", content: [{ type: "tool_result", tool_use_id, content: string }] }
```

### OpenAI / Mistral (identical shape)

```js
// User message
{ role: "user",      content: string }

// Assistant message (may contain tool_calls)
{ role: "assistant", content: string | null, tool_calls?: ToolCall[] }
// ToolCall: { id, type: "function", function: { name, arguments: string (JSON) } }

// Tool result
{ role: "tool", tool_call_id: string, content: string }
```

---

## Tool Definitions

All tools are defined in [`shared/ai.js`](shared/ai.js) and converted per-provider.

| Tool | Input schema | Purpose |
|---|---|---|
| `get_page_content` | `{}` | Returns full page text (8,000 char limit) |
| `get_page_metadata` | `{}` | Returns title, URL, headings, word count (lightweight) |
| `scroll_to_section` | `{ position_px: number }` | Scrolls page to a vertical offset |
| `export_pdf` | `{}` | Captures screenshots, stitches via jsPDF, downloads file |
| `answer_from_content` | `{ answer: string }` | **Terminal tool** — delivers final answer, stops agent loop |

---

## Agent Loop State Machine

```
runAgentLoop(userMessage, chatHistory, tab, provider, apiKey)
│
├─ Append userMessage to messages[]
│
└─ Loop (max 8 iterations):
   │
   ├─ callLLM(provider, SYSTEM_PROMPT, messages, apiKey)
   │      └─ Returns raw response
   │
   ├─ normalizeResponse(raw, provider)
   │      └─ { rawContent, textContent, toolCalls[] }
   │
   ├─ Append assistant/model turn to messages[]
   │
   ├─ If no toolCalls → return textContent as reply  ✓ EXIT
   │
   ├─ For each toolCall:
   │   ├─ executeTool(name, input, tab)
   │   │   ├─ get_page_content  → chrome.tabs.sendMessage EXTRACT_CONTENT
   │   │   ├─ get_page_metadata → chrome.tabs.sendMessage EXTRACT_CONTENT (no text)
   │   │   ├─ scroll_to_section → chrome.tabs.sendMessage SCROLL_TO
   │   │   ├─ export_pdf        → exportPdfCore(tab) → screenshots → jsPDF → download
   │   │   └─ answer_from_content → { __final_answer: answer }  ✓ EXIT
   │   │
   │   └─ Collect toolResult string
   │
   └─ buildToolResultMessage(toolResults, provider)
          └─ Append to messages[], continue loop
```

---

## PDF Export Pipeline

```
handlePdfExport(tab)  OR  executeTool("export_pdf", {}, tab)
         │
         └─ exportPdfCore(tab)
              │
              ├─ ensureContentScript(tabId)
              ├─ PREPARE_CAPTURE  → { pageHeight, viewportHeight, viewportWidth }
              │
              ├─ Loop (max 50 screens, ≥650ms/screen to stay under 2 cap/sec quota):
              │   ├─ SCROLL_TO_CAPTURE  (400ms delay for lazy content)
              │   ├─ captureVisibleTab  (JPEG quality 92)
              │   └─ sleep(250ms)        ← rate-limit buffer
              │
              ├─ RESTORE_SCROLL
              ├─ Compute lastSliceHeight = pageHeight % viewportHeight
              │
              └─ stitchViaOffscreen(screenshots, vpW, vpH, lastSliceHeight)
                   │
                   └─ STITCH_PDF → offscreen.js
                        ├─ Load images, compute pt dimensions (72/96)
                        ├─ new jsPDF({ format: [pageW, pageH] })
                        ├─ addImage() for each screenshot
                        ├─ Crop last page if partial
                        └─ Return base64 → chrome.downloads.download()
```

---

## Content Extraction Schema

Returned by `extractPageContent()` in `content.js`:

```ts
{
  title:           string,    // document.title
  url:             string,    // window.location.href
  metaDescription: string,    // og:description or meta[name=description]
  headings:        string[],  // h1/h2/h3 text, max 10, trimmed
  text:            string,    // main/article body, max 8,000 chars, control chars stripped
  wordCount:       number
}
```

Text extraction priority: `<main>` → `<article>` → `[role="main"]` → `<body>`.  
Stripped elements: `script, style, nav, footer, header, aside, [role=navigation], .cookie-banner, .ad`.

---

## File Structure

```
chrome_plugin_pdf/
├── manifest.json          — MV3 manifest, permissions, entry points
├── background/
│   └── background.js      — Service worker: agent loop, PDF export, message router
├── content/
│   └── content.js         — Page context: DOM extraction, scroll control
├── popup/
│   ├── popup.html
│   ├── popup.js           — UI state machine, chat renderer
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js         — API key config + VALIDATE_API_KEY
│   └── options.css
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js       — jsPDF stitching
├── shared/
│   └── ai.js              — LLM clients + tool defs + normalizers
├── lib/
│   └── jspdf.umd.min.js   — Bundled locally (no CDN)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── architecture.png        — Architecture diagram (1920×1080)
├── SCHEMA.md               — This file
└── README.md
```

# Schema Reference — AI Webpage PDF Assistant

> Developer reference only. The user-facing plugin experience is described in `README.md`.

See the architecture overview in [architecture.png](architecture.png).

---

## Message Passing Contracts

All internal messages use the shape `{ action, ...payload }` and return `{ success, ...data }`.

### Popup → Background

| action | payload | response |
|---|---|---|
| `EXPORT_PDF` | — | `{ success, filename }` |
| `SUMMARIZE_PAGE` | — | `{ success, summary }` |
| `CHAT_MESSAGE` | `{ message: string }` | `{ success, reply }` |
| `CLEAR_CHAT` | — | `{ success }` |
| `VALIDATE_API_KEY` | `{ provider, apiKey }` | `{ success, model? }` |

### Background → Popup (unsolicited)

| action | payload | purpose |
|---|---|---|
| `AGENT_STATUS` | `{ step: string, phase: string }` | Progress updates for the popup spinner |

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

### `chrome.storage.sync`

Stores persistent provider settings and API keys.

```js
{
  aiProvider:    "gemini" | "anthropic" | "openai" | "mistral",
  geminiKey:     string,
  anthropicKey:  string,
  openaiKey:     string,
  mistralKey:    string
}
```

### `chrome.storage.session`

Stores temporary page-specific chat history.

```js
{
  chatHistory: Message[]
}
```

---

## LLM Provider Message Formats

### Gemini (`v1beta`)

```js
{ role: "user", parts: [{ text: string }] }
{ role: "model", parts: [{ text?: string }, { functionCall?: { name, args } }] }
{ role: "user", parts: [{ functionResponse: { name, response: { result: string } } }] }
```

### Anthropic

```js
{ role: "user", content: string | ContentBlock[] }
{ role: "assistant", content: ContentBlock[] }
{ role: "user", content: [{ type: "tool_result", tool_use_id, content: string }] }
```

### OpenAI / Mistral

```js
{ role: "user", content: string }
{ role: "assistant", content: string | null, tool_calls?: ToolCall[] }
{ role: "tool", tool_call_id: string, content: string }
```

---

## Tool Definitions

Defined in [`shared/ai.js`](shared/ai.js); these names are converted per provider.

| Tool | Input schema | Purpose |
|---|---|---|
| `get_page_content` | `{}` | Return page text payload (up to 8,000 chars) |
| `get_page_metadata` | `{}` | Return title, URL, headings, word count |
| `scroll_to_section` | `{ position_px: number }` | Scroll page to a vertical offset |
| `export_pdf` | `{}` | Capture screenshots, stitch PNGs into PDF |
| `answer_from_content` | `{ answer: string }` | Terminal response tool that ends the loop |

---

## Agent Loop State Machine

The background worker runs a bounded loop to process LLM replies and tool calls.

```text
runAgentLoop(userMessage, chatHistory, tab, provider, apiKey)
  ├─ build messages[]
  ├─ callLLM(provider, messages)
  ├─ normalizeResponse(raw, provider)
  ├─ append assistant/model turn
  ├─ if no toolCalls → reply and exit
  ├─ execute each toolCall
  └─ append tool results, continue (max 8 iterations)
```

Tool execution includes:
- `get_page_content` → content script `EXTRACT_CONTENT`
- `get_page_metadata` → content script `EXTRACT_CONTENT`
- `scroll_to_section` → content script `SCROLL_TO`
- `export_pdf` → PDF capture pipeline
- `answer_from_content` → final answer and loop termination

---

## PDF Export Pipeline

```text
exportPdfCore(tab)
  ├─ ensure content script is ready
  ├─ PREPARE_CAPTURE → page / viewport metrics
  ├─ capture screens in a loop (rate-limited)
  ├─ RESTORE_SCROLL
  ├─ stitch screenshots in offscreen document
  └─ download PDF via chrome.downloads
```

Key constraints:
- `captureVisibleTab` rate-limited to ~2 calls/sec
- Screenshots are captured with a delay for lazy-loaded content
- Offscreen page stitches images with `jsPDF`

---

## Content Extraction Schema

Returned by `extractPageContent()` in `content.js`:

```ts
{
  title:           string,
  url:             string,
  metaDescription: string,
  headings:        string[],
  text:            string,
  wordCount:       number
}
```

Text priority: `<main>` → `<article>` → `[role="main"]` → `<body>`.
Stripped elements include `script`, `style`, `nav`, `footer`, `header`, `aside`, `[role=navigation]`, `.cookie-banner`, and `.ad`.

---

## File Structure

```
chrome_plugin_pdf/
├── manifest.json          — MV3 manifest, permissions, entry points
├── background/
│   └── background.js      — service worker: agent loop, PDF export, message router
├── content/
│   └── content.js         — page context: DOM extraction, scroll control
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
│   └── ai.js              — LLM clients, tool defs, normalizers
├── lib/
│   └── jspdf.umd.min.js   — bundled locally (no CDN)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── architecture.png        — architecture diagram
├── SCHEMA.md               — developer schema reference
└── README.md
```

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

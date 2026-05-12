# AI Webpage PDF Assistant — Chrome Extension

A Manifest V3 Chrome plugin that runs entirely inside the browser and turns the current tab into an AI-aware productivity tool.

Use it to export perfect full-page PDFs, generate AI summaries of any webpage, and ask context-aware questions about the page content — all without a backend server.

---

## About this plugin

This Chrome extension is designed as a lightweight browser plugin rather than a remote service:

- It appears in the Chrome toolbar as a popup UI
- It uses the active tab's content and DOM context directly
- It supports multiple LLM providers via API keys stored in Chrome sync storage
- It exports PDFs using screenshot stitching and jsPDF from an offscreen document

---

## Architecture

![Architecture diagram](architecture.png)

> For implementation contracts, message schemas, and tool definitions, see **[SCHEMA.md](SCHEMA.md)**.

### How it works

1. The user asks the extension for a summary, PDF, or chat response.
2. The popup sends the request to the background service worker.
3. The worker runs the agent loop and calls the selected LLM provider.
4. The extension executes page tools such as content extraction, scrolling, and PDF export.
5. The result is shown in the popup; PDF output is downloaded automatically.

---

## Key Features

| Feature | What it does |
|---|---|
| **Browser plugin** | Works from the Chrome toolbar on the active page |
| **Full-page PDF export** | Captures page screenshots and stitches them into a single PDF |
| **AI summary** | Reads page content and returns a concise markdown summary |
| **Page-aware chat** | Lets you ask questions about the current webpage context |
| **Multi-provider support** | Use Gemini, Claude, OpenAI GPT-4o, or Mistral with your own key |
| **SPA-friendly capture** | Detects custom scroll containers for modern web apps |

---

## Quick Start

### 1. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this folder

### 2. Add your API key

Click the **⚙ Settings** button in the popup and enter a key for your chosen provider.

| Provider | Get a key |
|---|---|
| Google Gemini | https://aistudio.google.com/app/apikey |
| Anthropic Claude | https://console.anthropic.com/settings/keys |
| OpenAI GPT-4o | https://platform.openai.com/api-keys |
| Mistral AI | https://console.mistral.ai/ |

Keys are stored in `chrome.storage.sync` and are only used locally by the extension.

### 3. Use it

- **Export PDF** — click the button and download the generated PDF
- **Generate Summary** — ask for a summary of the current page
- **Chat** — ask questions like _"What are the key points?"_ or _"Create a PDF and summary"_

---

## Project Structure

```
chrome_plugin_pdf/
├── manifest.json          — MV3 manifest
├── background/background.js   — service worker: agent loop and PDF export
├── content/content.js         — page DOM extraction, scroll control
├── popup/                     — toolbar popup UI
├── options/                   — API key settings page
├── offscreen/                 — jsPDF stitching in offscreen context
├── shared/ai.js               — LLM clients and tool definitions
├── lib/jspdf.umd.min.js       — local jsPDF bundle
├── architecture.png           — architecture diagram
└── SCHEMA.md                  — developer schema and contract reference
```

---

## Development Notes

- No build step required — the extension uses plain ES modules
- Reload the extension at `chrome://extensions` after editing files
- Inspect debug output:
  - Popup: right-click popup → Inspect
  - Service worker: `chrome://extensions` → Inspect views → Service Worker
  - Content script: DevTools on the target page
- PDF capture is rate-limited to avoid quota issues in `captureVisibleTab`

---

## License

MIT

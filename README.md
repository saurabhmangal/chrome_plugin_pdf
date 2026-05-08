# Chrome Plugin PDF - AI Webpage PDF Assistant

A Chrome extension that converts web pages to PDF with AI-powered content enhancement.

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/saurabhmangal/chrome_plugin_pdf.git
   cd chrome_plugin_pdf
   ```

2. **Install dependencies**
   ```bash
   uv sync
   ```

3. **Configure API Key**
   - Copy `.env.example` to `.env`
   - Get your Gemini API key from: https://aistudio.google.com/app/apikey
   - Add your key to `.env`:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

4. **Test your API key**
   ```bash
   uv run python test_gemini_key.py
   ```

## Development

- Virtual environment is managed by `uv`
- Dependencies are in `pyproject.toml`
- Use `uv run` to execute commands in the virtual environment

## Testing API Key

The `test_gemini_key.py` script provides a permanent solution to verify your Gemini API key:

- ✅ **Valid key**: Script confirms the key works
- ⚠️ **Quota exceeded**: Key is valid but you've hit rate limits (normal for free tier)
- ❌ **Invalid key**: Authentication failed

## Chrome Extension

This project will contain:
- Manifest file for Chrome extension
- Content scripts for webpage processing
- Background scripts for PDF generation
- AI integration for content enhancement

## License

MIT
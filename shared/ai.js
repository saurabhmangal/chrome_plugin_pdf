// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_DEFS = [
  {
    name: "get_page_content",
    description: "Returns the full visible text content of the current webpage (up to 15,000 characters). Use this to read what is on the page before answering questions about it.",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_page_metadata",
    description: "Returns lightweight metadata about the page: title, URL, word count, top headings, and meta description. Use when you only need structural info, not the full text.",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    name: "scroll_to_section",
    description: "Scrolls the page to a specific vertical position in pixels. Use to navigate long pages before extracting content from a specific section.",
    parameters: {
      type: "object",
      properties: {
        position_px: {
          type: "number",
          description: "Vertical scroll position in pixels from the top of the page"
        }
      },
      required: ["position_px"]
    }
  },
  {
    name: "answer_from_content",
    description: "Deliver your final answer to the user once you have gathered all necessary information. This ends the agent loop and the answer is shown directly to the user.",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description: "The complete answer to provide to the user, in markdown format"
        }
      },
      required: ["answer"]
    }
  }
];

// Gemini tool format: { function_declarations: [...] }
export const TOOLS_GEMINI = [{ function_declarations: TOOL_DEFS }];

// Anthropic tool format: input_schema instead of parameters
export const TOOLS_ANTHROPIC = TOOL_DEFS.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters
}));

// OpenAI tool format: { type: "function", function: { name, description, parameters } }
export const TOOLS_OPENAI = TOOL_DEFS.map(t => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.parameters }
}));

// ─── Gemini ───────────────────────────────────────────────────────────────────

export async function callGemini(systemPrompt, messages, apiKey, tools) {
  const model = "gemini-1.5-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages,
      tools: tools
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${response.status}`);
  }
  return response.json();
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

export async function callAnthropic(systemPrompt, messages, apiKey, tools) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: messages
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${response.status}`);
  }
  return response.json();
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

export async function callOpenAI(systemPrompt, messages, apiKey, tools) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      tools: tools,
      tool_choice: "auto",
      messages: [{ role: "system", content: systemPrompt }, ...messages]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${response.status}`);
  }
  return response.json();
}

// ─── Response normalizer ──────────────────────────────────────────────────────
// Converts all three providers into: { rawContent, textContent, toolCalls[] }

export function normalizeResponse(response, provider) {
  if (provider === "gemini") {
    const parts = response.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter(p => p.text);
    const funcParts = parts.filter(p => p.functionCall);
    return {
      rawContent: response.candidates[0].content,
      textContent: textParts.map(p => p.text).join(""),
      toolCalls: funcParts.map((p, i) => ({
        id: `gemini-tool-${i}`,
        name: p.functionCall.name,
        input: p.functionCall.args || {}
      }))
    };
  }

  if (provider === "anthropic") {
    const textBlock = response.content.find(b => b.type === "text");
    const toolBlocks = response.content.filter(b => b.type === "tool_use");
    return {
      rawContent: response.content,
      textContent: textBlock?.text || "",
      toolCalls: toolBlocks.map(b => ({ id: b.id, name: b.name, input: b.input }))
    };
  }

  // OpenAI
  const msg = response.choices[0].message;
  return {
    rawContent: msg,
    textContent: msg.content || "",
    toolCalls: (msg.tool_calls || []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments)
    }))
  };
}

// ─── Tool result message builder ──────────────────────────────────────────────

export function buildToolResultMessage(toolResults, provider) {
  if (provider === "gemini") {
    return {
      role: "function",
      parts: toolResults.map(r => ({
        functionResponse: {
          name: r.toolName,
          response: { result: r.result }
        }
      }))
    };
  }

  if (provider === "anthropic") {
    return {
      role: "user",
      content: toolResults.map(r => ({
        type: "tool_result",
        tool_use_id: r.toolCallId,
        content: r.result
      }))
    };
  }

  // OpenAI: one message per tool result
  return toolResults.map(r => ({
    role: "tool",
    tool_call_id: r.toolCallId,
    content: r.result
  }));
}

// ─── Message format helpers ───────────────────────────────────────────────────
// Gemini uses { role: "user"|"model", parts: [{text}] } instead of { role, content }

export function toProviderMessage(role, content, provider) {
  if (provider === "gemini") {
    const geminiRole = role === "assistant" ? "model" : role;
    if (typeof content === "string") {
      return { role: geminiRole, parts: [{ text: content }] };
    }
    // Already in Gemini format (from normalizeResponse rawContent)
    return { role: geminiRole, ...content };
  }
  return { role, content };
}

function normalizeBackendUrl(value) {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .replace(/\/+$/, "");

  if (!cleaned) {
    return "";
  }

  if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/i.test(cleaned)) {
    throw new Error(`EXPO_PUBLIC_BACKEND_URL 配置无效：${cleaned}`);
  }

  return cleaned;
}

const BACKEND_URL = normalizeBackendUrl(process.env.EXPO_PUBLIC_BACKEND_URL);

async function callLLM(body) {
  if (!BACKEND_URL) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL 未配置");
  }

  const response = await fetch(`${BACKEND_URL}/api/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`LLM proxy returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      payload?.detail ||
      text;
    throw new Error(`LLM proxy error (${response.status}): ${detail}`);
  }

  return payload;
}

export async function chatWithTools(messages, tools, { model, temperature, maxTokens } = {}) {
  const data = await callLLM({
    messages,
    tools: tools.map(toOpenAITool),
    tool_choice: "auto",
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens ?? 1024,
    ...(model ? { model } : {})
  });

  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("LLM returned empty response");
  }

  const toolCalls = (message.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments || "{}")
  }));

  return {
    content: message.content || "",
    toolCalls
  };
}

export async function simpleChat(messages, { model, temperature, maxTokens } = {}) {
  const data = await callLLM({
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 512,
    ...(model ? { model } : {})
  });

  return data.choices?.[0]?.message?.content || "";
}

function toOpenAITool(tool) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.parameters.type || "object",
        properties: tool.parameters.properties,
        required: tool.parameters.required || []
      }
    }
  };
}

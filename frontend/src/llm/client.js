const LLM_API_URL = process.env.EXPO_PUBLIC_LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const LLM_API_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY || '';
const LLM_MODEL = process.env.EXPO_PUBLIC_LLM_MODEL || 'deepseek-chat';

export async function chatWithTools(messages, tools, { model, temperature, maxTokens } = {}) {
  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || LLM_MODEL,
      messages,
      tools: tools.map(toOpenAITool),
      tool_choice: 'auto',
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message;

  if (!message) {
    throw new Error('LLM returned empty response');
  }

  const toolCalls = message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  })) || [];

  return {
    content: message.content || '',
    toolCalls,
  };
}

export async function simpleChat(messages, { model, temperature, maxTokens } = {}) {
  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || LLM_MODEL,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function toOpenAITool(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.parameters.type || 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    },
  };
}

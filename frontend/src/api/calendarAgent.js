import { formatDateTime } from "../types/schedule";

function normalizeApiUrl(value) {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .replace(/\/+$/, "");

  if (!cleaned) {
    return "http://127.0.0.1:8787";
  }

  if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/i.test(cleaned)) {
    throw new Error(`EXPO_PUBLIC_CALENDAR_API_URL 配置无效：${cleaned}`);
  }

  return cleaned;
}

const CALENDAR_API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_CALENDAR_API_URL || process.env.EXPO_PUBLIC_AGENT_URL
);

export async function runCalendarAgent({ messages = [], currentDate, timezone } = {}) {
  const response = await fetch(`${CALENDAR_API_URL}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      current_date: currentDate || formatDateTime(new Date()),
      timezone: timezone || "Asia/Shanghai"
    })
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Agent returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `Agent request failed (${response.status})`);
  }

  return {
    status: payload.status || "done",
    reply: payload.reply || "",
    assistant_message: payload.assistant_message || { role: "assistant", content: payload.reply || "" },
    tool_calls: payload.tool_calls || [],
    trace: payload.trace || []
  };
}

export async function executeAgentToolCalls() {
  return [];
}

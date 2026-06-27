export function normalizeApiUrl(value, name = "EXPO_PUBLIC_CALENDAR_API_URL") {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .replace(/\/+$/, "");

  if (!cleaned) {
    return "http://127.0.0.1:8787";
  }

  if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/i.test(cleaned)) {
    throw new Error(`${name} 配置无效：${cleaned}`);
  }

  return cleaned;
}

export const CALENDAR_API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_CALENDAR_API_URL ||
    process.env.EXPO_PUBLIC_AGENT_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL
);

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function requestJson(path, { method = "GET", body } = {}) {
  const response = await fetch(`${CALENDAR_API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`Calendar API returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
      }
      throw new Error(`Calendar API returned non-JSON: ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok) {
    const detail = payload?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || payload?.message || `Calendar API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail || payload;
    throw error;
  }
  return payload;
}

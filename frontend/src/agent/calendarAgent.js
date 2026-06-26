import {
  createSchedule as repoCreate,
  querySchedules,
  updateSchedule,
  deleteSchedule,
  checkConflict,
  getScheduleById
} from "../db/repository";
import {
  createSchedule,
  addMinutesToDateTime,
  getDayRange,
  normalizeRecurrence,
  normalizeReminderMinutes
} from "../types/schedule";
import { formatDateTime } from "../types/schedule";

const MAX_STEPS = 6;
const AGENT_URL = normalizeServiceUrl(process.env.EXPO_PUBLIC_AGENT_URL);

function normalizeServiceUrl(value) {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .replace(/\/+$/, "");

  if (!cleaned) {
    return "";
  }

  if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/i.test(cleaned)) {
    throw new Error(`EXPO_PUBLIC_AGENT_URL 配置无效：${cleaned}`);
  }

  return cleaned;
}

// ─── tool handlers ────────────────────────────────────────────────────────────

function getTodayRange() {
  return getDayRange(new Date());
}

function normalizeEventPayload(payload = {}) {
  const startTime = payload.start_time;
  return createSchedule({
    ...payload,
    end_time: payload.end_time || (startTime ? addMinutesToDateTime(startTime, 60) : undefined),
    all_day: Boolean(payload.all_day),
    description: payload.description || "",
    category: payload.category || "personal",
    participants: Array.isArray(payload.participants) ? payload.participants : [],
    location: payload.location || "",
    recurrence: normalizeRecurrence(payload.recurrence),
    reminder_minutes: normalizeReminderMinutes(payload.reminder_minutes)
  });
}

function compactSchedule(s) {
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    start_time: s.start_time,
    end_time: s.end_time,
    all_day: s.all_day,
    category: s.category,
    location: s.location,
    description: s.description
  };
}

async function handleCreateSchedule(args) {
  const schedule = normalizeEventPayload(args);
  if (!schedule.title || !schedule.start_time) {
    return {
      success: false,
      message: "缺少标题或开始时间",
      missing_fields: ["title", "start_time"].filter((f) => !schedule[f])
    };
  }

  const conflicts = args.allow_conflict
    ? []
    : await checkConflict(schedule.start_time, schedule.end_time);
  if (conflicts.length > 0) {
    return {
      success: false,
      message: "该时间段与已有日程冲突",
      conflicts: conflicts.map(compactSchedule),
      draft: compactSchedule(schedule),
      next_action: "用户确认仍要创建时，再次调用 create_schedule，并设置 allow_conflict: true"
    };
  }

  const created = await repoCreate(schedule);
  return { success: true, message: "日程创建成功", event: compactSchedule(created) };
}

async function handleQuerySchedules(args = {}) {
  const range =
    args.start_time || args.end_time
      ? { start_time: args.start_time, end_time: args.end_time }
      : getTodayRange();

  const schedules = await querySchedules({
    start_time: range.start_time,
    end_time: range.end_time,
    category: args.category,
    keyword: args.keyword
  });

  return {
    success: true,
    message: schedules.length ? `找到 ${schedules.length} 个日程` : "没有找到日程",
    events: schedules.map(compactSchedule)
  };
}

async function handleUpdateSchedule(args = {}) {
  if (!args.id) {
    return { success: false, message: "缺少要修改的日程 ID" };
  }

  const { id, ...updates } = args;

  if (updates.recurrence !== undefined) {
    updates.recurrence = normalizeRecurrence(updates.recurrence);
  }
  if (updates.reminder_minutes !== undefined) {
    updates.reminder_minutes = normalizeReminderMinutes(updates.reminder_minutes);
  }

  const nextStart = updates.start_time;
  const nextEnd = updates.end_time || (nextStart ? addMinutesToDateTime(nextStart, 60) : undefined);

  if (nextStart || nextEnd) {
    const existing = await getScheduleById(id);
    const conflicts = await checkConflict(
      nextStart || existing?.start_time,
      nextEnd || existing?.end_time,
      id
    );
    if (conflicts.length > 0) {
      return {
        success: false,
        message: "修改后的时间与已有日程冲突",
        conflicts: conflicts.map(compactSchedule)
      };
    }
    if (nextEnd) updates.end_time = nextEnd;
  }

  const updated = await updateSchedule(id, updates);
  if (!updated) {
    return { success: false, message: "未找到该日程" };
  }
  return { success: true, message: "日程修改成功", event: compactSchedule(updated) };
}

async function handleDeleteSchedule(args = {}) {
  if (!args.id) {
    return { success: false, message: "缺少要删除的日程 ID" };
  }
  const deleted = await deleteSchedule(args.id);
  return {
    success: Boolean(deleted),
    message: deleted ? "日程已删除" : "未找到该日程",
    event: compactSchedule(deleted)
  };
}

function parseLocalDateTime(value) {
  const date = new Date(String(value || "").replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`无效时间：${value}`);
  }
  return date;
}

function formatSlotDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function handleFindFreeSlots(args = {}) {
  if (!args.start_time || !args.end_time || !args.duration_minutes) {
    return {
      success: false,
      message: "缺少开始时间、结束时间或时长"
    };
  }

  const start = parseLocalDateTime(args.start_time);
  const end = parseLocalDateTime(args.end_time);
  const durationMinutes = Number(args.duration_minutes);
  const stepMinutes = Number(args.step_minutes || 30);
  const schedules = await querySchedules({
    start_time: args.start_time,
    end_time: args.end_time
  });
  const slots = [];

  for (const cursor = new Date(start); cursor < end; cursor.setMinutes(cursor.getMinutes() + stepMinutes)) {
    const slotEnd = new Date(cursor);
    slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);
    if (slotEnd > end) break;

    const startText = formatSlotDateTime(cursor);
    const endText = formatSlotDateTime(slotEnd);
    const hasConflict = schedules.some((schedule) => schedule.start_time < endText && schedule.end_time > startText);
    if (!hasConflict) {
      slots.push({ start_time: startText, end_time: endText });
    }
  }

  return {
    success: true,
    message: slots.length ? `找到 ${slots.length} 个空闲时间段` : "没有找到合适的空闲时间段",
    slots: slots.slice(0, 10)
  };
}

async function executeTool(toolCall) {
  const args = toolCall.arguments || {};
  switch (toolCall.name) {
    case "create_schedule":
      return handleCreateSchedule(args);
    case "query_schedules":
      return handleQuerySchedules(args);
    case "update_schedule":
      return handleUpdateSchedule(args);
    case "delete_schedule":
      return handleDeleteSchedule(args);
    case "find_free_slots":
      return handleFindFreeSlots(args);
    case "ask_user":
      return {
        success: true,
        status: "needs_user_input",
        question: args.question,
        reason: args.reason,
        missing_fields: args.missing_fields || [],
        candidates: args.candidates || []
      };
    default:
      return { success: false, message: `未知工具：${toolCall.name}` };
  }
}

// ─── agent loop ───────────────────────────────────────────────────────────────

/**
 * 运行日历 agent 一轮。
 *
 * @param {{
 *   messages: Array,
 *   currentDate?: string,
 *   timezone?: string
 * }} options
 * @returns {Promise<{
 *   status: "done" | "needs_user_input" | "tool_calls",
 *   reply: string,
 *   assistant_message: object,
 *   tool_calls: Array
 * }>}
 */
export async function runCalendarAgent({ messages = [], currentDate, timezone } = {}) {
  if (!AGENT_URL) {
    throw new Error("EXPO_PUBLIC_AGENT_URL 未配置");
  }

  const response = await fetch(`${AGENT_URL}/api/agent/run`, {
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

  const toolCalls = payload.tool_calls || [];
  const assistantMessage = payload.assistant_message || { role: "assistant", content: payload.reply || "" };

  if (payload.status === "done" || toolCalls.length === 0) {
    return {
      status: "done",
      reply: payload.reply || "",
      assistant_message: assistantMessage,
      tool_calls: []
    };
  }

  if (payload.status === "needs_user_input") {
    return {
      status: "needs_user_input",
      reply: payload.reply || "",
      assistant_message: assistantMessage,
      tool_calls: toolCalls
    };
  }

  return {
    status: "tool_calls",
    reply: payload.reply || "",
    assistant_message: assistantMessage,
    tool_calls: toolCalls
  };
}

/**
 * 执行 agent 返回的工具调用，返回 tool result messages。
 */
export async function executeAgentToolCalls(toolCalls = []) {
  const results = [];
  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall);
    results.push({
      role: "tool",
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: JSON.stringify(result)
    });
  }
  return results;
}

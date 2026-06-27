import { chatWithTools } from "../llm/client";
import { buildCalendarSystemPrompt, calendarTools } from "./calendarPrompt";
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
  const systemPrompt = buildCalendarSystemPrompt({
    currentDate: currentDate || formatDateTime(new Date()),
    timezone: timezone || "Asia/Shanghai"
  });

  const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];
  const response = await chatWithTools(fullMessages, calendarTools, { temperature: 0.1 });
  const toolCalls = response.toolCalls || [];
  const assistantMessage = {
    role: "assistant",
    content: response.content || "",
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments || {})
      }
    }))
  };

  if (toolCalls.length === 0) {
    return {
      status: "done",
      reply: response.content || "",
      assistant_message: { role: "assistant", content: response.content || "" },
      tool_calls: []
    };
  }

  const askUserCall = toolCalls.find((tc) => tc.name === "ask_user");
  if (askUserCall) {
    return {
      status: "needs_user_input",
      reply: askUserCall.arguments?.question || response.content || "",
      assistant_message: assistantMessage,
      tool_calls: toolCalls
    };
  }

  return {
    status: "tool_calls",
    reply: "",
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

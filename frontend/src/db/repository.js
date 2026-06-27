import {
  addMinutesToDateTime,
  createSchedule as buildSchedule,
  getDayRange,
  normalizeRecurrence,
  normalizeReminderMinutes
} from "../types/schedule";

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

function toSchedule(payload) {
  if (!payload) return null;
  return {
    ...payload,
    all_day: Boolean(payload.all_day),
    participants: Array.isArray(payload.participants) ? payload.participants : [],
    recurrence: normalizeRecurrence(payload.recurrence),
    reminder_minutes: normalizeReminderMinutes(payload.reminder_minutes)
  };
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function requestJson(path, { method = "GET", body } = {}) {
  const response = await fetch(`${CALENDAR_API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = payload?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || payload?.message || `Calendar API error (${response.status})`;
    const error = new Error(message);
    error.detail = detail || payload;
    throw error;
  }
  return payload;
}

export async function createSchedule(schedule) {
  const allowConflict = Boolean(schedule.allow_conflict);
  const payload = { ...schedule };
  delete payload.allow_conflict;
  const created = await requestJson(`/api/schedules${buildQuery({ allow_conflict: allowConflict || undefined })}`, {
    method: "POST",
    body: payload
  });
  return toSchedule(created);
}

export async function getScheduleById(id) {
  if (!id) return null;
  try {
    return toSchedule(await requestJson(`/api/schedules/${encodeURIComponent(id)}`));
  } catch (error) {
    if (String(error?.message || "").includes("not found") || error?.detail) {
      return null;
    }
    throw error;
  }
}

export async function querySchedules({
  start_time,
  end_time,
  startDate,
  endDate,
  category,
  keyword,
  participants
} = {}) {
  const rangeStart = start_time || startDate;
  const rangeEnd = end_time || endDate;
  const payload = await requestJson(
    `/api/schedules${buildQuery({
      start_time: rangeStart,
      end_time: rangeEnd,
      category,
      keyword
    })}`
  );
  let schedules = (payload?.events || payload || []).map(toSchedule);

  if (participants && participants.length > 0) {
    schedules = schedules.filter((schedule) =>
      participants.some((participant) => schedule.participants.some((item) => item.includes(participant)))
    );
  }

  return schedules;
}

export async function updateSchedule(id, updates) {
  if (!id) return null;
  try {
    return toSchedule(
      await requestJson(`/api/schedules/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: updates
      })
    );
  } catch (error) {
    if (error?.detail && !error.detail.conflicts) {
      return null;
    }
    throw error;
  }
}

export async function deleteSchedule(id) {
  if (!id) return null;
  try {
    return toSchedule(
      await requestJson(`/api/schedules/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })
    );
  } catch (error) {
    if (error?.detail) {
      return null;
    }
    throw error;
  }
}

export async function checkConflict(start_time, end_time, excludeId = null) {
  const schedules = await querySchedules({ start_time, end_time });
  return schedules.filter((schedule) => schedule.id !== excludeId);
}

export async function getSchedulesByDate(date) {
  const range = getDayRange(date);
  return querySchedules(range);
}

export async function seedTestSchedulesForDate(date) {
  const day = getDayRange(date).start_time.slice(0, 10);
  const samples = [
    {
      id: `test_${day}_standup`,
      title: "产品站会",
      start_time: `${day} 09:30`,
      end_time: `${day} 10:00`,
      category: "meeting",
      location: "会议室 A",
      participants: ["小林", "小陈"],
      reminder_minutes: 5
    },
    {
      id: `test_${day}_client`,
      title: "客户沟通",
      start_time: `${day} 11:00`,
      end_time: `${day} 12:00`,
      category: "work",
      description: "确认下周交付范围",
      reminder_minutes: 15
    },
    {
      id: `test_${day}_review`,
      title: "项目评审",
      start_time: `${day} 15:00`,
      end_time: `${day} 16:00`,
      category: "meeting",
      location: "线上会议",
      reminder_minutes: 30
    },
    {
      id: `test_${day}_ticket`,
      title: "抢票提醒",
      start_time: `${day} 23:00`,
      end_time: addMinutesToDateTime(`${day} 23:00`, 10),
      category: "reminder",
      description: "演唱会开票",
      reminder_minutes: 5
    }
  ];

  for (const sample of samples) {
    const existing = await getScheduleById(sample.id);
    if (!existing) {
      await createSchedule(buildSchedule(sample));
    }
  }
}

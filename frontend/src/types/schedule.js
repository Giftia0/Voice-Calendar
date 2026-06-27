/**
 * @typedef {'work'|'personal'|'meeting'|'reminder'|'travel'} ScheduleCategory
 * @typedef {'none'|'daily'|'weekly'|'monthly'|'yearly'} RecurrenceType
 * @typedef {'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'} Weekday
 *
 * @typedef {Object} RecurrenceRule
 * @property {RecurrenceType} type
 * @property {Weekday[]} weekdays
 * @property {boolean} skip_holidays
 *
 * @typedef {Object} Schedule
 * @property {string} id
 * @property {string} title
 * @property {string} start_time - Local date time: "YYYY-MM-DD HH:mm"
 * @property {string} end_time - Local date time: "YYYY-MM-DD HH:mm"
 * @property {boolean} all_day
 * @property {string} description
 * @property {ScheduleCategory} category
 * @property {string[]} participants
 * @property {string} location
 * @property {RecurrenceRule} recurrence
 * @property {number} reminder_minutes - Single reminder choice in minutes before event. 0 means on time; defaults to 5.
 */

export const CATEGORIES = ["work", "personal", "meeting", "reminder", "travel"];
export const REMINDER_OPTIONS = [0, 5, 15, 30, 60, 120, 1440, 2880, 4320, 10080];
export const DEFAULT_REMINDER_MINUTES = 5;

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

export const DEFAULT_RECURRENCE = {
  type: "none",
  weekdays: [],
  skip_holidays: false
};

const pad = (value) => String(value).padStart(2, "0");

export function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTime(value) {
  if (value instanceof Date) {
    return value;
  }

  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );
}

export function addMinutesToDateTime(value, minutes) {
  const date = parseDateTime(value) || new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return formatDateTime(date);
}

export function getDayRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return {
    start_time: formatDateTime(start),
    end_time: formatDateTime(end)
  };
}

export function normalizeRecurrence(recurrence = DEFAULT_RECURRENCE) {
  if (typeof recurrence === "string") {
    return {
      ...DEFAULT_RECURRENCE,
      type: recurrence || "none"
    };
  }

  if (!recurrence || typeof recurrence !== "object") {
    return DEFAULT_RECURRENCE;
  }

  return {
    type: recurrence.type || "none",
    weekdays: Array.isArray(recurrence.weekdays) ? recurrence.weekdays : [],
    skip_holidays: Boolean(recurrence.skip_holidays)
  };
}

export function normalizeReminderMinutes(value = DEFAULT_REMINDER_MINUTES) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return DEFAULT_REMINDER_MINUTES;
  }
  return REMINDER_OPTIONS.includes(minutes) ? minutes : DEFAULT_REMINDER_MINUTES;
}

export const createSchedule = ({
  id,
  title,
  start_time,
  end_time,
  all_day = false,
  description = "",
  category = "personal",
  participants = [],
  location = "",
  recurrence = DEFAULT_RECURRENCE,
  reminder_minutes
}) => {
  const normalizedStart = start_time;
  const normalizedEnd = end_time || addMinutesToDateTime(normalizedStart, 60);

  return {
    id: id || `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    start_time: normalizedStart,
    end_time: normalizedEnd,
    all_day,
    description,
    category,
    participants,
    location,
    recurrence: normalizeRecurrence(recurrence),
    reminder_minutes: normalizeReminderMinutes(reminder_minutes)
  };
};

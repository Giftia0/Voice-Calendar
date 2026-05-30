/**
 * @typedef {'work'|'personal'|'meeting'|'reminder'|'travel'} ScheduleCategory
 * @typedef {'manual'|'voice'|'external'} ScheduleSource
 *
 * @typedef {Object} Schedule
 * @property {string} id
 * @property {string} title
 * @property {number} start_time  - Unix timestamp (ms)
 * @property {number} end_time    - Unix timestamp (ms)
 * @property {boolean} all_day
 * @property {string} description
 * @property {ScheduleCategory} category
 * @property {string[]} participants
 * @property {string} location
 * @property {string} recurrence  - 'none' | 'daily' | 'weekly' | 'monthly' | custom rule string
 * @property {number[]} reminders - Array of minutes before event (e.g. [15, 60])
 * @property {ScheduleSource} source
 * @property {number} created_at  - Unix timestamp (ms)
 * @property {number} updated_at  - Unix timestamp (ms)
 */

export const CATEGORIES = ['work', 'personal', 'meeting', 'reminder', 'travel'];

export const createSchedule = ({
  title,
  start_time,
  end_time,
  all_day = false,
  description = '',
  category = 'personal',
  participants = [],
  location = '',
  recurrence = 'none',
  reminders = [],
  source = 'voice',
}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  title,
  start_time,
  end_time,
  all_day,
  description,
  category,
  participants,
  location,
  recurrence,
  reminders,
  source,
  created_at: Date.now(),
  updated_at: Date.now(),
});

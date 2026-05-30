import { getDatabase } from './database';

function rowToSchedule(row) {
  return {
    ...row,
    all_day: Boolean(row.all_day),
    participants: JSON.parse(row.participants || '[]'),
    reminders: JSON.parse(row.reminders || '[]'),
  };
}

function scheduleToRow(schedule) {
  return {
    ...schedule,
    all_day: schedule.all_day ? 1 : 0,
    participants: JSON.stringify(schedule.participants || []),
    reminders: JSON.stringify(schedule.reminders || []),
  };
}

export async function createSchedule(schedule) {
  const db = await getDatabase();
  const row = scheduleToRow(schedule);
  await db.runAsync(
    `INSERT INTO schedules (id, title, start_time, end_time, all_day, description, category, participants, location, recurrence, reminders, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id, row.title, row.start_time, row.end_time, row.all_day,
    row.description, row.category, row.participants, row.location,
    row.recurrence, row.reminders, row.source, row.created_at, row.updated_at
  );
  return schedule;
}

export async function getScheduleById(id) {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM schedules WHERE id = ?', id);
  return row ? rowToSchedule(row) : null;
}

export async function querySchedules({ startDate, endDate, category, keyword, participants } = {}) {
  const db = await getDatabase();
  const conditions = [];
  const params = [];

  if (startDate) {
    conditions.push('end_time >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('start_time <= ?');
    params.push(endDate);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (keyword) {
    conditions.push('(title LIKE ? OR description LIKE ? OR location LIKE ?)');
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern);
  }
  if (participants && participants.length > 0) {
    const participantConditions = participants.map(() => 'participants LIKE ?');
    conditions.push(`(${participantConditions.join(' OR ')})`);
    participants.forEach((p) => params.push(`%${p}%`));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.getAllAsync(
    `SELECT * FROM schedules ${where} ORDER BY start_time ASC`,
    ...params
  );
  return rows.map(rowToSchedule);
}

export async function updateSchedule(id, updates) {
  const db = await getDatabase();
  const existing = await getScheduleById(id);
  if (!existing) return null;

  const merged = { ...existing, ...updates, updated_at: Date.now() };
  const row = scheduleToRow(merged);
  await db.runAsync(
    `UPDATE schedules SET title=?, start_time=?, end_time=?, all_day=?, description=?, category=?, participants=?, location=?, recurrence=?, reminders=?, source=?, updated_at=? WHERE id=?`,
    row.title, row.start_time, row.end_time, row.all_day,
    row.description, row.category, row.participants, row.location,
    row.recurrence, row.reminders, row.source, row.updated_at, id
  );
  return merged;
}

export async function deleteSchedule(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM schedules WHERE id = ?', id);
}

export async function checkConflict(start_time, end_time, excludeId = null) {
  const db = await getDatabase();
  if (excludeId) {
    const rows = await db.getAllAsync(
      `SELECT * FROM schedules WHERE id != ? AND start_time < ? AND end_time > ?`,
      excludeId, end_time, start_time
    );
    return rows.map(rowToSchedule);
  }
  const rows = await db.getAllAsync(
    `SELECT * FROM schedules WHERE start_time < ? AND end_time > ?`,
    end_time, start_time
  );
  return rows.map(rowToSchedule);
}

export async function getSchedulesByDate(date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return querySchedules({ startDate: dayStart, endDate: dayEnd });
}

from __future__ import annotations

from datetime import datetime, timedelta

from .domain import ScheduleDraft, ScheduleQuery, compact_schedule, create_schedule, format_local_datetime, normalize_recurrence, parse_local_datetime
from .repository import ScheduleRepository, find_conflicts


class CalendarService:
    def __init__(self, repository: ScheduleRepository):
        self.repository = repository

    def create(self, draft: ScheduleDraft, allow_conflict: bool = False) -> dict:
        try:
            schedule = create_schedule(draft)
        except ValueError as exc:
            return {"success": False, "message": str(exc)}
        conflicts = [] if allow_conflict else find_conflicts(self.repository, schedule.start_time, schedule.end_time)
        if conflicts:
            return {
                "success": False,
                "message": "该时间段与已有日程冲突",
                "conflicts": [compact_schedule(item) for item in conflicts],
                "draft": compact_schedule(schedule),
                "next_action": "用户明确确认后，再使用相同字段并设置 allow_conflict=true",
            }
        created = self.repository.create(schedule)
        return {"success": True, "message": "日程创建成功", "event": created.model_dump()}

    def query(self, query: ScheduleQuery | None = None) -> dict:
        schedules = self.repository.list(query)
        return {
            "success": True,
            "message": f"找到 {len(schedules)} 个日程" if schedules else "没有找到日程",
            "events": [item.model_dump() for item in schedules],
        }

    def update(self, schedule_id: str, updates: dict) -> dict:
        existing = self.repository.get_by_id(schedule_id)
        if not existing:
            return {"success": False, "message": "未找到该日程"}

        next_start = updates.get("start_time") or existing.start_time
        next_end = updates.get("end_time") or existing.end_time
        conflicts = find_conflicts(self.repository, next_start, next_end, schedule_id)
        if conflicts:
            return {
                "success": False,
                "message": "修改后的时间与已有日程冲突",
                "conflicts": [compact_schedule(item) for item in conflicts],
            }

        if "recurrence" in updates:
            updates["recurrence"] = normalize_recurrence(updates["recurrence"]).model_dump()
        updates["updated_at"] = datetime.utcnow().isoformat()
        updated = self.repository.update(schedule_id, updates)
        return {"success": True, "message": "日程修改成功", "event": updated.model_dump()} if updated else {"success": False, "message": "未找到该日程"}

    def delete(self, schedule_id: str) -> dict:
        deleted = self.repository.delete(schedule_id)
        return {
            "success": bool(deleted),
            "message": "日程已删除" if deleted else "未找到该日程",
            "event": deleted.model_dump() if deleted else None,
        }

    def find_free_slots(self, start_time: str, end_time: str, duration_minutes: int, step_minutes: int = 30) -> dict:
        schedules = self.repository.list(ScheduleQuery(start_time=start_time, end_time=end_time))
        cursor = parse_local_datetime(start_time)
        end = parse_local_datetime(end_time)
        slots = []
        while cursor + timedelta(minutes=duration_minutes) <= end:
            slot_end = cursor + timedelta(minutes=duration_minutes)
            start_text = format_local_datetime(cursor)
            end_text = format_local_datetime(slot_end)
            has_conflict = any(item.start_time < end_text and item.end_time > start_text for item in schedules)
            if not has_conflict:
                slots.append({"start_time": start_text, "end_time": end_text})
            cursor += timedelta(minutes=step_minutes)
        return {
            "success": True,
            "message": f"找到 {len(slots)} 个空闲时间段" if slots else "没有找到合适的空闲时间段",
            "slots": slots[:10],
        }

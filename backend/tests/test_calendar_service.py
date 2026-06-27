from app.domain import ScheduleDraft
from app.repository import JsonScheduleRepository
from app.service import CalendarService


def test_create_rejects_conflict(tmp_path):
    service = CalendarService(JsonScheduleRepository(str(tmp_path)))
    created = service.create(
        ScheduleDraft(title="站会", start_time="2026-06-27 09:30", end_time="2026-06-27 10:00")
    )
    assert created["success"] is True

    conflict = service.create(
        ScheduleDraft(title="客户电话", start_time="2026-06-27 09:45", end_time="2026-06-27 10:30")
    )
    assert conflict["success"] is False
    assert "冲突" in conflict["message"]


def test_find_free_slots(tmp_path):
    service = CalendarService(JsonScheduleRepository(str(tmp_path)))
    service.create(ScheduleDraft(title="站会", start_time="2026-06-27 09:30", end_time="2026-06-27 10:00"))

    result = service.find_free_slots(
        start_time="2026-06-27 09:00",
        end_time="2026-06-27 11:00",
        duration_minutes=30,
        step_minutes=30,
    )

    assert result["slots"] == [
        {"start_time": "2026-06-27 09:00", "end_time": "2026-06-27 09:30"},
        {"start_time": "2026-06-27 10:00", "end_time": "2026-06-27 10:30"},
        {"start_time": "2026-06-27 10:30", "end_time": "2026-06-27 11:00"},
    ]


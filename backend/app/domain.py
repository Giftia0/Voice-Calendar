from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

Category = Literal["work", "personal", "meeting", "reminder", "travel"]
RecurrenceType = Literal["none", "daily", "weekly", "monthly", "yearly"]
Weekday = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
ReminderMinutes = Literal[0, 5, 15, 30, 60, 120, 1440, 2880, 4320, 10080]


class Recurrence(BaseModel):
    type: RecurrenceType = "none"
    interval: int = 1
    weekdays: list[Weekday] = Field(default_factory=list)
    skip_holidays: bool = False


class Schedule(BaseModel):
    id: str
    title: str
    start_time: str
    end_time: str
    all_day: bool = False
    description: str = ""
    category: Category = "personal"
    participants: list[str] = Field(default_factory=list)
    location: str = ""
    recurrence: Recurrence = Field(default_factory=Recurrence)
    reminder_minutes: ReminderMinutes = 5
    created_at: str
    updated_at: str

    @field_validator("title", "start_time", "end_time")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value is required")
        return value


class ScheduleDraft(BaseModel):
    title: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    all_day: bool = False
    description: str = ""
    category: Category = "personal"
    participants: list[str] = Field(default_factory=list)
    location: str = ""
    recurrence: Recurrence | RecurrenceType | None = None
    reminder_minutes: ReminderMinutes = 5


class ScheduleQuery(BaseModel):
    start_time: str | None = None
    end_time: str | None = None
    keyword: str | None = None
    category: Category | None = None


def parse_local_datetime(value: str) -> datetime:
    normalized = value.replace("T", " ")
    try:
        return datetime.strptime(normalized, "%Y-%m-%d %H:%M")
    except ValueError as exc:
        raise ValueError(f"Invalid date time: {value}") from exc


def format_local_datetime(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M")


def add_minutes(date_time: str, minutes: int) -> str:
    return format_local_datetime(parse_local_datetime(date_time) + timedelta(minutes=minutes))


def normalize_recurrence(value: Recurrence | RecurrenceType | None) -> Recurrence:
    if value is None:
        return Recurrence()
    if isinstance(value, str):
        return Recurrence(type=value)
    return value


def create_schedule(draft: ScheduleDraft) -> Schedule:
    if not draft.title or not draft.title.strip():
        raise ValueError("title is required")
    if not draft.start_time or not draft.start_time.strip():
        raise ValueError("start_time is required")

    start_time = draft.start_time.strip()
    now = datetime.utcnow().isoformat()
    return Schedule(
        id=uuid4().hex[:12],
        title=draft.title.strip(),
        start_time=start_time,
        end_time=(draft.end_time.strip() if draft.end_time else add_minutes(start_time, 60)),
        all_day=draft.all_day,
        description=draft.description.strip(),
        category=draft.category,
        participants=draft.participants,
        location=draft.location.strip(),
        recurrence=normalize_recurrence(draft.recurrence),
        reminder_minutes=draft.reminder_minutes,
        created_at=now,
        updated_at=now,
    )


def compact_schedule(schedule: Schedule) -> dict:
    return {
        "id": schedule.id,
        "title": schedule.title,
        "start_time": schedule.start_time,
        "end_time": schedule.end_time,
        "all_day": schedule.all_day,
        "category": schedule.category,
        "location": schedule.location,
        "description": schedule.description,
    }


def overlaps(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return parse_local_datetime(a_start) < parse_local_datetime(b_end) and parse_local_datetime(a_end) > parse_local_datetime(b_start)


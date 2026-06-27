from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from .domain import Schedule, ScheduleQuery, overlaps


class ScheduleRepository(Protocol):
    def list(self, query: ScheduleQuery | None = None) -> list[Schedule]: ...
    def get_by_id(self, schedule_id: str) -> Schedule | None: ...
    def create(self, schedule: Schedule) -> Schedule: ...
    def update(self, schedule_id: str, updates: dict) -> Schedule | None: ...
    def delete(self, schedule_id: str) -> Schedule | None: ...


class JsonScheduleRepository:
    def __init__(self, data_dir: str):
        self.file_path = Path(data_dir).resolve() / "schedules.json"

    def list(self, query: ScheduleQuery | None = None) -> list[Schedule]:
        query = query or ScheduleQuery()
        schedules = self._read_all()
        results = []
        for schedule in schedules:
            if query.start_time and schedule.end_time <= query.start_time:
                continue
            if query.end_time and schedule.start_time >= query.end_time:
                continue
            if query.category and schedule.category != query.category:
                continue
            if query.keyword:
                haystack = f"{schedule.title} {schedule.description} {schedule.location}".lower()
                if query.keyword.lower() not in haystack:
                    continue
            results.append(schedule)
        return sorted(results, key=lambda item: item.start_time)

    def get_by_id(self, schedule_id: str) -> Schedule | None:
        return next((schedule for schedule in self._read_all() if schedule.id == schedule_id), None)

    def create(self, schedule: Schedule) -> Schedule:
        schedules = self._read_all()
        schedules.append(schedule)
        self._write_all(schedules)
        return schedule

    def update(self, schedule_id: str, updates: dict) -> Schedule | None:
        schedules = self._read_all()
        for index, schedule in enumerate(schedules):
            if schedule.id != schedule_id:
                continue
            payload = schedule.model_dump()
            payload.update(updates)
            schedules[index] = Schedule(**payload)
            self._write_all(schedules)
            return schedules[index]
        return None

    def delete(self, schedule_id: str) -> Schedule | None:
        schedules = self._read_all()
        for index, schedule in enumerate(schedules):
            if schedule.id == schedule_id:
                deleted = schedules.pop(index)
                self._write_all(schedules)
                return deleted
        return None

    def _read_all(self) -> list[Schedule]:
        if not self.file_path.exists():
            return []
        raw = json.loads(self.file_path.read_text(encoding="utf-8"))
        return [Schedule(**item) for item in raw]

    def _write_all(self, schedules: list[Schedule]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_path.write_text(
            json.dumps([schedule.model_dump() for schedule in schedules], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def find_conflicts(repository: ScheduleRepository, start_time: str, end_time: str, exclude_id: str | None = None) -> list[Schedule]:
    return [
        schedule
        for schedule in repository.list()
        if schedule.id != exclude_id and overlaps(start_time, end_time, schedule.start_time, schedule.end_time)
    ]


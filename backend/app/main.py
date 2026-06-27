from __future__ import annotations

from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .agent import AgentRunRequest, CalendarAgent
from .config import get_settings
from .domain import ScheduleDraft, ScheduleQuery
from .repository import JsonScheduleRepository
from .service import CalendarService
from .stt import transcribe_audio

settings = get_settings()
repository = JsonScheduleRepository(settings.data_dir)
calendar = CalendarService(repository)
agent = CalendarAgent(settings, calendar)

app = FastAPI(title="Voice Calendar Python LangChain", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

public_dir = Path(__file__).resolve().parents[2] / "public"
if public_dir.exists():
    app.mount("/static", StaticFiles(directory=public_dir), name="static")


@app.get("/")
def index():
    index_file = public_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"ok": True, "service": "voice-calendar-python-langchain"}


@app.get("/api/health")
def health():
    return {"ok": True, "service": "voice-calendar-python-langchain", "agent": "python-langchain"}


@app.get("/health")
def legacy_health():
    return health()


@app.get("/api/schedules")
def schedules(start_time: str | None = None, end_time: str | None = None, keyword: str | None = None, category: str | None = None):
    return calendar.query(ScheduleQuery(start_time=start_time, end_time=end_time, keyword=keyword, category=category))


@app.get("/api/schedules/{schedule_id}")
def schedule_detail(schedule_id: str):
    schedule = repository.get_by_id(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule.model_dump()


@app.post("/api/schedules")
def create_schedule(payload: ScheduleDraft, allow_conflict: bool = False):
    result = calendar.create(payload, allow_conflict=allow_conflict)
    if not result.get("success"):
        raise HTTPException(status_code=409 if result.get("conflicts") else 400, detail=result)
    return result["event"]


@app.patch("/api/schedules/{schedule_id}")
def update_schedule(schedule_id: str, updates: dict):
    result = calendar.update(schedule_id, updates)
    if not result.get("success"):
        raise HTTPException(status_code=409 if result.get("conflicts") else 404, detail=result)
    return result["event"]


@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: str):
    result = calendar.delete(schedule_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result)
    return result["event"]


@app.post("/api/agent/run")
def agent_run(payload: AgentRunRequest):
    return agent.run(payload).model_dump()


@app.post("/api/stt/transcribe")
async def stt(audio: UploadFile = File(...)):
    data = await audio.read()
    try:
        text = await transcribe_audio(settings, audio.filename, audio.content_type, data)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"text": text}

from __future__ import annotations

import json
from typing import Any, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from .config import Settings
from .domain import Category, ReminderMinutes, Recurrence, RecurrenceType, ScheduleDraft, ScheduleQuery
from .prompt import build_calendar_system_prompt
from .service import CalendarService


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AgentRunRequest(BaseModel):
    messages: list[dict[str, Any]]
    current_date: str | None = None
    timezone: str = "Asia/Shanghai"


class AgentRunResult(BaseModel):
    status: Literal["done", "needs_user_input", "tool_calls"]
    reply: str
    assistant_message: dict[str, Any]
    tool_calls: list[dict[str, Any]]
    trace: list[dict[str, Any]]


class CreateScheduleInput(BaseModel):
    title: str | None = Field(default=None, description="日程标题")
    start_time: str | None = Field(default=None, description="开始时间，格式 YYYY-MM-DD HH:mm")
    end_time: str | None = Field(default=None, description="结束时间，格式 YYYY-MM-DD HH:mm")
    all_day: bool = False
    description: str = ""
    category: Category = "personal"
    participants: list[str] = Field(default_factory=list)
    location: str = ""
    recurrence: Recurrence | RecurrenceType | None = None
    reminder_minutes: ReminderMinutes = 5
    allow_conflict: bool = False


class QuerySchedulesInput(BaseModel):
    start_time: str | None = None
    end_time: str | None = None
    keyword: str | None = None
    category: Category | None = None


class UpdateScheduleInput(BaseModel):
    id: str
    title: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    all_day: bool | None = None
    description: str | None = None
    category: Category | None = None
    participants: list[str] | None = None
    location: str | None = None
    recurrence: Recurrence | RecurrenceType | None = None
    reminder_minutes: ReminderMinutes | None = None


class DeleteScheduleInput(BaseModel):
    id: str


class FindFreeSlotsInput(BaseModel):
    start_time: str
    end_time: str
    duration_minutes: int
    step_minutes: int = 30


class AskUserInput(BaseModel):
    question: str
    reason: Literal["missing_required_fields", "ambiguous_match", "confirm_dangerous_action", "unclear_request"]
    missing_fields: list[str] = Field(default_factory=list)
    candidates: list[dict[str, Any]] = Field(default_factory=list)


class CalendarAgent:
    def __init__(self, settings: Settings, calendar: CalendarService):
        self.settings = settings
        self.calendar = calendar
        self.tools = self._build_tools()

    def run(self, request: AgentRunRequest) -> AgentRunResult:
        if not self.settings.openai_api_key:
            return self._fallback(request)

        model = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url or None,
            model=self.settings.openai_model,
            temperature=0.1,
        ).bind_tools(self.tools)

        messages: list[Any] = [
            SystemMessage(content=build_calendar_system_prompt(request.timezone, request.current_date))
        ]
        for turn in request.messages:
            messages.append(self._to_langchain_message(turn))

        trace: list[dict[str, Any]] = []
        for _ in range(6):
            response = model.invoke(messages)
            messages.append(response)
            tool_calls = [self._normalize_tool_call(call) for call in (getattr(response, "tool_calls", []) or [])]
            content = response.content if isinstance(response.content, str) else json.dumps(response.content, ensure_ascii=False)
            trace.append({"type": "model", "content": content, "tool_calls": tool_calls})

            if not tool_calls:
                return AgentRunResult(
                    status="done",
                    reply=content or "已完成。",
                    assistant_message={"role": "assistant", "content": content or "已完成。"},
                    tool_calls=[],
                    trace=trace,
                )

            ask_user = next((call for call in tool_calls if call["name"] == "ask_user"), None)
            if ask_user:
                reply = ask_user.get("arguments", {}).get("question") or content or "我需要再确认一下。"
                return AgentRunResult(
                    status="needs_user_input",
                    reply=reply,
                    assistant_message={"role": "assistant", "content": reply},
                    tool_calls=[],
                    trace=trace,
                )

            for call in tool_calls:
                result = self._execute_tool(call["name"], call.get("arguments", {}))
                trace.append({"type": "tool", "name": call["name"], "result": result})
                messages.append(
                    ToolMessage(
                        content=json.dumps(result, ensure_ascii=False),
                        tool_call_id=call["id"],
                    )
                )

        reply = "这个操作有点复杂，我先停在这里。"
        return AgentRunResult(
            status="done",
            reply=reply,
            assistant_message={"role": "assistant", "content": reply},
            tool_calls=[],
            trace=trace,
        )

    def _build_tools(self):
        @tool("create_schedule", args_schema=CreateScheduleInput)
        def create_schedule_tool(**kwargs: Any) -> str:
            """创建日程。缺 title 或 start_time 时必须先 ask_user。"""
            return json.dumps(self._execute_tool("create_schedule", kwargs), ensure_ascii=False)

        @tool("query_schedules", args_schema=QuerySchedulesInput)
        def query_schedules_tool(**kwargs: Any) -> str:
            """查询日程，支持时间范围、关键词和分类。"""
            return json.dumps(self._execute_tool("query_schedules", kwargs), ensure_ascii=False)

        @tool("update_schedule", args_schema=UpdateScheduleInput)
        def update_schedule_tool(**kwargs: Any) -> str:
            """修改日程。必须先 query_schedules 找到明确的 id。"""
            return json.dumps(self._execute_tool("update_schedule", kwargs), ensure_ascii=False)

        @tool("delete_schedule", args_schema=DeleteScheduleInput)
        def delete_schedule_tool(id: str) -> str:
            """删除日程。必须先 query_schedules 找到明确的 id，且高风险动作需确认。"""
            return json.dumps(self._execute_tool("delete_schedule", {"id": id}), ensure_ascii=False)

        @tool("find_free_slots", args_schema=FindFreeSlotsInput)
        def find_free_slots_tool(start_time: str, end_time: str, duration_minutes: int, step_minutes: int = 30) -> str:
            """查找一段时间范围内的空闲时间段。"""
            return json.dumps(
                self._execute_tool(
                    "find_free_slots",
                    {
                        "start_time": start_time,
                        "end_time": end_time,
                        "duration_minutes": duration_minutes,
                        "step_minutes": step_minutes,
                    },
                ),
                ensure_ascii=False,
            )

        @tool("ask_user", args_schema=AskUserInput)
        def ask_user_tool(**kwargs: Any) -> str:
            """信息缺失、候选不明确或高风险动作确认时，向用户追问。"""
            return json.dumps({"success": True, "status": "needs_user_input", **kwargs}, ensure_ascii=False)

        return [
            create_schedule_tool,
            query_schedules_tool,
            update_schedule_tool,
            delete_schedule_tool,
            find_free_slots_tool,
            ask_user_tool,
        ]

    def _execute_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            if name == "create_schedule":
                allow_conflict = bool(arguments.pop("allow_conflict", False))
                return self.calendar.create(ScheduleDraft(**arguments), allow_conflict=allow_conflict)
            if name == "query_schedules":
                return self.calendar.query(ScheduleQuery(**arguments))
            if name == "update_schedule":
                schedule_id = arguments.pop("id", "")
                updates = {key: value for key, value in arguments.items() if value is not None}
                return self.calendar.update(schedule_id, updates)
            if name == "delete_schedule":
                return self.calendar.delete(str(arguments.get("id") or ""))
            if name == "find_free_slots":
                return self.calendar.find_free_slots(**arguments)
        except Exception as exc:  # defensive: tool errors should become model-visible results
            return {"success": False, "message": str(exc)}
        return {"success": False, "message": f"未知工具：{name}"}

    def _fallback(self, request: AgentRunRequest) -> AgentRunResult:
        latest = str(request.messages[-1].get("content", "")) if request.messages else ""
        reply = f"当前未配置 OPENAI_API_KEY，Python LangChain Agent 处于本地降级模式。我收到：{latest or '空消息'}。"
        return AgentRunResult(
            status="done",
            reply=reply,
            assistant_message={"role": "assistant", "content": reply},
            tool_calls=[],
            trace=[{"type": "model", "name": "local_fallback", "content": reply, "tool_calls": []}],
        )

    def _to_langchain_message(self, turn: dict[str, Any]) -> Any:
        role = turn.get("role")
        content = turn.get("content") or ""
        if role == "assistant":
            return AIMessage(content=content)
        if role == "tool":
            return ToolMessage(content=content, tool_call_id=turn.get("tool_call_id") or turn.get("name") or "tool")
        return HumanMessage(content=content)

    def _normalize_tool_call(self, call: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": call.get("id") or call.get("name") or "tool_call",
            "name": call["name"],
            "arguments": call.get("args", {}),
        }

    def _assistant_message(self, content: str, tool_calls: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "role": "assistant",
            "content": content,
            "tool_calls": [
                {
                    "id": call["id"],
                    "type": "function",
                    "function": {"name": call["name"], "arguments": json.dumps(call["arguments"], ensure_ascii=False)},
                }
                for call in tool_calls
            ],
        }

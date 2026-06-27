from langchain_core.messages import AIMessage

from app.agent import CalendarAgent
from app.config import Settings
from app.repository import JsonScheduleRepository
from app.service import CalendarService


def test_assistant_message_without_tool_calls_has_no_tool_calls(tmp_path):
    agent = CalendarAgent(Settings(openai_api_key="test-key"), CalendarService(JsonScheduleRepository(str(tmp_path))))

    message = agent._to_langchain_message({"role": "assistant", "content": "好的"})

    assert isinstance(message, AIMessage)
    assert message.tool_calls == []


def test_assistant_history_tool_calls_are_not_replayed(tmp_path):
    agent = CalendarAgent(Settings(openai_api_key="test-key"), CalendarService(JsonScheduleRepository(str(tmp_path))))

    message = agent._to_langchain_message(
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "ask_user", "arguments": '{"question":"几点？"}'},
                }
            ],
        }
    )

    assert isinstance(message, AIMessage)
    assert message.tool_calls == []

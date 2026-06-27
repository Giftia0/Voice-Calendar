from langchain_core.messages import AIMessage

from app.agent import CalendarAgent
from app.config import Settings
from app.repository import JsonScheduleRepository
from app.service import CalendarService


def test_assistant_message_without_tool_calls_uses_empty_list(tmp_path):
    agent = CalendarAgent(Settings(openai_api_key="test-key"), CalendarService(JsonScheduleRepository(str(tmp_path))))

    message = agent._to_langchain_message({"role": "assistant", "content": "好的"})

    assert isinstance(message, AIMessage)
    assert message.tool_calls == []

# Voice Calendar Backend

这是 `voice_calendar` 当前项目的 Python FastAPI + LangChain 后端，替换原来的 Node STT/LLM proxy。

后端负责：

- Python LangChain Agent
- 日程 CRUD API
- Agent 工具执行
- 冲突检测和空闲时间查找
- DashScope ASR 代理

```text
backend/
  app/
    agent.py        Python LangChain Agent 和工具注册
    prompt.py       Agent system prompt
    domain.py       日程领域模型
    repository.py   JSON repository，后续可替换为 SQLite/Postgres/Google Calendar
    service.py      日历业务规则、冲突检测、空闲时间查找
    stt.py          DashScope ASR 代理
    main.py         FastAPI 入口
  tests/
  data/             本地 JSON 数据目录，运行时生成
```

## Agent 工具

Python LangChain Agent 当前注册 6 个工具：

- `create_schedule`：创建日程，默认检测冲突。
- `query_schedules`：按时间、关键词、分类查询日程。
- `update_schedule`：修改日程，修改时间时检测冲突。
- `delete_schedule`：删除日程。
- `find_free_slots`：查找空闲时间段。
- `ask_user`：缺信息、候选不明确或危险操作确认时追问。

## 启动

```powershell
cd C:\MySpace\WorkSpace\Project\voice_calendar\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8787 --reload
```

打开：

```text
http://127.0.0.1:8787
```

健康检查：

```powershell
curl http://127.0.0.1:8787/health
```

## 环境变量

复制 `backend/.env.example` 到 `backend/.env`：

```env
PORT=8787
DATA_DIR=./data
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
DASHSCOPE_API_KEY=
```

`OPENAI_BASE_URL` 支持 OpenAI-compatible endpoint。没有 `OPENAI_API_KEY` 时，Agent 会进入本地降级模式，方便先验证服务和 API。

## API

发送多轮上下文给 Python LangChain Agent：

```http
POST /api/agent/run
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "明天下午三点提醒我开会" }
  ],
  "current_date": "2026-06-27 15:00",
  "timezone": "Asia/Shanghai"
}
```

查询日程：

```http
GET /api/schedules
GET /api/schedules?keyword=会议
```

语音转文字：

```http
POST /api/stt/transcribe
multipart/form-data: audio=<file>
```

## 验证

```powershell
cd C:\MySpace\WorkSpace\Project\voice_calendar\backend
pytest
python -m compileall app
```

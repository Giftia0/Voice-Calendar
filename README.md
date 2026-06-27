# Voice Calendar

Voice Calendar 是一个语音驱动的日程助手实验项目。前端使用 Expo / React Native 构建移动端界面，后端使用 FastAPI + LangChain 负责日程 Agent、数据存储、冲突检测和语音转文字代理。

当前架构中，App 保留交互和渲染逻辑；日程数据和 Agent 推理都迁移到后端。

## Features

- 语音或文本创建日程
- 多轮 Agent 对话
- 日程创建、查询、修改、删除
- 创建和修改时检测时间冲突
- 查找空闲时间段
- 对话窗口内展示日程操作结果卡片
- DashScope ASR 语音转文字代理
- OpenAI-compatible Chat API，可接 OpenAI、DeepSeek 或其他兼容服务

## Project Structure

```text
voice_calendar/
  backend/                 FastAPI + LangChain 后端
    app/
      agent.py             日程 Agent 和工具注册
      main.py              API 入口
      service.py           日程业务逻辑
      repository.py        本地 JSON 数据存储
      stt.py               DashScope ASR 代理
    tests/                 后端测试
    requirements.txt       Python 依赖
    .env.example           后端环境变量模板

  frontend/                Expo / React Native App
    App.js                 主界面和交互流程
    src/
      api/                 后端 API 调用
      components/          UI 组件
      types/               日程类型和时间工具
    android/               Android dev client 原生工程
    .env.example           前端环境变量模板
```

## Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

编辑 `backend/.env`：

```env
PORT=8787
DATA_DIR=./data

OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini

DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_ASR_MODEL=qwen3-asr-flash
```

说明：

- `OPENAI_*` 用于日程 Agent，支持 OpenAI-compatible endpoint。
- `DASHSCOPE_*` 用于语音转文字。
- 不要提交真实 `.env`，仓库只保留 `.env.example`。

启动后端：

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8787 --reload
```

健康检查：

```powershell
curl http://127.0.0.1:8787/api/health
```

## Frontend Setup

```powershell
cd frontend
npm install
copy .env.example .env
```

编辑 `frontend/.env`：

```env
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8787
EXPO_PUBLIC_CALENDAR_API_URL=http://127.0.0.1:8787
```

启动 Metro：

```powershell
npx expo start --dev-client
```

## Android USB Debugging

连接手机并确认设备：

```powershell
adb devices
```

转发 Metro 和后端端口：

```powershell
adb -s <device-id> reverse tcp:8081 tcp:8081
adb -s <device-id> reverse tcp:8787 tcp:8787
```

然后在手机上打开已安装的 development build。

## Main APIs

Agent：

```http
POST /api/agent/run
```

日程：

```http
GET    /api/schedules
GET    /api/schedules/{id}
POST   /api/schedules
PATCH  /api/schedules/{id}
DELETE /api/schedules/{id}
```

语音转文字：

```http
POST /api/stt/transcribe
```

## Test

后端：

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
python -m compileall app
```

前端基础语法检查：

```powershell
cd frontend
node --check App.js
node --check src/api/client.js
node --check src/api/schedules.js
node --check src/api/calendarAgent.js
```

## Git Hygiene

应该提交：

- 源码
- 测试
- `requirements.txt`
- `package-lock.json`
- `.env.example`
- Android dev client 工程文件

不要提交：

- `.env`
- `.venv/`
- `node_modules/`
- `.expo/`
- `backend/data/`
- Android build output
- release keystore 或任何真实密钥


# Voice Calendar

Voice Calendar 是一个语音驱动的智能日程助手。你可以用自然语言说出安排，它会理解时间、事项和提醒需求，并把日程保存下来。

项目包含一个移动端 App 和一个本地后端服务，适合在 Android 真机上调试体验。

## 功能

- 用语音或文字添加日程
- 查看当天日程列表
- 修改日程标题、时间、地点、参与人、提醒和重复规则
- 删除日程
- 自动检测时间冲突
- 在对话窗口中用卡片展示日程操作结果
- 支持多轮补充信息，例如时间不明确时继续追问

## 使用示例

可以这样输入或说出：

```text
明天下午三点提醒我开会
下周一上午十点和小林讨论项目，提前十五分钟提醒
帮我看看明天下午有没有空的一小时
把明天的站会改到上午十点
删除今晚八点的提醒
```

## 本地运行

### 1. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8787 --reload
```

首次运行前，需要在 `backend/.env` 中填写模型和语音识别服务所需的 key。

### 2. 启动前端

```powershell
cd frontend
npm install
copy .env.example .env
npx expo start --dev-client
```

### 3. Android 真机调试

连接手机后执行：

```powershell
adb devices
adb -s <device-id> reverse tcp:8081 tcp:8081
adb -s <device-id> reverse tcp:8787 tcp:8787
```

然后在手机上打开已安装的 development build。

## 配置说明

仓库只提供 `.env.example` 模板。真实 `.env` 文件不会提交到 GitHub。

前端默认连接本机后端：

```env
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8787
EXPO_PUBLIC_CALENDAR_API_URL=http://127.0.0.1:8787
```

后端需要配置：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
DASHSCOPE_API_KEY=
```

如果不配置模型 key，智能日程理解能力会不可用或进入降级模式。

## 安全提醒

不要上传任何真实 key、`.env` 文件、构建产物或本地数据文件。

import { registry } from './registry';
import { chatWithTools, simpleChat } from '../llm/client';
import { speak, stopSpeaking } from '../voice/tts';

const SYSTEM_PROMPT = `你是一个语音日历助手，帮助用户管理日程。

当前日期：${new Date().toLocaleString('zh-CN')}

你的工作流程：
1. 理解用户的自然语言输入，提取日程相关信息
2. 将用户的时间描述（如"明天下午3点"、"下周三上午"、"半小时后"）转换为精确的日期时间
3. 调用合适的工具完成操作
4. 用简洁友好的中文回复结果

注意：
- 解析时间时，以系统默认时区为准
- 当用户说"提醒我"时，设置category为"reminder"
- 当用户提到出差、旅行、往返等时，设置category为"travel"
- 当用户提到开会、讨论、评审等时，设置category为"meeting"
- 当用户没有明确分类时，根据上下文判断或默认为"personal"
- 创建日程前应先检查冲突
- 删除日程前应向用户确认
- 回复要简洁，不要冗长`;

class Orchestrator {
  constructor() {
    this.messages = [{
      role: 'system',
      content: SYSTEM_PROMPT,
    }];
    /** @type {function} */
    this.onMessage = null;
    /** @type {function} */
    this.onToolResult = null;
    /** @type {function} */
    this.onStateChange = null;
    this.currentTranscript = '';
    this.isProcessing = false;
  }

  addUserMessage(text) {
    this.messages.push({ role: 'user', content: text });
    this.onMessage?.({ role: 'user', text });
  }

  addAssistantMessage(title, text) {
    this.messages.push({ role: 'assistant', content: text });
    this.onMessage?.({ role: 'assistant', title, text });
  }

  async processText(text) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.addUserMessage(text);

      const tools = registry.getSchemas();
      const response = await chatWithTools(this.messages, tools);

      if (response.content) {
        this.addAssistantMessage('助手回复', response.content);
        speak(response.content);
      }

      for (const toolCall of response.toolCalls) {
        const result = await registry.execute(toolCall.name, toolCall.arguments);
        this.onToolResult?.({ toolCall, result });

        this.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });

        const followUp = await simpleChat([
          ...this.messages,
          {
            role: 'system',
            content: '根据工具执行结果，用简洁的中文总结给用户。如果创建成功，告知已创建；如果有冲突，说明冲突情况。不超过两句话。',
          },
        ]);

        if (followUp) {
          this.addAssistantMessage('助手回复', followUp);
          speak(followUp);
        }
      }
    } catch (error) {
      const msg = `处理出错：${error.message}`;
      this.addAssistantMessage('错误', msg);
      speak(msg);
    } finally {
      this.isProcessing = false;
    }
  }

  startVoice(onTranscriptUpdate) {
    onTranscriptUpdate?.('');
    this.onStateChange?.({
      isListening: false,
      error: '语音识别已改为录音上传到后端，请使用 useVoiceInput。'
    });
  }

  stopVoice() {
    const final = this.currentTranscript.trim();
    this.currentTranscript = '';
    if (final) {
      this.processText(final);
    }
    this.onStateChange?.({ isListening: false });
  }

  isVoiceActive() {
    return false;
  }

  stopSpeaking() {
    stopSpeaking();
  }

  clearConversation() {
    this.messages = [{
      role: 'system',
      content: SYSTEM_PROMPT,
    }];
  }

  reset() {
    this.stopVoice();
    this.stopSpeaking();
    this.clearConversation();
    this.currentTranscript = '';
  }
}

export const orchestrator = new Orchestrator();

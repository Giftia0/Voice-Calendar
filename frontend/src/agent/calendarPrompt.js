export function buildCalendarSystemPrompt({ currentDate, timezone } = {}) {
  return `你是一个本地语音日历 Agent。你只通过工具完成日历增删改查，不能假装已经执行。

当前时间：${currentDate || "未知"}
用户时区：${timezone || "Asia/Shanghai"}

日程字段：
- title: 标题，用户创建日程时必须明确。
- start_time / end_time: 本地时间字符串，格式严格为 YYYY-MM-DD HH:mm。
- all_day: 默认 false；用户说"全天"时设为 true，此时 start_time 填 YYYY-MM-DD 00:00，end_time 填 YYYY-MM-DD 23:59。
- category: work/personal/meeting/reminder/travel，默认 personal；会议、开会、评审归 meeting；提醒我归 reminder；出差、旅行归 travel。
- description/location/participants: 用户说了就填，没说用空值。
- recurrence: 默认 none；可选 daily/weekly/monthly/yearly。
- reminder_minutes: 单选提醒时间，默认 5。可选值：0=准时，5=5分钟前，15=15分钟前，30=30分钟前，60=1小时前，120=2小时前，1440=1天前，2880=2天前，4320=3天前，10080=1周前。用户要求多个提醒时调用 ask_user 让用户选择一个。

行为规则：
1. 添加日程缺 title 或 start_time 时，调用 ask_user 追问，不要猜测。
2. 添加日程缺 end_time 时，默认 start_time 后 1 小时。
3. 查询日程没说日期时，默认查今天 00:00 到 23:59。
4. 查询日程说了关键词但没说日期时，不限时间范围全量搜索。
5. 修改日程必须先 query_schedules 找候选；无候选时告知用户；多候选时调用 ask_user 让用户选择，候选列表最多展示 5 条。
6. 删除日程必须先 query_schedules 找候选；无候选时告知用户；多候选时调用 ask_user 让用户选择；唯一候选也必须先 ask_user 确认再删除。
7. create_schedule 返回冲突时，告知用户冲突的日程标题和时间，并询问是否仍要创建或换个时间。用户明确确认仍要创建时，必须使用上一次 draft 的原始字段再次调用 create_schedule，并设置 allow_conflict=true。
8. 工具返回 success: false 时，用自然中文告知用户失败原因，不要重试。
9. 工具执行成功后，用一句自然中文确认结果。
10. 如果用户上一轮是在回答你的追问，请结合完整 messages 上下文继续处理。
11. 追问要自然简短；举例时间只用于说明格式，不要推荐早于当前时间的时间点。
12. 同一轮用户请求中，create_schedule / update_schedule / delete_schedule 成功后不要再次调用同类写入工具，直接回复结果。
13. 不要输出 Markdown，不要输出 JSON 给用户。`;
}

export const calendarTools = [
  {
    name: "create_schedule",
    description: "创建日程。缺 title 或 start_time 时必须先调用 ask_user。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "日程标题。" },
        start_time: { type: "string", description: "开始时间，格式 YYYY-MM-DD HH:mm。" },
        end_time: { type: "string", description: "结束时间，格式 YYYY-MM-DD HH:mm。缺省时默认 start_time 后 1 小时。" },
        all_day: { type: "boolean", description: "是否全天事件，默认 false。" },
        description: { type: "string", description: "备注。" },
        category: {
          type: "string",
          enum: ["work", "personal", "meeting", "reminder", "travel"],
          description: "分类，默认 personal。"
        },
        participants: { type: "array", items: { type: "string" }, description: "参与人列表。" },
        location: { type: "string", description: "地点。" },
        recurrence: {
          type: "string",
          enum: ["none", "daily", "weekly", "monthly", "yearly"],
          description: "重复规则，默认 none。"
        },
        reminder_minutes: {
          type: "number",
          enum: [0, 5, 15, 30, 60, 120, 1440, 2880, 4320, 10080],
          description: "单选提醒时间，默认 5。0=准时，5=5分钟前，15=15分钟前，30=30分钟前，60=1小时前，120=2小时前，1440=1天前，2880=2天前，4320=3天前，10080=1周前。"
        },
        allow_conflict: {
          type: "boolean",
          description: "仅当用户已明确确认冲突也要创建时设为 true；默认 false。"
        }
      },
      required: ["title", "start_time"]
    }
  },
  {
    name: "query_schedules",
    description: "查询日程。没说时间时默认查今天；说了关键词但没说时间时不限时间范围。",
    parameters: {
      type: "object",
      properties: {
        start_time: { type: "string", description: "查询开始时间，格式 YYYY-MM-DD HH:mm。" },
        end_time: { type: "string", description: "查询结束时间，格式 YYYY-MM-DD HH:mm。" },
        keyword: { type: "string", description: "标题、备注或地点关键词。" },
        category: {
          type: "string",
          enum: ["work", "personal", "meeting", "reminder", "travel"]
        }
      }
    }
  },
  {
    name: "update_schedule",
    description: "修改日程。必须先通过 query_schedules 找到明确的 id；候选不明确时调用 ask_user。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "要修改的日程 ID。" },
        title: { type: "string" },
        start_time: { type: "string", description: "格式 YYYY-MM-DD HH:mm。" },
        end_time: { type: "string", description: "格式 YYYY-MM-DD HH:mm。" },
        all_day: { type: "boolean" },
        description: { type: "string" },
        category: { type: "string", enum: ["work", "personal", "meeting", "reminder", "travel"] },
        participants: { type: "array", items: { type: "string" } },
        location: { type: "string" },
        recurrence: { type: "string", enum: ["none", "daily", "weekly", "monthly", "yearly"] },
        reminder_minutes: {
          type: "number",
          enum: [0, 5, 15, 30, 60, 120, 1440, 2880, 4320, 10080]
        }
      },
      required: ["id"]
    }
  },
  {
    name: "delete_schedule",
    description: "删除日程。必须先通过 query_schedules 找到明确的 id；唯一候选也要先 ask_user 确认。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "要删除的日程 ID。" }
      },
      required: ["id"]
    }
  },
  {
    name: "ask_user",
    description: "信息缺失、候选不明确或删除需要确认时，向用户追问。",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "展示给用户的问题。" },
        reason: {
          type: "string",
          enum: ["missing_required_fields", "ambiguous_match", "confirm_dangerous_action", "unclear_request"]
        },
        missing_fields: { type: "array", items: { type: "string" } },
        candidates: { type: "array", items: { type: "object" } }
      },
      required: ["question", "reason"]
    }
  }
];

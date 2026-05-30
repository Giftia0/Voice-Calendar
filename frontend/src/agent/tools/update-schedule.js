import { updateSchedule, getScheduleById, checkConflict } from '../../db/repository';

export const updateScheduleTool = {
  name: 'update_schedule',
  description: '修改已有日程。当用户要求修改、更改、调整、推迟或提前某个日程时调用此工具。需要先通过query_schedules查找到日程ID，再进行修改。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '要修改的日程ID' },
      title: { type: 'string', description: '新的标题' },
      start_time: { type: 'number', description: '新的开始时间（Unix时间戳，毫秒）' },
      end_time: { type: 'number', description: '新的结束时间（Unix时间戳，毫秒）' },
      all_day: { type: 'boolean', description: '是否为全天事件' },
      description: { type: 'string', description: '新的备注' },
      category: {
        type: 'string',
        enum: ['work', 'personal', 'meeting', 'reminder', 'travel'],
        description: '新的分类',
      },
      participants: { type: 'array', items: { type: 'string' }, description: '新的参与人列表' },
      location: { type: 'string', description: '新的地点' },
      recurrence: { type: 'string', description: '新的重复规则' },
      reminders: { type: 'array', items: { type: 'number' }, description: '新的提醒时间' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const { id, ...updates } = args;
    const existing = await getScheduleById(id);
    if (!existing) {
      return { success: false, message: '未找到该日程' };
    }

    if (updates.start_time || updates.end_time) {
      const conflicts = await checkConflict(
        updates.start_time ?? existing.start_time,
        updates.end_time ?? existing.end_time,
        id
      );
      if (conflicts.length > 0) {
        return {
          success: false,
          message: '修改后的时间与已有日程冲突',
          conflicts: conflicts.map((c) => ({ title: c.title, start_time: c.start_time, end_time: c.end_time })),
        };
      }
    }

    const updated = await updateSchedule(id, updates);
    return { success: true, message: '日程修改成功', schedule: updated };
  },
};

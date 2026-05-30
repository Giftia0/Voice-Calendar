import { createSchedule as newSchedule } from '../../types/schedule';
import { createSchedule as repoCreate, checkConflict } from '../../db/repository';

export const createScheduleTool = {
  name: 'create_schedule',
  description: '创建一个新的日程/事件。当用户要求添加、新建、安排某个日程时调用此工具。',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '日程标题' },
      start_time: { type: 'number', description: '开始时间（Unix时间戳，毫秒）' },
      end_time: { type: 'number', description: '结束时间（Unix时间戳，毫秒）' },
      all_day: { type: 'boolean', description: '是否为全天事件，默认false' },
      description: { type: 'string', description: '备注或详情' },
      category: {
        type: 'string',
        enum: ['work', 'personal', 'meeting', 'reminder', 'travel'],
        description: '分类：work=工作, personal=个人, meeting=会议, reminder=提醒, travel=出行',
      },
      participants: {
        type: 'array',
        items: { type: 'string' },
        description: '参与人姓名列表',
      },
      location: { type: 'string', description: '地点' },
      recurrence: {
        type: 'string',
        description: "重复规则：'none'=不重复, 'daily'=每天, 'weekly'=每周, 'monthly'=每月",
      },
      reminders: {
        type: 'array',
        items: { type: 'number' },
        description: '提醒时间，分钟数列表，例如 [15] 表示提前15分钟提醒',
      },
    },
    required: ['title', 'start_time', 'end_time'],
  },
  handler: async (args) => {
    const schedule = newSchedule(args);

    const conflicts = await checkConflict(schedule.start_time, schedule.end_time);
    if (conflicts.length > 0) {
      return {
        success: false,
        message: '该时间段与已有日程冲突',
        conflicts: conflicts.map((c) => ({ title: c.title, start_time: c.start_time, end_time: c.end_time })),
        schedule,
      };
    }

    await repoCreate(schedule);
    return { success: true, message: '日程创建成功', schedule };
  },
};

import { querySchedules } from '../../db/repository';

export const querySchedulesTool = {
  name: 'query_schedules',
  description: '查询日程。当用户询问某天有什么安排、查找特定日程、或者询问某个时间段内的事件时调用此工具。',
  parameters: {
    type: 'object',
    properties: {
      start_date: { type: 'number', description: '查询起始日期（Unix时间戳，毫秒）' },
      end_date: { type: 'number', description: '查询截止日期（Unix时间戳，毫秒）' },
      category: {
        type: 'string',
        enum: ['work', 'personal', 'meeting', 'reminder', 'travel'],
        description: '按分类筛选',
      },
      keyword: { type: 'string', description: '按标题/备注/地点模糊搜索' },
      participants: {
        type: 'array',
        items: { type: 'string' },
        description: '按参与人筛选',
      },
    },
  },
  handler: async (args) => {
    const schedules = await querySchedules({
      startDate: args.start_date,
      endDate: args.end_date,
      category: args.category,
      keyword: args.keyword,
      participants: args.participants,
    });

    if (schedules.length === 0) {
      return { success: true, message: '该时间段内没有日程', schedules: [] };
    }

    return { success: true, message: `找到 ${schedules.length} 个日程`, schedules };
  },
};

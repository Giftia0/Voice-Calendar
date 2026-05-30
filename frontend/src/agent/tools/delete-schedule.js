import { deleteSchedule } from '../../db/repository';

export const deleteScheduleTool = {
  name: 'delete_schedule',
  description: '删除日程。当用户要求取消、删除、移除某个日程时调用此工具。需要先通过query_schedules查找到日程ID，再进行删除。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '要删除的日程ID' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    await deleteSchedule(args.id);
    return { success: true, message: '日程已删除' };
  },
};

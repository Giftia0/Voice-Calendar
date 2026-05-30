import { checkConflict } from '../../db/repository';

export const checkConflictTool = {
  name: 'check_conflict',
  description: '检查某个时间段是否与已有日程冲突。在创建或修改日程前可调用此工具检测冲突。',
  parameters: {
    type: 'object',
    properties: {
      start_time: { type: 'number', description: '开始时间（Unix时间戳，毫秒）' },
      end_time: { type: 'number', description: '结束时间（Unix时间戳，毫秒）' },
      exclude_id: { type: 'string', description: '排除的日程ID（修改场景使用）' },
    },
    required: ['start_time', 'end_time'],
  },
  handler: async (args) => {
    const conflicts = await checkConflict(args.start_time, args.end_time, args.exclude_id);
    if (conflicts.length === 0) {
      return { success: true, message: '该时间段无冲突', conflicts: [] };
    }
    return {
      success: false,
      message: `检测到 ${conflicts.length} 个冲突日程`,
      conflicts: conflicts.map((c) => ({ id: c.id, title: c.title, start_time: c.start_time, end_time: c.end_time })),
    };
  },
};

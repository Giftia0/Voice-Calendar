import { createScheduleTool } from './tools/create-schedule';
import { querySchedulesTool } from './tools/query-schedules';
import { updateScheduleTool } from './tools/update-schedule';
import { deleteScheduleTool } from './tools/delete-schedule';
import { checkConflictTool } from './tools/check-conflict';

const defaultTools = [
  createScheduleTool,
  querySchedulesTool,
  updateScheduleTool,
  deleteScheduleTool,
  checkConflictTool,
];

class ToolRegistry {
  constructor() {
    /** @type {Map<string, import('../../types/tool').Tool>} */
    this.tools = new Map();
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  unregister(name) {
    this.tools.delete(name);
  }

  get(name) {
    return this.tools.get(name);
  }

  getAll() {
    return Array.from(this.tools.values());
  }

  getSchemas() {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  async execute(name, args) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.handler(args);
  }
}

const registry = new ToolRegistry();
defaultTools.forEach((tool) => registry.register(tool));

export { registry, ToolRegistry };

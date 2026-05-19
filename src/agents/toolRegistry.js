/**
 * Tool Registry — nanobot dynamic tool loading pattern
 * Global registry for agent tools with runtime registration
 */

export const toolRegistry = {
  _tools: new Map(),      // toolId -> { id, name, description, handler, agentIds: Set }
  _handlers: new Map(),   // toolId -> handler function

  registerTool({ id, name, description, handler, agentIds = [] }) {
    if (this._tools.has(id)) {
      console.warn(`[toolRegistry] Tool ${id} already registered, skipping`);
      return false;
    }
    this._handlers.set(id, handler);
    this._tools.set(id, {
      id,
      name,
      description,
      handler: null, // handler stored separately
      agentIds: new Set(agentIds),
    });
    return true;
  },

  unregisterTool(toolId) {
    if (!this._tools.has(toolId)) return false;
    this._handlers.delete(toolId);
    this._tools.delete(toolId);
    return true;
  },

  getTools(agentId = null) {
    if (!agentId) {
      return Array.from(this._tools.values()).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        agentIds: Array.from(t.agentIds),
      }));
    }
    return Array.from(this._tools.values())
      .filter(t => t.agentIds.has(agentId))
      .map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
      }));
  },

  getToolDefs() {
    return Array.from(this._tools.values()).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      agentIds: Array.from(t.agentIds),
    }));
  },

  getHandler(toolId) {
    return this._handlers.get(toolId) || null;
  },

  assignToolToAgent(toolId, agentId) {
    const tool = this._tools.get(toolId);
    if (!tool) return false;
    tool.agentIds.add(agentId);
    return true;
  },

  removeToolFromAgent(toolId, agentId) {
    const tool = this._tools.get(toolId);
    if (!tool) return false;
    tool.agentIds.delete(agentId);
    return true;
  },

  // Register built-in tools
  _registerBuiltinTools() {
    // Task management tools
    this.registerTool({
      id: 'task_create',
      name: '创建任务',
      description: '创建新任务',
      handler: (params) => ({ success: true, taskId: params.id }),
      agentIds: ['CreatorAgent'],
    });

    this.registerTool({
      id: 'task_search',
      name: '搜索任务',
      description: '按关键词搜索任务',
      handler: (params) => ({ success: true, results: [] }),
      agentIds: ['CreatorAgent', 'ReviewAgent'],
    });

    this.registerTool({
      id: 'task_complete',
      name: '完成任务',
      description: '标记任务为已完成',
      handler: (params) => ({ success: true }),
      agentIds: ['CreatorAgent', 'ReminderAgent'],
    });

    this.registerTool({
      id: 'reminder_set',
      name: '设置提醒',
      description: '为任务设置到期提醒',
      handler: (params) => ({ success: true }),
      agentIds: ['ReminderAgent'],
    });

    this.registerTool({
      id: 'priority_suggest',
      name: '优先级建议',
      description: '基于到期日期建议优先级',
      handler: (params) => ({ success: true, priority: 'medium' }),
      agentIds: ['ReviewAgent'],
    });

    this.registerTool({
      id: 'duplicate_check',
      name: '重复检测',
      description: '检查是否有重复任务',
      handler: (params) => ({ success: true, isDuplicate: false }),
      agentIds: ['ReviewAgent'],
    });
  },
};

// Auto-register built-in tools
toolRegistry._registerBuiltinTools();

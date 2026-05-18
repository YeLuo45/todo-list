// Field mapping rules: MCP tool result → Task fields
export const MAPPINGS = {
  github: {
    issue: { title: 'title', description: 'body', dueDate: null, priority: 'priority', tags: ['github', 'issue'], externalUrl: 'html_url' },
    pr: { title: 'title', description: 'body', dueDate: null, priority: 'priority', tags: ['github', 'pr'], externalUrl: 'html_url' }
  },
  jira: {
    issue: { title: 'summary', description: 'description', dueDate: 'duedate', priority: 'priority', tags: ['jira'], externalUrl: 'self' }
  },
  figma: {
    file: { title: 'name', description: null, dueDate: null, priority: null, tags: ['figma'], externalUrl: 'thumbnailUrl' }
  }
};

export function mapToTask(toolName, toolType, rawResult) {
  const mapping = MAPPINGS[toolName]?.[toolType];
  if (!mapping) return null;
  
  const task = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completed: false };
  if (mapping.title) task.title = rawResult[mapping.title] || rawResult.title || 'Untitled';
  if (mapping.description) task.description = typeof rawResult[mapping.description] === 'string' ? rawResult[mapping.description] : JSON.stringify(rawResult[mapping.description] || '');
  if (mapping.dueDate && rawResult[mapping.dueDate]) task.dueDate = rawResult[mapping.dueDate];
  if (mapping.priority) task.priority = rawResult[mapping.priority]?.name || rawResult[mapping.priority] || 'medium';
  if (mapping.tags) task.tags = [...(rawResult.labels?.map(l => l.name) || []), ...mapping.tags];
  if (mapping.externalUrl && rawResult[mapping.externalUrl]) task.externalUrl = rawResult[mapping.externalUrl];
  return task;
}

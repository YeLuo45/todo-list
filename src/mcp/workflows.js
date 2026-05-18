import { mcpOrchestrator } from './orchestrator.js';
import githubMCP from './githubMcp.js';
import jiraMCP from './jiraMcp.js';
import { mapToTask } from './taskMapper.js';

// Register built-in workflows
export function initWorkflows() {
  // GitHub Issue → Task workflow
  mcpOrchestrator.registerTool('github-issue-to-task', async ({ issue, repo }) => {
    const rawResult = await githubMCP.getIssues({ repo });
    const matchedIssue = Array.isArray(rawResult) ? rawResult.find(i => i.number === issue.number) : null;
    if (!matchedIssue) throw new Error(`Issue #${issue.number} not found in ${repo}`);
    const task = mapToTask('github', 'issue', matchedIssue);
    return { task };
  });
  
  // Jira Issue → Task workflow  
  mcpOrchestrator.registerTool('jira-issue-to-task', async ({ issue, projectKey }) => {
    const rawResult = await jiraMCP.getIssues(projectKey);
    const matchedIssue = Array.isArray(rawResult) ? rawResult.find(i => i.id === issue.id || i.key === issue.key) : null;
    if (!matchedIssue) throw new Error(`Issue ${issue.key} not found in ${projectKey}`);
    const task = mapToTask('jira', 'issue', matchedIssue);
    return { task };
  });
  
  // Chain: GitHub Issue + Label → Jira Issue
  mcpOrchestrator.registerTool('github-issue-to-jira', async ({ issue, repo, targetProject }) => {
    const rawResult = await githubMCP.getIssues({ repo });
    const matchedIssue = Array.isArray(rawResult) ? rawResult.find(i => i.number === issue.number) : null;
    if (!matchedIssue) throw new Error(`Issue #${issue.number} not found in ${repo}`);
    await jiraMCP.createIssue(targetProject, matchedIssue.title, matchedIssue.body || '', matchedIssue.priority?.name || 'Medium');
    return { synced: true };
  });
}

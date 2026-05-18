import { mcpOrchestrator } from './orchestrator.js';

// Webhook endpoint handler (for GitHub/Jira webhooks)
export function handleWebhook(event, payload) {
  switch (event) {
    case 'github.issues':
      if (payload.action === 'opened') {
        mcpOrchestrator.publish('task:create', {
          source: 'github',
          data: { repo: payload.repository.full_name, issue: payload.issue }
        });
        mcpOrchestrator.executeChain(['github-issue-to-task'], { repo: payload.repository.full_name, issue: payload.issue });
      }
      break;
    case 'jira.issue_created':
      mcpOrchestrator.publish('task:create', {
        source: 'jira',
        data: { projectKey: payload.project.key, issue: payload.issue }
      });
      break;
  }
}

// Export for use in server/worker
export { mcpOrchestrator };

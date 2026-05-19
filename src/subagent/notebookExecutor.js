// Notebook Executor - executes scripts in Web Worker sandbox
class NotebookExecutor {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
  }
  
  async executeScript(script, input = {}) {
    const id = crypto.randomUUID();
    const entry = { id, script, input, output: null, error: null, timestamp: Date.now(), status: 'running' };
    this.history.unshift(entry);
    if (this.history.length > this.maxHistory) this.history.pop();
    
    try {
      // Create worker with script execution
      const workerCode = `
        self.onmessage = async function(e) {
          const { script, input } = e.data;
          try {
            // Simple sandbox executor (JavaScript, not Python)
            // In real scenario, this would use Pyodide or similar
            const fn = new Function('input', script);
            const result = await fn(input);
            self.postMessage({ success: true, result: JSON.stringify(result) });
          } catch (err) {
            self.postMessage({ success: false, error: err.message });
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      
      return new Promise((resolve) => {
        worker.onmessage = (e) => {
          const result = e.data;
          entry.status = result.success ? 'completed' : 'error';
          entry.output = result.success ? result.result : null;
          entry.error = result.error || null;
          worker.terminate();
          resolve(entry);
        };
        
        worker.onerror = (err) => {
          entry.status = 'error';
          entry.error = err.message;
          worker.terminate();
          resolve(entry);
        };
        
        worker.postMessage({ script, input });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          worker.terminate();
          entry.status = 'timeout';
          entry.error = 'Execution timeout';
          resolve(entry);
        }, 30000);
      });
    } catch (err) {
      entry.status = 'error';
      entry.error = err.message;
      return entry;
    }
  }
  
  // Create a script from task
  createTaskScript(task) {
    const templates = {
      'reminder': `
        // Reminder task: ${task.title}
        const dueDate = new Date('${task.dueDate || new Date()}');
        const now = new Date();
        const msUntilDue = dueDate - now;
        return {
          task: '${task.title}',
          msUntilDue,
          daysUntilDue: Math.ceil(msUntilDue / (1000 * 60 * 60 * 24)),
          isOverdue: msUntilDue < 0
        };
      `,
      'counter': `
        // Counter task
        let count = ${task.count || 0};
        const increment = ${task.increment || 1};
        count += increment;
        return { count, increment, task: '${task.title}' };
      `,
      'default': `
        // Default task script
        return { task: '${task.title}', completed: ${task.completed}, priority: '${task.priority}' };
      `
    };
    return templates[task.scriptType] || templates['default'];
  }
  
  getHistory() {
    return this.history;
  }
  
  clearHistory() {
    this.history = [];
  }
}

export const notebookExecutor = new NotebookExecutor();

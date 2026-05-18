// Gist Syncer -定时同步任务到GitHub Gist
const LAST_SYNC_KEY = 'hermes_last_sync_v1';
const SYNC_INTERVAL_KEY = 'hermes_sync_interval_v1'; // 'hourly' | 'daily' | 'manual'

export const gistSyncer = {
  getLastSync() {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? new Date(stored) : null;
  },
  
  setLastSync(date = new Date()) {
    localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
  },
  
  getSyncInterval() {
    return localStorage.getItem(SYNC_INTERVAL_KEY) || 'manual';
  },
  
  setSyncInterval(interval) {
    localStorage.setItem(SYNC_INTERVAL_KEY, interval);
  },
  
  async sync() {
    const tasks = window.__taskStore ? window.__taskStore.getState().tasks : [];
    const gistId = localStorage.getItem('gist_id');
    const token = localStorage.getItem('github_token');
    
    if (!gistId || !token) {
      console.warn('Gist sync not configured');
      return { success: false, error: 'not_configured' };
    }
    
    try {
      // Read existing gist
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch gist');
      }
      
      const gist = await response.json();
      const filename = Object.keys(gist.files)[0];
      
      // Update gist
      const updateResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            [filename]: {
              content: JSON.stringify(tasks, null, 2)
            }
          }
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update gist');
      }
      
      this.setLastSync();
      return { success: true, timestamp: new Date() };
    } catch (err) {
      console.error('Gist sync failed:', err);
      return { success: false, error: err.message };
    }
  },
  
  getSyncHistory() {
    try {
      const stored = localStorage.getItem('hermes_sync_history');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  },
  
  addSyncHistory(entry) {
    const history = this.getSyncHistory();
    history.unshift(entry);
    history.splice(10); // keep last 10
    localStorage.setItem('hermes_sync_history', JSON.stringify(history));
  }
};

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
  
  // Read gist config from gist-sync-config (same format as GistSyncModal)
  getConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem('gist-sync-config') || 'null');
      return cfg || {};
    } catch { return {}; }
  },

  async sync(tasksData) {
    // tasksData: full backup data object from useAppStore, or array (legacy)
    const cfg = this.getConfig();
    const gistId = cfg.gistId;
    const token = cfg.pat; // GistSyncModal stores PAT as 'pat'

    if (!gistId || !token) {
      console.warn('Gist sync not configured');
      return { success: false, error: 'not_configured' };
    }

    // Support both legacy array format and full backup object
    let tasks = [];
    let backupData = {};
    if (Array.isArray(tasksData)) {
      tasks = tasksData;
    } else if (tasksData && typeof tasksData === 'object') {
      // Full data object: useAppStore state
      tasks = tasksData.tasks || [];
      backupData = {
        projects: tasksData.projects || [],
        tagColors: tasksData.tagColors || {},
        tagGroups: tasksData.tagGroups || [],
        hermesTagColors: tasksData.hermesTagColors || {},
      };
    } else if (window.__appStore) {
      // Fallback: read directly from window.__appStore
      const store = window.__appStore.getState();
      tasks = store.tasks || [];
      backupData = {
        projects: store.projects || [],
        tagColors: store.tagColors || {},
        tagGroups: store.tagGroups || [],
        hermesTagColors: store.hermesTagColors || {},
      };
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
      
      // Build full backup content (v2 format with tasks + projects + tags)
      const content = {
        version: 2,
        timestamp: new Date().toISOString(),
        tasks,
        projects: backupData.projects || [],
        tagColors: backupData.tagColors || {},
        tagGroups: backupData.tagGroups || [],
        hermesTagColors: backupData.hermesTagColors || {},
      };
      const updateResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            [filename]: {
              content: JSON.stringify(content, null, 2)
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

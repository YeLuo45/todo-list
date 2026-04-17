const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Task data persistence
  loadTasks: () => ipcRenderer.invoke('load-tasks'),
  saveTasks: (data) => ipcRenderer.invoke('save-tasks', data),
  
  // Notifications
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  
  // Get data path for info display
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  
  // Platform info
  platform: process.platform
});

// SharedWorker for cross-tab sync
// 维护单一 GitHub Gist 连接，所有标签页共享

const SYNC_INTERVAL = 60000; // 60s
const GIST_FILENAME = 'data/todos.json';
const PORT_MAP = new Map(); // port -> clientId
let syncInterval = null;
let lastSyncTime = null;
let pendingChanges = new Map(); // taskId -> timestamp
let gistConfig = null; // { token, gistId }

// 连接到 GitHub Gist (通过 GitHub API)
// 文件路径: data/todos.json

self.onconnect = function(e) {
  const port = e.ports[0];
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  PORT_MAP.set(port, { clientId, lastPing: Date.now() });
  
  port.onmessage = function(event) {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'ping':
        // 心跳，保持连接活跃
        PORT_MAP.get(port).lastPing = Date.now();
        port.postMessage({ type: 'pong', payload: { time: Date.now() } });
        break;
        
      case 'task-change':
        // 任务变更通知其他标签页
        pendingChanges.set(payload.taskId, Date.now());
        broadcastToOthers(port, { type: 'task-changed', payload });
        break;
        
      case 'sync-request':
        // 主动同步请求
        handleSyncRequest(port, payload);
        break;
        
      case 'sync-complete':
        // 同步完成，清除待同步标记
        lastSyncTime = Date.now();
        pendingChanges.clear();
        broadcastToAll({ type: 'sync-complete', payload: { time: lastSyncTime } });
        break;
        
      case 'init-gist':
        // 初始化 Gist 配置
        gistConfig = { token: payload.token, gistId: payload.gistId };
        port.postMessage({ type: 'gist-initialized', payload: { success: true } });
        break;
    }
  };
  
  port.start();
  
  // 发送欢迎消息
  port.postMessage({ type: 'connected', payload: { clientId, lastSyncTime } });
  
  // 启动定时同步
  if (!syncInterval) {
    syncInterval = setInterval(broadcastSyncHeartbeat, SYNC_INTERVAL);
  }
};

function broadcastToOthers(sourcePort, message) {
  PORT_MAP.forEach((client, port) => {
    if (port !== sourcePort) {
      port.postMessage(message);
    }
  });
}

function broadcastToAll(message) {
  PORT_MAP.forEach((client, port) => {
    port.postMessage(message);
  });
}

function broadcastSyncHeartbeat() {
  const now = Date.now();
  PORT_MAP.forEach((client, port) => {
    port.postMessage({ 
      type: 'heartbeat', 
      payload: { 
        time: now, 
        lastSyncTime,
        pendingCount: pendingChanges.size 
      } 
    });
  });
}

async function handleSyncRequest(port, payload) {
  // 实现 GitHub Gist 同步逻辑
  // 从 useAppStore 获取 token/repo
  // 使用 GitHub REST API 读取/写入 Gist
  // 返回同步结果
  
  if (!gistConfig) {
    port.postMessage({ 
      type: 'sync-error', 
      payload: { error: 'Gist not initialized. Send init-gist first.' } 
    });
    return;
  }

  try {
    const { token, gistId } = gistConfig;
    const action = payload?.action || 'pull'; // 'pull' or 'push'

    if (action === 'pull') {
      // 从 Gist 拉取数据
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const gistData = await response.json();
      const fileContent = gistData.files[GIST_FILENAME];
      
      if (!fileContent) {
        // 文件不存在，返回空数据
        port.postMessage({ 
          type: 'sync-result', 
          payload: { 
            action: 'pull', 
            success: true, 
            data: null,
            lastSyncTime: lastSyncTime 
          } 
        });
        return;
      }

      const content = JSON.parse(fileContent.content);
      lastSyncTime = Date.now();
      
      port.postMessage({ 
        type: 'sync-result', 
        payload: { 
          action: 'pull', 
          success: true, 
          data: content,
          lastSyncTime 
        } 
      });
      
    } else if (action === 'push') {
      // 推送数据到 Gist
      const dataToSave = payload.data;
      
      // 先获取当前 Gist 以获取版本信息
      const getResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!getResponse.ok) {
        throw new Error(`GitHub API error: ${getResponse.status}`);
      }

      const gistData = await getResponse.json();
      const currentFiles = gistData.files;
      currentFiles[GIST_FILENAME] = {
        content: JSON.stringify(dataToSave, null, 2)
      };

      const updateResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          description: 'Todo List Sync - PowerSync',
          files: currentFiles
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`GitHub API error: ${updateResponse.status}`);
      }

      lastSyncTime = Date.now();
      pendingChanges.clear();
      
      port.postMessage({ 
        type: 'sync-result', 
        payload: { 
          action: 'push', 
          success: true, 
          lastSyncTime 
        } 
      });
      
      // 广播同步完成给所有标签页
      broadcastToAll({ 
        type: 'sync-complete', 
        payload: { time: lastSyncTime, data: dataToSave } 
      });
    }
  } catch (error) {
    port.postMessage({ 
      type: 'sync-error', 
      payload: { error: error.message, action: payload?.action || 'unknown' } 
    });
  }
}

// SharedWorker for cross-tab sync
// 维护单一 GitHub Gist 连接，所有标签页共享
// 支持离线操作队列持久化（页面刷新后恢复）

const SYNC_INTERVAL = 60000; // 60s
const GIST_FILENAME = 'data/todos.json';
const PORT_MAP = new Map(); // port -> clientId
const PENDING_OPS_KEY = 'hermes_pending_ops_v1';
let syncInterval = null;
let lastSyncTime = null;
let lastHeartbeatSent = null; // 上次心跳时间
let pendingChanges = new Map(); // taskId -> timestamp
let gistConfig = null; // { token, gistId }
let gistFetchController = null; // 用于取消正在进行的请求
let isGistOnline = true; // GitHub Gist 连通性状态
let reconnectAttempts = 0; // 断线重连尝试次数
const MAX_RECONNECT_INTERVAL = 300000; // 5min 最大重连间隔

// 持久化操作队列
let pendingOps = [];

function loadPendingOps() {
  try {
    const raw = localStorage.getItem(PENDING_OPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingOps() {
  try {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(pendingOps));
  } catch (e) {
    console.error('[syncWorker] Failed to save pending ops:', e);
  }
}

function clearPendingOps() {
  pendingOps = [];
  try {
    localStorage.removeItem(PENDING_OPS_KEY);
  } catch {}
}

// 启动时加载持久化的操作队列
pendingOps = loadPendingOps();
console.log(`[syncWorker] Loaded ${pendingOps.length} pending ops from storage`);

self.onconnect = function(e) {
  const port = e.ports[0];
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  PORT_MAP.set(port, { clientId, lastPing: Date.now() });

  port.onmessage = function(event) {
    const { type, payload } = event.data;

    switch (type) {
      case 'ping':
        PORT_MAP.get(port).lastPing = Date.now();
        port.postMessage({ type: 'pong', payload: { time: Date.now() } });
        break;

      case 'task-change':
        // 记录变更到队列并持久化
        const opId = `${payload.taskId}_${Date.now()}`;
        pendingOps.push({ id: opId, taskId: payload.taskId, type: payload.changeType, timestamp: Date.now() });
        pendingChanges.set(payload.taskId, Date.now());
        savePendingOps(); // 持久化到 localStorage
        broadcastToOthers(port, { type: 'task-changed', payload });
        // 通知所有客户端 pendingCount 更新
        broadcastToAll({ type: 'pending-updated', payload: { pendingCount: pendingOps.length } });
        break;

      case 'sync-request':
        handleSyncRequest(port, payload);
        break;

      case 'sync-complete':
        lastSyncTime = Date.now();
        pendingChanges.clear();
        pendingOps = [];
        clearPendingOps();
        broadcastToAll({ type: 'sync-complete', payload: { time: lastSyncTime } });
        broadcastToAll({ type: 'pending-updated', payload: { pendingCount: 0 } });
        break;

      case 'init-gist':
        gistConfig = { token: payload.token, gistId: payload.gistId };
        port.postMessage({ type: 'gist-initialized', payload: { success: true } });
        break;
    }
  };

  port.start();

  // 发送欢迎消息（带上当前 pendingCount）
  port.postMessage({ type: 'connected', payload: { clientId, lastSyncTime, pendingCount: pendingOps.length } });

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
  // 避免重复发送心跳（浏览器空闲时可能多次触发）
  if (lastHeartbeatSent && now - lastHeartbeatSent < SYNC_INTERVAL * 0.5) return;
  lastHeartbeatSent = now;
  PORT_MAP.forEach((client, port) => {
    port.postMessage({
      type: 'heartbeat',
      payload: {
        time: now,
        lastSyncTime,
        pendingCount: pendingOps.length,
        isGistOnline
      }
    });
  });
  // 断线时尝试增加重连间隔
  if (!isGistOnline) {
    reconnectAttempts = Math.min(reconnectAttempts + 1, 6);
    console.log(`[syncWorker] Reconnect attempt ${reconnectAttempts}, next interval: ${Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_INTERVAL)}ms`);
  }
}

/**
 * 自动合并策略：远程优先，但保留本地独有的非空字段
 */
function autoMerge(localTask, remoteTask) {
  const merged = { ...remoteTask };
  const localTime = new Date(localTask.updatedAt || 0).getTime();
  const remoteTime = new Date(remoteTask.updatedAt || 0).getTime();

  if (localTime > remoteTime) {
    Object.keys(localTask).forEach(key => {
      if (localTask[key] != null && localTask[key] !== '' && remoteTask[key] == null) {
        merged[key] = localTask[key];
      }
    });
    merged.updatedAt = localTask.updatedAt;
  }

  if (localTask.subtasks?.length && remoteTask.subtasks?.length) {
    const remoteSubtaskIds = new Set(remoteTask.subtasks.map(st => st.id));
    const uniqueLocalSubtasks = localTask.subtasks.filter(st => !remoteSubtaskIds.has(st.id));
    merged.subtasks = [...remoteTask.subtasks, ...uniqueLocalSubtasks];
  }

  return merged;
}

async function handleSyncRequest(port, payload) {
  if (!gistConfig) {
    port.postMessage({
      type: 'sync-error',
      payload: { error: 'Gist not initialized. Send init-gist first.' }
    });
    return;
  }

  // 取消正在进行的请求
  if (gistFetchController) {
    gistFetchController.abort();
  }
  gistFetchController = typeof AbortController !== 'undefined' ? new AbortController() : null;

  const doRetry = (attempts) => {
    const delay = Math.min(1000 * Math.pow(2, attempts), MAX_RECONNECT_INTERVAL);
    return new Promise((resolve) => setTimeout(resolve, delay));
  };

  const performFetch = async (action) => {
    const { token, gistId } = gistConfig;

    if (action === 'pull') {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: gistFetchController?.signal
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const gistData = await response.json();
      const fileContent = gistData.files[GIST_FILENAME];

      if (!fileContent) {
        return { action: 'pull', success: true, data: null, lastSyncTime };
      }

      const content = JSON.parse(fileContent.content);
      lastSyncTime = Date.now();
      isGistOnline = true;
      reconnectAttempts = 0;

      const localTasks = payload?.localTasks;
      let mergedData = content;

      if (localTasks && Array.isArray(content.tasks) && Array.isArray(localTasks)) {
        const localMap = new Map(localTasks.map(t => [t.id, t]));
        const conflicts = [];

        content.tasks.forEach(remoteTask => {
          const localTask = localMap.get(remoteTask.id);
          if (localTask) {
            const remoteTime = new Date(remoteTask.updatedAt || 0).getTime();
            const localTime = new Date(localTask.updatedAt || 0).getTime();
            if (remoteTime > localTime) {
              conflicts.push({ local: localTask, remote: remoteTask });
            }
          }
        });

        if (conflicts.length > 0) {
          console.log(`[syncWorker] Detected ${conflicts.length} conflicts, auto-merging...`);
          const mergedTasks = [...content.tasks];
          conflicts.forEach(({ local, remote }) => {
            const merged = autoMerge(local, remote);
            const idx = mergedTasks.findIndex(t => t.id === merged.id);
            if (idx >= 0) mergedTasks[idx] = merged;
          });
          mergedData = { ...content, tasks: mergedTasks, autoMerged: true };
        }
      }

      return {
        type: 'sync-result',
        payload: {
          action: 'pull',
          success: true,
          data: mergedData,
          lastSyncTime: lastSyncTime,
          pendingCount: pendingOps.length,
          hadConflicts: !!content.autoMerged,
          isOnline: true
        }
      };

    } else if (action === 'push') {
      const { tasks } = payload;
      const updatedContent = JSON.stringify({
        tasks: tasks || [],
        savedAt: new Date().toISOString(),
        version: 1
      });

      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: {
              content: updatedContent
            }
          }
        }),
        signal: gistFetchController?.signal
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      lastSyncTime = Date.now();
      pendingChanges.clear();
      pendingOps = [];
      clearPendingOps();
      isGistOnline = true;
      reconnectAttempts = 0;

      return {
        type: 'sync-result',
        payload: {
          action: 'push',
          success: true,
          lastSyncTime: lastSyncTime,
          pendingCount: 0,
          isOnline: true
        }
      };
    }
  };

  try {
    const action = payload?.action || 'pull';
    let result;

    for (let attempt = 0; attempt <= reconnectAttempts; attempt++) {
      try {
        const outcome = await performFetch(action);
        if (outcome.type === 'sync-result') {
          result = outcome;
        } else {
          result = outcome;
        }
        break;
      } catch (error) {
        console.warn(`[syncWorker] Fetch attempt ${attempt + 1} failed:`, error.message);
        if (attempt < reconnectAttempts || attempt < 3) {
          await doRetry(attempt);
          isGistOnline = false;
          broadcastToAll({ type: 'online-status', payload: { isOnline: false } });
        } else {
          isGistOnline = false;
          broadcastToAll({ type: 'online-status', payload: { isOnline: false } });
          port.postMessage({
            type: 'sync-error',
            payload: { error: error.message, isOnline: false }
          });
          return;
        }
      }
    }

    if (result) {
      if (result.type === 'sync-result') {
        port.postMessage(result);
      } else {
        port.postMessage({ type: 'sync-result', payload: result });
      }
    }
  } catch (error) {
    console.error('[syncWorker] Sync error:', error);
    isGistOnline = false;
    broadcastToAll({ type: 'online-status', payload: { isOnline: false } });
    port.postMessage({
      type: 'sync-error',
      payload: { error: error.message, isOnline: false }
    });
  }
}
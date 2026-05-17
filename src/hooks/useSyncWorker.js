import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * useSyncWorker - SharedWorker 同步 hook
 * 跨标签页同步任务变更
 */
export function useSyncWorker(onTaskChange) {
  const workerRef = useRef(null);
  const portRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  
  const taskChangeRef = useRef(onTaskChange);
  taskChangeRef.current = onTaskChange;

  useEffect(() => {
    // 创建 SharedWorker
    if (typeof SharedWorker !== 'undefined') {
      try {
        workerRef.current = new SharedWorker(
          new URL('../workers/syncWorker.js', import.meta.url),
          { name: 'hermes-sync-worker' }
        );
        
        const port = workerRef.current.port;
        portRef.current = port;
        
        port.onmessage = (event) => {
          const { type, payload } = event.data;
          
          switch (type) {
            case 'connected':
              setConnected(true);
              break;
            case 'task-changed':
              taskChangeRef.current?.(payload);
              break;
            case 'heartbeat':
              setLastHeartbeat(payload.time);
              setPendingCount(payload.pendingCount);
              break;
            case 'sync-complete':
              console.log('[useSyncWorker] Sync complete:', payload);
              break;
          }
        };
        
        port.start();
        
        // 定时 ping 保持连接
        const pingInterval = setInterval(() => {
          if (portRef.current) {
            portRef.current.postMessage({ type: 'ping' });
          }
        }, 30000);
        
        return () => {
          clearInterval(pingInterval);
          port.close();
          setConnected(false);
        };
      } catch (e) {
        console.error('[useSyncWorker] SharedWorker creation failed:', e);
      }
    }
  }, []);

  // 通知其他标签页任务变更
  const notifyTaskChange = useCallback((task) => {
    if (portRef.current) {
      portRef.current.postMessage({
        type: 'task-change',
        payload: task
      });
    }
  }, []);

  // 请求同步
  const requestSync = useCallback(() => {
    if (portRef.current) {
      portRef.current.postMessage({ type: 'sync-request' });
    }
  }, []);

  return {
    connected,
    lastHeartbeat,
    pendingCount,
    notifyTaskChange,
    requestSync,
  };
}

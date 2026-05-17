import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const isOnline = useAppStore((s) => s.isOnline);
  
  useEffect(() => {
    const handleOnline = () => useAppStore.getState().setOnline(true);
    const handleOffline = () => useAppStore.getState().setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 初始化状态
    useAppStore.getState().setOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  if (isOnline) return null;
  
  return (
    <div className="offline-banner">
      <span>📡</span>
      <span>离线模式 — 修改将在恢复连接后同步</span>
    </div>
  );
}

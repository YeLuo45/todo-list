import './SyncStatus.css';

const statusConfig = {
  idle: { icon: '⚪', label: '未连接', color: '#94a3b8' },
  unauthenticated: { icon: '🔓', label: '未登录', color: '#94a3b8' },
  syncing: { icon: '🔄', label: '同步中...', color: '#f59e0b' },
  synced: { icon: '✅', label: '已同步', color: '#22c55e' },
  error: { icon: '❌', label: '同步失败', color: '#ef4444' },
  offline: { icon: '📴', label: '离线', color: '#94a3b8' },
};

export default function SyncStatus({ status, lastSynced, onClick, syncConnected, pendingCount }) {
  const config = statusConfig[status] || statusConfig.idle;
  const timeStr = lastSynced
    ? new Date(lastSynced).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <button className="sync-status" onClick={onClick} title={config.label}>
      <span className="sync-icon">{config.icon}</span>
      <span className="sync-label">{config.label}</span>
      {syncConnected !== undefined && (
        <span
          className="sync-connection"
          style={{ color: syncConnected ? '#22c55e' : '#ef4444' }}
          title={syncConnected ? 'SharedWorker 已连接' : 'SharedWorker 未连接'}
        >
          {syncConnected ? '●' : '○'}
        </span>
      )}
      {pendingCount > 0 && (
        <span className="sync-pending" title={`${pendingCount} 个待同步项`}>
          {pendingCount}
        </span>
      )}
      {timeStr && <span className="sync-time">{timeStr}</span>}
    </button>
  );
}

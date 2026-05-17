import './ConflictModal.css';

export default function ConflictModal({ 
  visible, 
  localData, 
  remoteData, 
  onLocalWins, 
  onRemoteWins, 
  onMerge 
}) {
  if (!visible) return null;

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString();
  };

  const localTime = localData?.updatedAt || localData?.savedAt;
  const remoteTime = remoteData?.updatedAt || remoteData?.savedAt;

  return (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-modal-header">
          <h3>⚠️ 同步冲突</h3>
          <p>检测到本地和远程数据不一致，请选择保留哪个版本</p>
        </div>
        
        <div className="conflict-modal-body">
          <div className="conflict-version">
            <h4>📱 本地版本</h4>
            <p className="conflict-time">修改时间: {formatDate(localTime)}</p>
            <p className="conflict-count">任务数: {localData?.tasks?.length || 0}</p>
          </div>
          
          <div className="conflict-vs">VS</div>
          
          <div className="conflict-version">
            <h4>☁️ 远程版本</h4>
            <p className="conflict-time">修改时间: {formatDate(remoteTime)}</p>
            <p className="conflict-count">任务数: {remoteData?.tasks?.length || 0}</p>
          </div>
        </div>
        
        <div className="conflict-modal-actions">
          <button className="conflict-btn local" onClick={onLocalWins}>
            保留本地
          </button>
          <button className="conflict-btn remote" onClick={onRemoteWins}>
            保留远程
          </button>
          <button className="conflict-btn merge" onClick={onMerge}>
            手动合并
          </button>
        </div>
      </div>
    </div>
  );
}
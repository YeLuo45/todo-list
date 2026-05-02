import './KanbanSettingsModal.css';

const SWIMLANE_KEYS = {
  priority: { P0: 'P0 紧急', P1: 'P1 普通', P2: 'P2 低优先级' },
  tag: {}, // dynamic
};

const COLUMNS = [
  { id: 'todo', label: '待办' },
  { id: 'in-progress', label: '进行中' },
  { id: 'done', label: '已完成' },
];

export default function KanbanSettingsModal({
  swimlaneBy, wipLimits, swimlaneWipLimits,
  onClose, onSwimlaneChange, onWipChange, onSwimlaneWipChange,
}) {
  const activeKeys = Object.keys(swimlaneWipLimits).filter((k) => swimlaneWipLimits[k] > 0);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <h3>⚙️ 看板设置</h3>

        <section className="settings-section">
          <h4>泳道分组模式</h4>
          <select
            value={swimlaneBy}
            onChange={(e) => onSwimlaneChange(e)}
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="none">无（不分组）</option>
            <option value="priority">按优先级</option>
            <option value="tag">按标签</option>
          </select>
        </section>

        <section className="settings-section">
          <h4>列 WIP 限制</h4>
          <div className="settings-wip-grid">
            {COLUMNS.map((col) => (
              <div key={col.id} className="settings-wip-row">
                <label>{col.label}</label>
                <input
                  type="number" min="0" max="99"
                  value={wipLimits[col.id] || 0}
                  onChange={(e) => onWipChange(col.id, e.target.value)}
                  style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h4>泳道独立 WIP 限制</h4>
          <p className="settings-hint">开启泳道分组后，可为每个泳道设置独立 WIP 限制（0=不限制）</p>
          <div className="settings-swimlane-wip">
            {swimlaneBy !== 'none' && (
              <>
                {['P0', 'P1', 'P2'].map((key) => (
                  <div key={key} className="settings-wip-row">
                    <label>🔴 {key === 'P0' ? 'P0 紧急' : key === 'P1' ? 'P1 普通' : 'P2 低优先级'}</label>
                    <input
                      type="number" min="0" max="99"
                      value={swimlaneWipLimits[key] || 0}
                      onChange={(e) => onSwimlaneWipChange(key, e.target.value)}
                      style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                  </div>
                ))}
                {swimlaneBy === 'tag' && (
                  <p className="settings-hint" style={{ fontSize: 11 }}>标签泳道 WIP 在任务导入后自动识别</p>
                )}
              </>
            )}
            {swimlaneBy === 'none' && (
              <p className="settings-hint">请先选择泳道分组模式</p>
            )}
          </div>
        </section>

        <button className="settings-close-btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

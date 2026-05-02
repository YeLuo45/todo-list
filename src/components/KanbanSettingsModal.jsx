import { useMemo } from 'react';
import './KanbanSettingsModal.css';
import { getAllProjects } from '../utils/projects';

const COLUMNS = [
  { id: 'todo', label: '待办' },
  { id: 'in-progress', label: '进行中' },
  { id: 'done', label: '已完成' },
];

export default function KanbanSettingsModal({
  swimlaneBy, wipLimits, swimlaneWipLimits,
  onClose, onSwimlaneChange, onWipChange, onSwimlaneWipChange,
}) {
  const projects = useMemo(() => getAllProjects(), []);

  const swimlaneKeys = useMemo(() => {
    if (swimlaneBy === 'priority') {
      return [
        { key: 'P0', label: '🔴 P0 紧急' },
        { key: 'P1', label: '🟡 P1 普通' },
        { key: 'P2', label: '⚪ P2 低优先级' },
      ];
    }
    if (swimlaneBy === 'project') {
      return projects.map((p) => ({ key: p.id, label: `● ${p.name}`, color: p.color }));
    }
    return [];
  }, [swimlaneBy, projects]);

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
            <option value="project">按项目</option>
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
            {swimlaneBy !== 'none' && swimlaneKeys.length > 0 && (
              <>
                {swimlaneKeys.map(({ key, label, color }) => (
                  <div key={key} className="settings-wip-row">
                    <label style={color ? { color } : {}}>{label}</label>
                    <input
                      type="number" min="0" max="99"
                      value={swimlaneWipLimits[key] || 0}
                      onChange={(e) => onSwimlaneWipChange(key, e.target.value)}
                      style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                  </div>
                ))}
              </>
            )}
            {swimlaneBy === 'none' && (
              <p className="settings-hint">请先选择泳道分组模式</p>
            )}
            {swimlaneBy === 'tag' && (
              <p className="settings-hint" style={{ fontSize: 11 }}>标签泳道 WIP 在任务导入后自动识别</p>
            )}
          </div>
        </section>

        <button className="settings-close-btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

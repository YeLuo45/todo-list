import { useState, useEffect, useMemo, useRef } from 'react';
import './KanbanSettingsModal.css';
import { getAllProjects } from '../utils/projects';
import {
  getColumnOrder,
  saveColumnOrder,
  getOrderedColumns,
  getLaneColors,
  saveLaneColors,
  LANE_COLOR_PRESETS,
  DEFAULT_COLUMNS,
} from '../utils/kanbanSettings';

export default function KanbanSettingsModal({
  swimlaneBy, wipLimits, swimlaneWipLimits,
  onClose, onSwimlaneChange, onWipChange, onSwimlaneWipChange,
}) {
  const projects = useMemo(() => getAllProjects(), []);

  // Column ordering state
  const [columnOrder, setColumnOrder] = useState(() => getColumnOrder());
  const [draggingColIdx, setDraggingColIdx] = useState(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Lane colors state
  const [laneColors, setLaneColors] = useState(() => getLaneColors());

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

  // Column drag handlers
  const handleColDragStart = (idx) => {
    dragItem.current = idx;
    setDraggingColIdx(idx);
  };

  const handleColDragEnter = (idx) => {
    dragOverItem.current = idx;
    if (dragItem.current === idx) return;
    const newOrder = [...columnOrder];
    const draggedId = newOrder[dragItem.current];
    newOrder.splice(dragItem.current, 1);
    newOrder.splice(idx, 0, draggedId);
    dragItem.current = idx;
    setColumnOrder(newOrder);
  };

  const handleColDragEnd = () => {
    setDraggingColIdx(null);
    dragItem.current = null;
    dragOverItem.current = null;
    saveColumnOrder(columnOrder);
  };

  // Lane color handlers
  const handleLaneColorChange = (key, color) => {
    const updated = { ...laneColors, [key]: color };
    setLaneColors(updated);
    saveLaneColors(updated);
  };

  // Auto-assign colors for projects without colors
  useEffect(() => {
    if (swimlaneBy === 'project') {
      const updated = { ...laneColors };
      let changed = false;
      projects.forEach((p) => {
        if (!updated[p.id]) {
          // Find first unused preset color
          const usedSet = new Set(Object.values(updated));
          for (const preset of LANE_COLOR_PRESETS) {
            if (!usedSet.has(preset.value)) {
              updated[p.id] = preset.value;
              changed = true;
              break;
            }
          }
          if (!changed && !updated[p.id]) {
            updated[p.id] = LANE_COLOR_PRESETS[0].value;
            changed = true;
          }
        }
      });
      if (changed) {
        setLaneColors(updated);
        saveLaneColors(updated);
      }
    }
  }, [swimlaneBy, projects]);

  // Get ordered columns with their config
  const orderedColumns = useMemo(() => {
    return columnOrder.map(id => DEFAULT_COLUMNS.find(c => c.id === id)).filter(Boolean);
  }, [columnOrder]);

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
          <h4>列排序（拖拽调整顺序）</h4>
          <div className="column-order-list">
            {orderedColumns.map((col, idx) => (
              <div
                key={col.id}
                className={`column-order-item ${draggingColIdx === idx ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleColDragStart(idx)}
                onDragEnter={() => handleColDragEnter(idx)}
                onDragEnd={handleColDragEnd}
                onDragOver={(e) => e.preventDefault()}
              >
                <span className="column-order-drag-handle">⋮⋮</span>
                <span
                  className="column-order-color"
                  style={{ backgroundColor: col.color }}
                />
                <span className="column-order-label">{col.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h4>泳道颜色</h4>
          <p className="settings-hint">为泳道设置显示颜色（按项目分组时自动分配）</p>
          <div className="swimlane-colors-list">
            {swimlaneBy !== 'none' && swimlaneKeys.length > 0 && (
              <>
                {swimlaneKeys.map(({ key, label }) => (
                  <div key={key} className="swimlane-color-row">
                    <span className="swimlane-color-label" style={laneColors[key] ? { color: laneColors[key] } : {}}>
                      {label}
                    </span>
                    <div className="swimlane-color-presets">
                      {LANE_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          className={`swimlane-color-btn ${laneColors[key] === preset.value ? 'selected' : ''}`}
                          style={{ backgroundColor: preset.value }}
                          title={preset.label}
                          onClick={() => handleLaneColorChange(key, preset.value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
            {swimlaneBy === 'none' && (
              <p className="settings-hint">请先选择泳道分组模式</p>
            )}
          </div>
        </section>

        <section className="settings-section">
          <h4>列 WIP 限制</h4>
          <div className="settings-wip-grid">
            {orderedColumns.map((col) => (
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

import { useState, useMemo } from 'react';
import './GanttSettingsModal.css';
import { MILESTONE_COLORS } from '../utils/milestone';

const PRESET_COLORS = [
  { value: '#ef4444', label: '红' },
  { value: '#f97316', label: '橙' },
  { value: '#eab308', label: '黄' },
  { value: '#22c55e', label: '绿' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#8b5cf6', label: '紫' },
  { value: '#6b7280', label: '灰' },
  { value: '#ec4899', label: '粉' },
];

export default function GanttSettingsModal({ milestones, onMilestoneColorChange, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal gantt-settings-modal">
        <h3>⚙️ 甘特图设置</h3>

        <section className="settings-section">
          <h4>里程碑颜色</h4>
          <p className="settings-hint">为每个里程碑设置显示颜色</p>
          <div className="milestone-colors-list">
            {milestones.length === 0 ? (
              <p className="settings-hint">暂无里程碑</p>
            ) : (
              milestones.map((milestone) => (
                <div key={milestone.id} className="milestone-color-row">
                  <span className="milestone-color-label" title={milestone.title}>
                    {milestone.title.length > 15 ? milestone.title.slice(0, 15) + '...' : milestone.title}
                  </span>
                  <div className="milestone-color-presets">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.value}
                        className={`milestone-color-btn ${milestone.color === preset.value ? 'selected' : ''}`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.label}
                        onClick={() => onMilestoneColorChange(milestone.id, preset.value)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <button className="settings-close-btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

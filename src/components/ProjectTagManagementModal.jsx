import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './ProjectTagManagementModal.css';

const PRESET_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#A55EEA', '#576574', '#FF9FF3',
  '#54A0FF', '#5F27CD', '#01C896', '#EE5A24',
];

export default function ProjectTagManagementModal({ onClose }) {
  const [tab, setTab] = useState('projects');

  const projects = useAppStore((s) => s.projects);
  const tagGroups = useAppStore((s) => s.tagGroups);
  const { addProject, updateProject, deleteProject } = useAppStore();
  const { addTagGroup, updateTagGroup, deleteTagGroup } = useAppStore();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ptm-modal">
        <h3>🗂️ 管理项目与标签</h3>

        <div className="ptm-tabs">
          <button className={`ptm-tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
            📁 项目
          </button>
          <button className={`ptm-tab ${tab === 'tags' ? 'active' : ''}`} onClick={() => setTab('tags')}>
            🏷️ 标签
          </button>
        </div>

        {tab === 'projects' ? (
          <ProjectsPanel
            projects={projects}
            onAdd={(p) => addProject(p)}
            onUpdate={(id, u) => updateProject(id, u)}
            onDelete={(id) => deleteProject(id)}
          />
        ) : (
          <TagsPanel
            tagGroups={tagGroups}
            onAdd={(g) => addTagGroup(g)}
            onUpdate={(id, u) => updateTagGroup(id, u)}
            onDelete={(id) => deleteTagGroup(id)}
          />
        )}

        <div className="ptm-footer">
          <button className="btn-close" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function ProjectsPanel({ projects, onAdd, onUpdate, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#48DBFB');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#48DBFB');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ id: Date.now().toString(), name: newName.trim(), color: newColor });
    setNewName('');
    setShowAdd(false);
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim()) return;
    onUpdate(id, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color || '#48DBFB');
    setShowAdd(false);
  };

  return (
    <div className="ptm-panel">
      {showAdd ? (
        <div className="ptm-add-form">
          <input
            type="text"
            placeholder="项目名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <div className="color-picker-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${newColor === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <div className="form-actions">
            <button className="btn-add" onClick={handleAdd}>✅ 添加</button>
            <button className="btn-cancel" onClick={() => setShowAdd(false)}>取消</button>
          </div>
        </div>
      ) : (
        <button className="btn-add-root" onClick={() => setShowAdd(true)}>+ 新建项目</button>
      )}

      <div className="ptm-list">
        {projects.length === 0 && !showAdd && (
          <p className="ptm-empty">暂无项目</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="ptm-item">
            {editingId === p.id ? (
              <div className="ptm-edit-form">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <div className="color-picker-row">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`color-swatch ${editColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                </div>
                <div className="form-actions">
                  <button className="btn-add" onClick={() => handleSaveEdit(p.id)}>💾 保存</button>
                  <button className="btn-cancel" onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <div className="ptm-item-row">
                <span className="project-dot" style={{ background: p.color || '#48DBFB' }}>●</span>
                <span className="ptm-item-name">{p.name}</span>
                <div className="ptm-item-actions">
                  <button onClick={() => startEdit(p)}>✏️</button>
                  <button onClick={() => onDelete(p.id)}>🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TagsPanel({ tagGroups, onAdd, onUpdate, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#FF6B6B');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#FF6B6B');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ id: Date.now().toString(), name: newName.trim(), color: newColor });
    setNewName('');
    setShowAdd(false);
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim()) return;
    onUpdate(id, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditColor(g.color || '#FF6B6B');
    setShowAdd(false);
  };

  return (
    <div className="ptm-panel">
      {showAdd ? (
        <div className="ptm-add-form">
          <input
            type="text"
            placeholder="标签名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <div className="color-picker-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${newColor === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <div className="form-actions">
            <button className="btn-add" onClick={handleAdd}>✅ 添加</button>
            <button className="btn-cancel" onClick={() => setShowAdd(false)}>取消</button>
          </div>
        </div>
      ) : (
        <button className="btn-add-root" onClick={() => setShowAdd(true)}>+ 新建标签</button>
      )}

      <div className="ptm-list">
        {tagGroups.length === 0 && !showAdd && (
          <p className="ptm-empty">暂无标签</p>
        )}
        {tagGroups.map((g) => (
          <div key={g.id} className="ptm-item">
            {editingId === g.id ? (
              <div className="ptm-edit-form">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <div className="color-picker-row">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`color-swatch ${editColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                </div>
                <div className="form-actions">
                  <button className="btn-add" onClick={() => handleSaveEdit(g.id)}>💾 保存</button>
                  <button className="btn-cancel" onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <div className="ptm-item-row">
                <span className="tag-dot" style={{ background: g.color || '#FF6B6B' }}>●</span>
                <span className="ptm-item-name">{g.name}</span>
                <div className="ptm-item-actions">
                  <button onClick={() => startEdit(g)}>✏️</button>
                  <button onClick={() => onDelete(g.id)}>🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
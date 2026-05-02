import { useState, useMemo } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getProjectTree, createProject, updateProject, deleteProject, getAllProjects } from '../utils/projects';
import './ProjectSidebar.css';

export default function ProjectSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#48DBFB');
  const { filterProject, setFilterProject, allTasks } = useTaskContext();

  const tree = useMemo(() => getProjectTree(), [showManage]);

  const projectTaskCount = useMemo(() => {
    const counts = {};
    allTasks.forEach((t) => {
      if (t.projectId) {
        counts[t.projectId] = (counts[t.projectId] || 0) + 1;
      }
    });
    return counts;
  }, [allTasks]);

  if (collapsed) {
    return (
      <div className="project-sidebar collapsed">
        <button className="sidebar-toggle" onClick={() => setCollapsed(false)} title="展开项目">▶</button>
        <button className="sidebar-manage-btn" onClick={() => { setCollapsed(false); setShowManage(true); }} title="管理项目">⚙️</button>
      </div>
    );
  }

  return (
    <div className="project-sidebar">
      <div className="sidebar-header">
        <span>📁 项目</span>
        <div className="sidebar-header-btns">
          <button className="sidebar-manage-btn" onClick={() => setShowManage(true)} title="管理项目">⚙️</button>
          <button className="sidebar-toggle" onClick={() => setCollapsed(true)} title="收起">◀</button>
        </div>
      </div>

      <div className="sidebar-projects">
        <div
          className={`sidebar-project-item ${!filterProject ? 'active' : ''}`}
          onClick={() => setFilterProject(null)}
        >
          <span className="project-dot" style={{ background: '#888' }}>●</span>
          <span className="project-name">全部任务</span>
        </div>

        <ProjectTree
          nodes={tree}
          filterProject={filterProject}
          setFilterProject={setFilterProject}
          projectTaskCount={projectTaskCount}
          depth={0}
        />
      </div>

      {showManage && (
        <ProjectManageModal
          onClose={() => setShowManage(false)}
        />
      )}
    </div>
  );
}

function ProjectTree({ nodes, filterProject, setFilterProject, projectTaskCount, depth }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  if (!nodes || nodes.length === 0) return null;

  return nodes.map((node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[node.id];
    return (
      <div key={node.id} className="project-tree-node">
        <div className={`sidebar-project-item ${filterProject === node.id ? 'active' : ''}`} style={{ paddingLeft: `${8 + depth * 16}px` }}>
          {hasChildren && (
            <button className="tree-expand-btn" onClick={() => toggle(node.id)}>
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span style={{ width: 14, display: 'inline-block' }} />}
          <span className="project-dot" style={{ background: node.color || '#48DBFB' }}>●</span>
          <span className="project-name" onClick={() => setFilterProject(node.id)}>{node.name}</span>
          {projectTaskCount[node.id] != null && (
            <span className="project-count">{projectTaskCount[node.id]}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <ProjectTree
            nodes={node.children}
            filterProject={filterProject}
            setFilterProject={setFilterProject}
            projectTaskCount={projectTaskCount}
            depth={depth + 1}
          />
        )}
      </div>
    );
  });
}

function ProjectManageModal({ onClose }) {
  const [projects, setProjects] = useState(() => getAllProjects());
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#48DBFB');
  const [editParent, setEditParent] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#48DBFB');
  const [newParent, setNewParent] = useState(null);

  const COLORS = [
    '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
    '#1DD1A1', '#A55EEA', '#576574', '#FF9FF3',
  ];

  const handleAdd = () => {
    if (!newName.trim()) return;
    const p = createProject(newName.trim(), newParent || null, newColor);
    setProjects(getAllProjects());
    setNewName('');
    setShowAdd(false);
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim()) return;
    updateProject(id, { name: editName.trim(), color: editColor, parentId: editParent });
    setProjects(getAllProjects());
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm('删除项目？其子项目也会被删除，任务不会删除。')) return;
    deleteProject(id);
    setProjects(getAllProjects());
  };

  const rootProjects = projects.filter((p) => !p.parentId);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="project-manage-modal">
        <h3>⚙️ 管理项目</h3>

        {showAdd ? (
          <div className="add-project-form">
            <input
              type="text"
              placeholder="项目名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="color-picker-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${newColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <select value={newParent || ''} onChange={(e) => setNewParent(e.target.value || null)}>
              <option value="">无父项目（顶级）</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="form-actions">
              <button className="btn-add" onClick={handleAdd}>✅ 添加</button>
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>取消</button>
            </div>
          </div>
        ) : (
          <button className="btn-add-root" onClick={() => setShowAdd(true)}>+ 新建项目</button>
        )}

        <div className="project-list">
          {rootProjects.length === 0 && !showAdd && (
            <p className="no-projects">暂无项目，点击"新建项目"创建</p>
          )}
          {rootProjects.map((p) => (
            <div key={p.id} className="project-manage-item">
              {editingId === p.id ? (
                <div className="project-edit-form">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <div className="color-picker-row">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        className={`color-swatch ${editColor === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <select value={editParent || ''} onChange={(e) => setEditParent(e.target.value || null)}>
                    <option value="">无父项目</option>
                    {projects.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <div className="form-actions">
                    <button className="btn-add" onClick={() => handleSaveEdit(p.id)}>💾 保存</button>
                    <button className="btn-cancel" onClick={() => setEditingId(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <div className="project-manage-row">
                  <span className="project-dot" style={{ background: p.color || '#48DBFB' }}>●</span>
                  <span className="project-manage-name">{p.name}</span>
                  <div className="project-manage-actions">
                    <button onClick={() => { setEditingId(p.id); setEditName(p.name); setEditColor(p.color); setEditParent(p.parentId); }}>✏️</button>
                    <button onClick={() => handleDelete(p.id)}>🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button className="btn-close" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

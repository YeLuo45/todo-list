import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getTagGroups, getTagColors } from '../utils/projects';
import './FilterBar.css';
import './TagBatchRenameModal.css';

// Web Worker for search
let searchWorker = null;
let searchRequestId = 0;
let pendingSearch = null;

function initSearchWorker() {
  if (searchWorker) return searchWorker;
  try {
    searchWorker = new Worker(
      new URL('../workers/searchWorker.js', import.meta.url),
      { type: 'module' }
    );
    searchWorker.onmessage = (e) => {
      const { type, requestId, payload } = e.data;
      if (type === 'searchResult' && pendingSearch && pendingSearch.requestId === requestId) {
        pendingSearch.resolve(payload);
        pendingSearch = null;
      }
    };
    searchWorker.onerror = (e) => {
      console.error('[FilterBar] Search worker error:', e);
    };
  } catch (e) {
    console.error('[FilterBar] Failed to init search worker:', e);
  }
  return searchWorker;
}

function searchWithWorker(tasks, query) {
  return new Promise((resolve) => {
    const worker = initSearchWorker();
    if (!worker) {
      // Fallback to sync search
      resolve({ matchedIds: tasks.map(t => t.id), count: tasks.length });
      return;
    }
    
    const requestId = ++searchRequestId;
    pendingSearch = { requestId, resolve };
    worker.postMessage({ type: 'search', payload: { tasks, query }, requestId });
    
    // Timeout fallback
    setTimeout(() => {
      if (pendingSearch && pendingSearch.requestId === requestId) {
        pendingSearch.resolve({ matchedIds: tasks.map(t => t.id), count: tasks.length });
        pendingSearch = null;
      }
    }, 1000);
  });
}

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const FilterBar = forwardRef(function FilterBar({ resultCount, totalCount }, ref) {
  const {
    filterTags,
    setFilterTags,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    getAllTags,
    hideCompleted,
    setHideCompleted,
    dateFilter,
    setDateFilter,
    allTasks,
    updateTask,
    setSearchResult,
  } = useTaskContext();

  const inputRef = useRef();
  const allTags = getAllTags();
  const [selectedTags, setSelectedTags] = useState(new Set()); // multi-select for batch ops
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  // Debounced search query (300ms)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Worker-based search when debounced query changes
  useEffect(() => {
    if (!debouncedSearchQuery) {
      setSearchResult(null); // Clear search result when query is empty
      return;
    }

    let cancelled = false;
    searchWithWorker(allTasks, debouncedSearchQuery).then((result) => {
      if (!cancelled) {
        setSearchResult(result.matchedIds);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, allTasks, setSearchResult]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // Tag usage counts
  const tagCounts = useMemo(() => {
    const counts = {};
    allTasks.forEach((t) => (t.tags || []).forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
    return counts;
  }, [allTasks]);

  // Tag groups
  const tagGroups = useMemo(() => getTagGroups(), [showTagManager]);
  const tagColors = useMemo(() => getTagColors(), [showTagManager]);

  const groupedTags = useMemo(() => {
    const groups = {};
    const ungrouped = [];
    allTags.forEach((tag) => {
      const group = tagGroups.find((g) => (g.tags || []).includes(tag));
      if (group) {
        if (!groups[group.id]) groups[group.id] = { ...group, tags: [] };
        groups[group.id].tags.push(tag);
      } else {
        ungrouped.push(tag);
      }
    });
    return { groups: Object.values(groups), ungrouped };
  }, [allTags, tagGroups]);

  const toggleTag = (tag) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleSelect = (tag, e) => {
    e.stopPropagation();
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const handleClear = () => setSearchQuery('');

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="search-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={searchQuery ? '' : '搜索任务... (Ctrl+K)'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <>
              <span className="search-count">{resultCount}/{totalCount}</span>
              <button className="search-clear" onClick={handleClear} title="清除 (Esc)">×</button>
            </>
          )}
        </div>

        <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="createdAt">创建时间</option>
          <option value="dueDate">截止日期</option>
          <option value="priority">优先级</option>
          <option value="updatedAt">更新时间</option>
        </select>

        <label className="hide-completed">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          隐藏已完成
        </label>

        <div className="date-filter">
          <label>日期筛选：</label>
          <input type="date" value={dateFilter || ''} onChange={(e) => setDateFilter(e.target.value || null)} />
          {dateFilter && <button className="btn-clear-date" onClick={() => setDateFilter(null)}>清除</button>}
        </div>

        <button className="btn-tag-manager" onClick={() => setShowTagManager(true)} title="管理标签">🏷️</button>
      </div>

      {selectedTags.size >= 2 && (
        <div className="batch-actions">
          <span>已选择 {selectedTags.size} 个标签</span>
          <button className="btn-batch-rename" onClick={() => setShowBatchModal(true)}>✏️ 批量重命名</button>
          <button className="btn-batch-clear" onClick={() => setSelectedTags(new Set())}>取消选择</button>
        </div>
      )}

      {allTags.length > 0 && (
        <div className="tag-filters">
          <span className="tag-filter-label">按标签筛选：</span>
          <button
            className={`tag-filter-btn ${filterTags.length === 0 ? 'active' : ''}`}
            onClick={() => setFilterTags([])}
          >
            全部
          </button>

          {groupedTags.groups.map((group) => (
            <div key={group.id} className="tag-group">
              <span className="tag-group-header" style={{ color: group.color }}>
                ● {group.name}
              </span>
              {group.tags.map((tag) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  color={tagColors[tag] || group.color}
                  count={tagCounts[tag] || 0}
                  selected={selectedTags.has(tag)}
                  active={filterTags.includes(tag)}
                  onToggle={() => toggleTag(tag)}
                  onCtrlToggle={(e) => toggleSelect(tag, e)}
                />
              ))}
            </div>
          ))}

          {groupedTags.ungrouped.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              color={tagColors[tag] || null}
              count={tagCounts[tag] || 0}
              selected={selectedTags.has(tag)}
              active={filterTags.includes(tag)}
              onToggle={() => toggleTag(tag)}
              onCtrlToggle={(e) => toggleSelect(tag, e)}
            />
          ))}
        </div>
      )}

      {showBatchModal && (
        <TagBatchRenameModal
          selectedTags={Array.from(selectedTags)}
          onClose={() => setShowBatchModal(false)}
          onRename={(oldTag, newTag) => {
            allTasks.forEach((t) => {
              if ((t.tags || []).includes(oldTag)) {
                const newTags = t.tags.map((tg) => tg === oldTag ? newTag : tg);
                updateTask(t.id, { tags: newTags });
              }
            });
            setSelectedTags(new Set());
            setShowBatchModal(false);
          }}
        />
      )}

      {showTagManager && (
        <TagManagerModal onClose={() => setShowTagManager(false)} />
      )}
    </div>
  );
});

function TagChip({ tag, color, count, selected, active, onToggle, onCtrlToggle }) {
  return (
    <button
      className={`tag-filter-btn ${active ? 'active' : ''} ${selected ? 'tag-selected' : ''}`}
      onClick={onToggle}
      onContextMenu={(e) => { e.preventDefault(); onCtrlToggle(e); }}
      title={`右键多选 · 使用${count}次`}
      style={color ? {
        borderColor: color,
        color: active ? 'white' : color,
        background: active ? color : 'transparent',
      } : {}}
    >
      {tag} {count > 0 && <span className="tag-count">({count})</span>}
    </button>
  );
}

function TagBatchRenameModal({ selectedTags, onClose, onRename }) {
  const [mode, setMode] = useState('replace'); // 'replace' | 'prefix' | 'suffix'
  const [replaceFrom, setReplaceFrom] = useState('');
  const [replaceTo, setReplaceTo] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  const preview = useMemo(() => {
    return selectedTags.map((oldTag) => {
      let newTag = oldTag;
      if (mode === 'replace' && replaceFrom) {
        newTag = oldTag.replace(new RegExp(replaceFrom, 'g'), replaceTo);
      } else if (mode === 'prefix') {
        newTag = prefix + oldTag;
      } else if (mode === 'suffix') {
        newTag = oldTag + suffix;
      }
      return { old: oldTag, new: newTag === oldTag ? null : newTag };
    });
  }, [selectedTags, mode, replaceFrom, replaceTo, prefix, suffix]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="batch-rename-modal">
        <h3>✏️ 批量重命名标签</h3>
        <p className="batch-desc">已选择：{selectedTags.join(', ')}</p>

        <div className="batch-modes">
          <button className={`mode-btn ${mode === 'replace' ? 'active' : ''}`} onClick={() => setMode('replace')}>替换</button>
          <button className={`mode-btn ${mode === 'prefix' ? 'active' : ''}`} onClick={() => setMode('prefix')}>加前缀</button>
          <button className={`mode-btn ${mode === 'suffix' ? 'active' : ''}`} onClick={() => setMode('suffix')}>加后缀</button>
        </div>

        {mode === 'replace' && (
          <div className="batch-field">
            <input placeholder="原文本" value={replaceFrom} onChange={(e) => setReplaceFrom(e.target.value)} />
            <span>→</span>
            <input placeholder="新文本" value={replaceTo} onChange={(e) => setReplaceTo(e.target.value)} />
          </div>
        )}
        {mode === 'prefix' && (
          <div className="batch-field">
            <input placeholder="前缀" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <span>+ 标签名</span>
          </div>
        )}
        {mode === 'suffix' && (
          <div className="batch-field">
            <span>标签名 +</span>
            <input placeholder="后缀" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
          </div>
        )}

        <div className="batch-preview">
          <h4>预览：</h4>
          {preview.map(({ old, new: newTag }) => (
            <div key={old} className="preview-row">
              <span>{old}</span>
              {newTag ? <><span>→</span><span style={{ color: 'var(--color-primary)' }}>{newTag}</span></> : <span style={{ color: 'var(--text-muted)' }}>（无变化）</span>}
            </div>
          ))}
        </div>

        <div className="batch-actions">
          <button
            className="btn-confirm"
            onClick={() => preview.forEach(({ old, new: newTag }) => newTag && onRename(old, newTag))}
            disabled={!preview.some(({ new: newTag }) => newTag)}
          >
            ✅ 确认重命名
          </button>
          <button className="btn-cancel" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

function TagManagerModal({ onClose }) {
  const { getAllTags, allTasks, updateTask } = useTaskContext();
  const [tagGroups, setTagGroups] = useState(() => getTagGroups());
  const [tagColors, setTagColors] = useState(() => getTagColors());
  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#48DBFB');
  const [editTags, setEditTags] = useState([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#48DBFB');
  const allTags = getAllTags();

  const COLORS = ['#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB', '#1DD1A1', '#A55EEA', '#576574', '#FF9FF3'];

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const { createTagGroup } = require('../utils/projects');
    createTagGroup(newGroupName.trim(), newGroupColor, []);
    setTagGroups(getTagGroups());
    setNewGroupName('');
    setShowAddGroup(false);
  };

  const handleSaveGroup = () => {
    if (!editName.trim()) return;
    const { updateTagGroup } = require('../utils/projects');
    updateTagGroup(editingGroup, { name: editName, color: editColor, tags: editTags });
    setTagGroups(getTagGroups());
    setEditingGroup(null);
  };

  const handleDeleteGroup = (id) => {
    if (!window.confirm('删除标签组？标签本身不会被删除。')) return;
    const { deleteTagGroup } = require('../utils/projects');
    deleteTagGroup(id);
    setTagGroups(getTagGroups());
  };

  const toggleTagInGroup = (tag) => {
    setEditTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleTagColorChange = (tag, color) => {
    const next = { ...tagColors, [tag]: color };
    const { saveTagColors } = require('../utils/projects');
    saveTagColors(next);
    setTagColors({ ...next });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tag-manager-modal">
        <h3>🏷️ 标签管理</h3>

        <div className="tag-manager-sections">
          <div className="tag-manager-section">
            <h4>标签组</h4>
            {tagGroups.length === 0 && !showAddGroup && (
              <p className="section-empty">暂无标签组</p>
            )}
            {tagGroups.map((g) => (
              <div key={g.id} className="group-item">
                {editingGroup === g.id ? (
                  <div className="group-edit">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="组名" />
                    <div className="color-row">
                      {COLORS.map((c) => (
                        <button key={c} className={`color-dot ${editColor === c ? 'active' : ''}`}
                          style={{ background: c }} onClick={() => setEditColor(c)} />
                      ))}
                    </div>
                    <div className="tag-pick-list">
                      {allTags.map((tag) => (
                        <label key={tag} className="tag-pick-item">
                          <input type="checkbox" checked={editTags.includes(tag)}
                            onChange={() => toggleTagInGroup(tag)} />
                          {tag}
                        </label>
                      ))}
                    </div>
                    <div className="edit-actions">
                      <button className="btn-save" onClick={handleSaveGroup}>💾 保存</button>
                      <button className="btn-cancel-sm" onClick={() => setEditingGroup(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="group-row">
                    <span className="group-dot" style={{ color: g.color }}>●</span>
                    <span className="group-name">{g.name}</span>
                    <span className="group-count">({g.tags.length}标签)</span>
                    <button onClick={() => { setEditingGroup(g.id); setEditName(g.name); setEditColor(g.color); setEditTags([...g.tags]); }}>✏️</button>
                    <button onClick={() => handleDeleteGroup(g.id)}>🗑️</button>
                  </div>
                )}
              </div>
            ))}
            {showAddGroup ? (
              <div className="group-edit">
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="组名" autoFocus />
                <div className="color-row">
                  {COLORS.map((c) => (
                    <button key={c} className={`color-dot ${newGroupColor === c ? 'active' : ''}`}
                      style={{ background: c }} onClick={() => setNewGroupColor(c)} />
                  ))}
                </div>
                <div className="edit-actions">
                  <button className="btn-save" onClick={handleAddGroup}>✅ 添加</button>
                  <button className="btn-cancel-sm" onClick={() => setShowAddGroup(false)}>取消</button>
                </div>
              </div>
            ) : (
              <button className="btn-add-group" onClick={() => setShowAddGroup(true)}>+ 新建标签组</button>
            )}
          </div>

          <div className="tag-manager-section">
            <h4>所有标签</h4>
            <div className="tag-color-list">
              {allTags.map((tag) => (
                <div key={tag} className="tag-color-item">
                  <span className="tag-label">{tag}</span>
                  <div className="tag-color-swatches">
                    {COLORS.map((c) => (
                      <button key={c}
                        className={`color-swatch-sm ${tagColors[tag] === c ? 'active' : ''}`}
                        style={{ background: c }}
                        onClick={() => handleTagColorChange(tag, c)}
                        title={c}
                      />
                    ))}
                    <button
                      className={`color-swatch-sm ${!tagColors[tag] ? 'active' : ''}`}
                      style={{ background: 'transparent', border: '1px dashed #888', color: '#888', fontSize: 9 }}
                      onClick={() => handleTagColorChange(tag, null)}
                      title="无颜色"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button className="btn-close" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

export default FilterBar;

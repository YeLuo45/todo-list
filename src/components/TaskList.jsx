import { useState, useRef, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useTaskContext } from '../context/TaskContext';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import './TaskList.css';

const ITEM_HEIGHT = 120; // Estimated height per task item
const OVERSCAN_COUNT = 5; // Extra items to render outside visible area

export default function TaskList() {
  const { tasks, selectedTaskIds, toggleTaskSelection, selectAllTasks, clearSelection, batchDeleteTasks, batchUpdateTasks, getAllTags } = useTaskContext();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [batchTag, setBatchTag] = useState('');
  const [showBatchTagInput, setShowBatchTagInput] = useState(false);
  const listContainerRef = useRef(null);
  const [listHeight, setListHeight] = useState(500);

  const hasSelection = selectedTaskIds.size > 0;
  const allSelected = tasks.length > 0 && selectedTaskIds.size === tasks.length;

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllTasks(tasks.map((t) => t.id));
    }
  };

  const handleBatchDelete = () => {
    if (window.confirm(`Delete ${selectedTaskIds.size} selected task(s)?`)) {
      batchDeleteTasks(Array.from(selectedTaskIds));
    }
  };

  const handleBatchStatus = (status) => {
    batchUpdateTasks(Array.from(selectedTaskIds), { status });
    clearSelection();
  };

  const handleBatchAddTag = () => {
    if (!batchTag.trim()) return;
    const tag = batchTag.trim();
    // For each selected task, add tag (avoid duplicates)
    tasks.forEach((task) => {
      if (selectedTaskIds.has(task.id) && !task.tags.includes(tag)) {
        batchUpdateTasks([task.id], { tags: [...task.tags, tag] });
      }
    });
    setBatchTag('');
    setShowBatchTagInput(false);
    clearSelection();
  };

  const handleBatchRemoveTag = (tag) => {
    tasks.forEach((task) => {
      if (selectedTaskIds.has(task.id)) {
        batchUpdateTasks([task.id], { tags: task.tags.filter((t) => t !== tag) });
      }
    });
  };

  // Calculate list height based on container
  const updateListHeight = useCallback(() => {
    if (listContainerRef.current) {
      const rect = listContainerRef.current.getBoundingClientRect();
      const availableHeight = window.innerHeight - rect.top - 40;
      setListHeight(Math.max(300, availableHeight));
    }
  }, []);

  // Update list height on mount and resize
  useState(() => {
    updateListHeight();
    window.addEventListener('resize', updateListHeight);
    return () => window.removeEventListener('resize', updateListHeight);
  });

  // Virtual row renderer
  const Row = useCallback(({ index, style }) => {
    const task = tasks[index];
    return (
      <div style={style} className="virtual-row">
        <TaskItem key={task.id} task={task} onEdit={handleEdit} />
      </div>
    );
  }, [tasks, handleEdit]);

  // Use virtual list for 50+ tasks
  const useVirtualList = tasks.length > 50;

  return (
    <div className="task-list">
      <div className="task-list-header">
        <h2>
          {hasSelection ? (
            <>
              <span>已选择 {selectedTaskIds.size} 项</span>
            </>
          ) : (
            <span>任务 ({tasks.length})</span>
          )}
        </h2>
        <div className="header-actions">
          {hasSelection ? (
            <>
              <button className="batch-btn cancel" onClick={clearSelection}>
                取消选择
              </button>
              <button className="batch-btn delete" onClick={handleBatchDelete}>
                🗑 删除 ({selectedTaskIds.size})
              </button>
              <button className="batch-btn" onClick={() => handleBatchStatus('todo')}>
                → 待办
              </button>
              <button className="batch-btn" onClick={() => handleBatchStatus('in-progress')}>
                → 进行中
              </button>
              <button className="batch-btn" onClick={() => handleBatchStatus('done')}>
                → 已完成
              </button>
              {showBatchTagInput ? (
                <div className="batch-tag-input">
                  <input
                    type="text"
                    placeholder="标签名"
                    value={batchTag}
                    onChange={(e) => setBatchTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBatchAddTag()}
                    autoFocus
                  />
                  <button onClick={handleBatchAddTag}>添加</button>
                  <button onClick={() => { setShowBatchTagInput(false); setBatchTag(''); }}>×</button>
                </div>
              ) : (
                <button className="batch-btn" onClick={() => setShowBatchTagInput(true)}>
                  + 标签
                </button>
              )}
            </>
          ) : (
            <>
              {tasks.length > 0 && (
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                  />
                  全选
                </label>
              )}
              <button className="btn-add" onClick={() => setShowForm(true)}>
                + 新建任务
              </button>
            </>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p>暂无任务，创建一个开始吧！</p>
        </div>
      ) : useVirtualList ? (
        <div className="task-items virtual-scroll-container" ref={listContainerRef}>
          <List
            height={listHeight}
            itemCount={tasks.length}
            itemSize={ITEM_HEIGHT}
            width="100%"
            overscanCount={OVERSCAN_COUNT}
          >
            {Row}
          </List>
        </div>
      ) : (
        <div className="task-items">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {showForm && <TaskForm editingTask={editingTask} onClose={handleCloseForm} />}
    </div>
  );
}
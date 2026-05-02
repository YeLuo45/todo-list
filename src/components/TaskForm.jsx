import { useState, useEffect } from 'react';
import { useTaskContext } from '../context/TaskContext';
import './TaskForm.css';

export default function TaskForm({ editingTask, onClose }) {
  const { createTask, updateTask, allTasks, isTaskBlocked, wouldCreateCycle } = useTaskContext();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('P1');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState('');
  const [remindBefore, setRemindBefore] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('daily');
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [dependsOn, setDependsOn] = useState([]);
  const [depSearch, setDepSearch] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || '');
      setContent(editingTask.content || '');
      setTags(editingTask.tags?.join(', ') || '');
      setPriority(editingTask.priority || 'P1');
      setStatus(editingTask.status || 'todo');
      setDueDate(editingTask.dueDate || '');
      setRemindBefore(editingTask.remindBefore || '');
      setRemindAt(editingTask.remindAt || '');
      setRecurrence(editingTask.recurrence || '');
      setRecurrenceEndDate(editingTask.recurrenceEndDate || '');
      setIsRecurring(editingTask.isRecurring || false);
      setRecurrenceInterval(editingTask.recurrenceInterval || 'daily');
      setSubtasks(editingTask.subtasks || []);
      setDependsOn(editingTask.dependsOn || []);
      setStartTime(editingTask.startTime ? editingTask.startTime.slice(0, 16) : '');
      setEndTime(editingTask.endTime ? editingTask.endTime.slice(0, 16) : '');
    }
  }, [editingTask]);

  const handleSubtaskAdd = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: Date.now().toString(), title: subtaskInput.trim(), done: false },
    ]);
    setSubtaskInput('');
  };

  const handleSubtaskToggle = (id) => {
    setSubtasks((prev) =>
      prev.map((st) => (st.id === id ? { ...st, done: !st.done } : st))
    );
  };

  const handleSubtaskDelete = (id) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
  };

  const handleAddDependency = (depId) => {
    if (!depId || depId === editingTask?.id) return;
    if (dependsOn.includes(depId)) return;
    if (wouldCreateCycle(editingTask?.id, depId)) {
      alert('不能添加依赖：会形成循环引用！');
      return;
    }
    setDependsOn((prev) => [...prev, depId]);
    setDepSearch('');
  };

  const handleRemoveDep = (depId) => {
    setDependsOn((prev) => prev.filter((id) => id !== depId));
  };

  const availableDeps = allTasks.filter(
    (t) => t.id !== editingTask?.id && !dependsOn.includes(t.id)
  );
  const filteredDeps = depSearch
    ? availableDeps.filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase()))
    : availableDeps.slice(0, 5);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tagList = tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const taskData = {
      title: title.trim(),
      content: content.trim(),
      tags: tagList,
      priority,
      status,
      dueDate: dueDate || null,
      remindBefore: remindBefore || null,
      remindAt: remindAt || null,
      recurrence: recurrence || null,
      recurrenceEndDate: recurrenceEndDate || null,
      subtasks,
      dependsOn,
      isRecurring,
      recurrenceInterval: isRecurring ? recurrenceInterval : null,
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: endTime ? new Date(endTime).toISOString() : null,
    };
    if (editingTask) updateTask(editingTask.id, taskData);
    else createTask(taskData);
    onClose();
  };

  const completedSubs = subtasks.filter((s) => s.done).length;

  return (
    <div className="task-form-overlay">
      <form className="task-form" onSubmit={handleSubmit}>
        <h3>{editingTask ? '编辑任务' : '新建任务'}</h3>

        <div className="form-group">
          <label>标题 *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="任务标题" required autoFocus />
        </div>

        <div className="form-group">
          <label>描述</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="任务描述（可选）" rows={3} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>优先级</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
          </div>
          <div className="form-group">
            <label>状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todo">待办</option>
              <option value="in-progress">进行中</option>
              <option value="done">已完成</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>截止日期</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>提醒</label>
            <select value={remindBefore} onChange={(e) => { setRemindBefore(e.target.value); if (e.target.value) setRemindAt(''); }}>
              <option value="">无</option>
              <option value="1h">提前 1 小时</option>
              <option value="1d">提前 1 天</option>
            </select>
          </div>
          <div className="form-group">
            <label>精确提醒时间</label>
            <input type="datetime-local" value={remindAt}
              onChange={(e) => { setRemindAt(e.target.value); if (e.target.value) setRemindBefore(''); }} />
          </div>
        </div>

        <div className="form-group">
          <label>标签</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
            placeholder="工作, 生活, 紧急 (逗号分隔)" />
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="is-recurring-check"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="is-recurring-check" style={{ margin: 0 }}>🔄 循环任务</label>
          </div>
          {isRecurring && (
            <>
              <div className="form-group">
                <label>循环频率</label>
                <select value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(e.target.value)}>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div className="form-group">
                <label>循环结束日期</label>
                <input type="date" value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>开始时间</label>
            <input type="datetime-local" value={startTime}
              onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="form-group">
            <label>结束时间</label>
            <input type="datetime-local" value={endTime}
              onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>子任务 {subtasks.length > 0 && <span className="subtask-progress">({completedSubs}/{subtasks.length})</span>}</label>
          <div className="subtask-list">
            {subtasks.map((st) => (
              <div key={st.id} className={`subtask-item ${st.done ? 'done' : ''}`}>
                <input type="checkbox" checked={st.done} onChange={() => handleSubtaskToggle(st.id)} />
                <span className="subtask-title">{st.title}</span>
                <button type="button" className="subtask-delete" onClick={() => handleSubtaskDelete(st.id)}>×</button>
              </div>
            ))}
          </div>
          <div className="subtask-add">
            <input type="text" value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              placeholder="添加子任务..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubtaskAdd())} />
            <button type="button" onClick={handleSubtaskAdd}>+</button>
          </div>
        </div>

        <div className="form-group">
          <label>依赖任务 🔗</label>
          {dependsOn.length > 0 && (
            <div className="dep-list">
              {dependsOn.map((depId) => {
                const dep = allTasks.find((t) => t.id === depId);
                const blocked = dep && dep.status !== 'done';
                return (
                  <div key={depId} className={`dep-item ${blocked ? 'blocked' : 'unblocked'}`}>
                    <span>{blocked ? '🔒' : '🔓'}</span>
                    <span className="dep-title">{dep?.title || depId}</span>
                    <button type="button" onClick={() => handleRemoveDep(depId)}>×</button>
                  </div>
                );
              })}
            </div>
          )}
          <input type="text" value={depSearch}
            onChange={(e) => setDepSearch(e.target.value)}
            placeholder="搜索要依赖的任务..." />
          {filteredDeps.length > 0 && (
            <div className="dep-suggestions">
              {filteredDeps.map((t) => (
                <button key={t.id} type="button" className="dep-suggestion"
                  onClick={() => handleAddDependency(t.id)}>
                  {t.title} {t.status === 'done' ? '✅' : '⏳'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>取消</button>
          <button type="submit" className="btn-submit">{editingTask ? '更新' : '创建'}</button>
        </div>
      </form>
    </div>
  );
}

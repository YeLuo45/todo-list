import { useState, useEffect } from 'react';
import { useTaskContext } from '../context/TaskContext';
import './TaskForm.css';

export default function TaskForm({ editingTask, onClose }) {
  const { createTask, updateTask } = useTaskContext();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState(''); // '', 'daily', 'weekly', 'monthly'
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || '');
      setContent(editingTask.content || '');
      setTags(editingTask.tags?.join(', ') || '');
      setPriority(editingTask.priority || 'medium');
      setStatus(editingTask.status || 'todo');
      setDueDate(editingTask.dueDate || '');
      setRecurrence(editingTask.recurrence || '');
      setRecurrenceEndDate(editingTask.recurrenceEndDate || '');
    }
  }, [editingTask]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const taskData = {
      title: title.trim(),
      content: content.trim(),
      tags: tagList,
      priority,
      status,
      dueDate: dueDate || null,
      recurrence: recurrence || null,
      recurrenceEndDate: recurrenceEndDate || null,
    };

    if (editingTask) {
      updateTask(editingTask.id, taskData);
    } else {
      createTask(taskData);
    }

    onClose();
  };

  return (
    <div className="task-form-overlay">
      <form className="task-form" onSubmit={handleSubmit}>
        <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>

        <div className="form-group">
          <label>标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="任务标题"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>描述</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="任务描述（可选）"
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>优先级</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
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
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>标签</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="工作, 生活, 紧急 (逗号分隔)"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>重复周期</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>

          {recurrence && (
            <div className="form-group">
              <label>重复结束日期</label>
              <input
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn-submit">
            {editingTask ? '更新' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
}

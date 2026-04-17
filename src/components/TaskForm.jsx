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

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || '');
      setContent(editingTask.content || '');
      setTags(editingTask.tags?.join(', ') || '');
      setPriority(editingTask.priority || 'medium');
      setStatus(editingTask.status || 'todo');
      setDueDate(editingTask.dueDate || '');
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
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Task description (optional)"
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, home, urgent (comma separated)"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-submit">
            {editingTask ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

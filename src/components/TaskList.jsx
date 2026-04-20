import { useState } from 'react';
import { useTaskContext } from '../context/TaskContext';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import './TaskList.css';

export default function TaskList() {
  const { tasks } = useTaskContext();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  return (
    <div className="task-list">
      <div className="task-list-header">
        <h2>任务 ({tasks.length})</h2>
        <button className="btn-add" onClick={() => setShowForm(true)}>
          + 新建任务
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p>暂无任务，创建一个开始吧！</p>
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

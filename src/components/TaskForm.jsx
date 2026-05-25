import { useState, useEffect } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { useAppStore } from '../store/useAppStore';
import { getAPIToken } from '../utils/aiSubtask';
import { improveDescription } from '../utils/aiDescription优化';
import { getUsers, getUserById } from '../utils/comment';
import { addActivity, ACTIVITY_ACTIONS } from '../utils/activityLog';
import CheckboxMultiSelect from './CheckboxMultiSelect';
import './TaskForm.css';

export default function TaskForm({ editingTask, onClose }) {
  const { createTask, updateTask, allTasks, isTaskBlocked, wouldCreateCycle, getAllTags } = useTaskContext();
  const projects = useAppStore((s) => s.projects);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
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
  const [importance, setImportance] = useState(3);
  const [urgency, setUrgency] = useState(3);
  const [isImproving, setIsImproving] = useState(false);
  const [improvedDesc, setImprovedDesc] = useState(null);
  const [showDescDiff, setShowDescDiff] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [users, setUsers] = useState([]);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    setUsers(getUsers());
    if (editingTask) {
      setTitle(editingTask.title || '');
      setContent(editingTask.content || '');
      setTags(editingTask.tags || []);
      setPriority(editingTask.priority || 'P1');
      setStatus(editingTask.status || 'todo');
      setDueDate(editingTask.dueDate || '');
      setStartTime(editingTask.startTime ? editingTask.startTime.slice(0, 16) : '');
      setEndTime(editingTask.endTime ? editingTask.endTime.slice(0, 16) : '');
      setImportance(editingTask.importance ?? 3);
      setUrgency(editingTask.urgency ?? 3);
      setRecurrence(editingTask.recurrence || '');
      setRecurrenceEndDate(editingTask.recurrenceEndDate || '');
      setIsRecurring(editingTask.isRecurring || false);
      setRecurrenceInterval(editingTask.recurrenceInterval || 'daily');
      setSubtasks(editingTask.subtasks || []);
      setDependsOn(editingTask.dependsOn || []);
      setRemindBefore(editingTask.remindBefore || '');
      setRemindAt(editingTask.remindAt || '');
      setAssignee(editingTask.assignee || '');
      setProjectId(editingTask.projectId || '');
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

  // Tag multiselect — all available tags from context
  const allTagOptions = getAllTags();

  const handleAIImproveDescription = async () => {
    const token = getAPIToken();
    if (!token) {
      alert('请先在设置中配置 AI Token');
      return;
    }

    if (!title.trim()) {
      alert('请先输入任务标题');
      return;
    }

    setIsImproving(true);

    try {
      const taskForImprove = { title, content };
      const result = await improveDescription(taskForImprove);
      setImprovedDesc(result);
      setShowDescDiff(true);
    } catch (error) {
      if (error.message === 'NO_TOKEN') {
        alert('请先在设置中配置 AI Token');
      } else {
        alert(error.message);
      }
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplyImprovedDescription = () => {
    if (improvedDesc) {
      setContent(improvedDesc.improved);
      setShowDescDiff(false);
      setImprovedDesc(null);
    }
  };

  const handleCancelImprovedDescription = () => {
    setShowDescDiff(false);
    setImprovedDesc(null);
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
      tags,
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
      importance,
      urgency,
      assignee: assignee || null,
      projectId: projectId || null,
    };
    
    let taskId;
    if (editingTask) {
      updateTask(editingTask.id, taskData);
      taskId = editingTask.id;
      // Log activity if assignee changed
      if (assignee !== (editingTask.assignee || null)) {
        const assigneeUser = assignee ? getUserById(assignee) : null;
        addActivity(taskId, 'assigned', { assigneeName: assigneeUser?.name || '未知' });
      }
    } else {
      const newTask = createTask(taskData);
      taskId = newTask.id;
      addActivity(taskId, 'created');
    }
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
          <label>
            描述
            <button 
              type="button" 
              className="btn-ai-improve-form"
              onClick={handleAIImproveDescription}
              disabled={isImproving || !title.trim()}
              title="AI 优化描述"
            >
              {isImproving ? '⏳ 优化中...' : '✨ AI 优化'}
            </button>
          </label>
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
          <div className="form-group">
            <label>指派给</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">未指派</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.avatar} {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>项目</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">无项目</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row score-row">
          <div className="form-group">
            <label>重要性 ⭐ <span className="score-hint">({importance}星)</span></label>
            <div className="star-rating">
              {[1,2,3,4,5].map(n => (
                <span key={n} className={`star ${n <= importance ? 'filled' : ''}`}
                  onClick={() => setImportance(n)}>★</span>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>紧急度 🔥 <span className="score-hint">({urgency}星)</span></label>
            <div className="star-rating">
              {[1,2,3,4,5].map(n => (
                <span key={n} className={`star urgency ${n <= urgency ? 'filled' : ''}`}
                  onClick={() => setUrgency(n)}>★</span>
              ))}
            </div>
          </div>
          <div className="form-group score-result">
            <label>综合评分</label>
            <span className="score-badge" style={{
              backgroundColor: importance * urgency >= 15 ? '#ef4444' : importance * urgency >= 9 ? '#f59e0b' : '#9ca3af'
            }}>{importance * urgency}分</span>
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

        <div className="form-group tag-input-group">
          <label>标签</label>
          <CheckboxMultiSelect
            options={allTagOptions}
            selected={tags}
            onChange={setTags}
            placeholder="选择标签..."
          />
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

        {/* AI Description Improvement Modal */}
        {showDescDiff && improvedDesc && (
          <div className="desc-diff-modal-overlay">
            <div className="desc-diff-modal-content">
              <h4>✨ AI 优化建议</h4>
              <div className="desc-diff-view">
                <div className="desc-diff-original">
                  <div className="diff-label">📝 原描述</div>
                  <pre>{improvedDesc.original || '(无描述)'}</pre>
                </div>
                <div className="desc-diff-improved">
                  <div className="diff-label">✨ 优化后</div>
                  <pre>{improvedDesc.improved}</pre>
                </div>
              </div>
              <div className="desc-diff-actions">
                <button className="btn-apply" onClick={handleApplyImprovedDescription}>
                  ✓ 采纳优化
                </button>
                <button className="btn-cancel" onClick={handleCancelImprovedDescription}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>取消</button>
          <button type="submit" className="btn-submit">{editingTask ? '更新' : '创建'}</button>
        </div>
      </form>
    </div>
  );
}

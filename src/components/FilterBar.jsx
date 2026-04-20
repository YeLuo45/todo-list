import { useTaskContext } from '../context/TaskContext';
import './FilterBar.css';

export default function FilterBar() {
  const {
    filterTag,
    setFilterTag,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    getAllTags,
    hideCompleted,
    setHideCompleted,
    dateFilter,
    setDateFilter,
  } = useTaskContext();

  const allTags = getAllTags();

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <input
          type="text"
          className="search-input"
          placeholder="搜索任务..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="createdAt">创建时间</option>
          <option value="dueDate">截止日期</option>
          <option value="priority">优先级</option>
        </select>
      </div>

      <div className="filter-row">
        <label className="hide-completed-toggle">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          隐藏已完成
        </label>

        <div className="date-filter">
          <label>日期筛选：</label>
          <input
            type="date"
            value={dateFilter || ''}
            onChange={(e) => setDateFilter(e.target.value || null)}
          />
          {dateFilter && (
            <button className="btn-clear-date" onClick={() => setDateFilter(null)}>
              清除
            </button>
          )}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filters">
          <span className="tag-filter-label">按标签筛选：</span>
          <button
            className={`tag-filter-btn ${filterTag === '' ? 'active' : ''}`}
            onClick={() => setFilterTag('')}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`tag-filter-btn ${filterTag === tag ? 'active' : ''}`}
              onClick={() => setFilterTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

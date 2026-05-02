import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useTaskContext } from '../context/TaskContext';
import './FilterBar.css';

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
  } = useTaskContext();

  const inputRef = useRef();
  const allTags = getAllTags();
  const today = new Date().toISOString().split('T')[0];

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const toggleTag = (tag) => {
    setFilterTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
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
              <span className="search-count">
                {resultCount}/{totalCount}
              </span>
              <button className="search-clear" onClick={handleClear} title="清除 (Esc)">×</button>
            </>
          )}
        </div>

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="createdAt">创建时间</option>
          <option value="dueDate">截止日期</option>
          <option value="priority">优先级</option>
          <option value="updatedAt">更新时间</option>
        </select>

        <label className="hide-completed">
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
            className={`tag-filter-btn ${filterTags.length === 0 ? 'active' : ''}`}
            onClick={() => setFilterTags([])}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`tag-filter-btn ${filterTags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default FilterBar;

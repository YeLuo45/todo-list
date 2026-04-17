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
  } = useTaskContext();

  const allTags = getAllTags();

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <input
          type="text"
          className="search-input"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="createdAt">Created Date</option>
          <option value="dueDate">Due Date</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filters">
          <span className="tag-filter-label">Filter by tag:</span>
          <button
            className={`tag-filter-btn ${filterTag === '' ? 'active' : ''}`}
            onClick={() => setFilterTag('')}
          >
            All
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

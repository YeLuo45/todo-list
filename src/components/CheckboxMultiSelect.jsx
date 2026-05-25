import React, { useState, useRef, useEffect } from 'react';
import './CheckboxMultiSelect.css';

const CheckboxMultiSelect = ({ options = [], selected = [], onChange, placeholder = 'Select...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  const handleOptionToggle = (option) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  const handleRemove = (option, e) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== option));
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="checkbox-multi-select" ref={containerRef}>
      <div className="checkbox-multi-select__control" onClick={toggleDropdown}>
        <div className="checkbox-multi-select__tags">
          {selected.length === 0 ? (
            <span className="checkbox-multi-select__placeholder">{placeholder}</span>
          ) : (
            selected.map((item) => (
              <span key={item} className="checkbox-multi-select__tag">
                {item}
                <button
                  type="button"
                  className="checkbox-multi-select__tag-remove"
                  onClick={(e) => handleRemove(item, e)}
                  aria-label={`Remove ${item}`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <span className="checkbox-multi-select__arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="checkbox-multi-select__dropdown">
          {options.map((option) => (
            <label key={option} className="checkbox-multi-select__option">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => handleOptionToggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
          {options.length === 0 && (
            <div className="checkbox-multi-select__empty">No options available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckboxMultiSelect;
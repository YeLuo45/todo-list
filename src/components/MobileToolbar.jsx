import { useState, useCallback } from 'react';
import './MobileToolbar.css';

export default function MobileToolbar({ onQuickAdd, onVoiceInput }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleVoiceClick = useCallback(() => {
    if (onVoiceInput) onVoiceInput();
  }, [onVoiceInput]);

  return (
    <div className="mobile-toolbar">
      <button
        className="mobile-toolbar-btn voice-btn"
        onClick={handleVoiceClick}
        title="语音输入"
      >
        🎤
      </button>
      <button
        className="mobile-toolbar-btn add-btn"
        onClick={onQuickAdd}
        title="快速添加任务"
      >
        ➕
      </button>
    </div>
  );
}

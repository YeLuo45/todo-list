import { useState, useEffect } from 'react';
import './ReminderToast.css';

export default function ReminderToast({ message, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="reminder-toast">
      <span className="reminder-icon">🔔</span>
      <span className="reminder-message">{message}</span>
      <button className="reminder-close" onClick={() => { setVisible(false); onClose(); }}>
        ×
      </button>
    </div>
  );
}

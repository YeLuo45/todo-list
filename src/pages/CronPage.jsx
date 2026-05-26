import { useState, useEffect } from 'react';
import CronTaskPanel from '../components/CronTaskPanel';
import { useTaskContext } from '../context/TaskContext';

export default function CronPage() {
  const { allTasks } = useTaskContext();

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-primary, #fff)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        background: 'var(--bg-secondary, #f9fafb)'
      }}>
        <button
          onClick={handleBack}
          style={{
            padding: '6px 16px',
            background: 'var(--btn-primary, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          ← 返回
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>⏰ Cron 定时任务</h2>
      </div>

      {/* Cron Panel content — full height */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <CronTaskPanel
          tasks={allTasks}
        />
      </div>
    </div>
  );
}

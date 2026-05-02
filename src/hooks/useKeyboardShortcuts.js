import { useEffect, useCallback } from 'react';

/**
 * Global keyboard shortcuts
 * @param {object} handlers - { onFocusSearch, onNewTask, onViewList, onViewKanban, onOpenStats, onCloseModal }
 */
export function useKeyboardShortcuts(handlers) {
  const { onFocusSearch, onNewTask, onViewList, onViewKanban, onOpenStats, onCloseModal } = handlers;

  const handleKeyDown = useCallback((e) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl+K / Cmd+K → focus search
    if (mod && e.key === 'k') {
      e.preventDefault();
      onFocusSearch?.();
      return;
    }

    // Ctrl+N / Cmd+N → new task
    if (mod && e.key === 'n') {
      e.preventDefault();
      onNewTask?.();
      return;
    }

    // 1 → list view
    if (!mod && !e.shiftKey && !e.altKey && e.key === '1' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      onViewList?.();
      return;
    }

    // 2 → kanban view
    if (!mod && !e.shiftKey && !e.altKey && e.key === '2' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      onViewKanban?.();
      return;
    }

    // 3 → open stats
    if (!mod && !e.shiftKey && !e.altKey && e.key === '3' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      onOpenStats?.();
      return;
    }

    // Esc → close modal
    if (e.key === 'Escape') {
      onCloseModal?.();
      return;
    }
  }, [onFocusSearch, onNewTask, onViewList, onViewKanban, onOpenStats, onCloseModal]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

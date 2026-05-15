import { useRef, useCallback } from 'react';

/**
 * Hook for swipe gesture detection on mobile.
 * @param {Object} options
 * @param {number} options.threshold - Min swipe distance in px to trigger action (default 80)
 * @param {Function} options.onSwipeLeft - Called when swiped left (show actions like complete/delete)
 * @param {Function} options.onSwipeRight - Called when swiped right (edit)
 * @param {Function} options.onDoubleTap - Called on double tap (expand details)
 * @param {Function} options.onSwipeReset - Called when swipe is released without crossing threshold
 */
export function useSwipeGesture({
  threshold = 80,
  onSwipeLeft,
  onSwipeRight,
  onDoubleTap,
  onSwipeReset,
} = {}) {
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const lastTapTime = useRef(0);
  const elementRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartX.current === null) return;
    // Prevent scroll if horizontal swipe detected
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    const now = Date.now();

    // Double tap detection (within 300ms, same position)
    if (
      onDoubleTap &&
      now - lastTapTime.current < 300 &&
      Math.abs(dx) < 20 &&
      Math.abs(dy) < 20
    ) {
      onDoubleTap();
      lastTapTime.current = 0;
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    lastTapTime.current = now;

    // Swipe detection - only if horizontal movement dominates
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0 && onSwipeLeft) {
        onSwipeLeft(); // Swipe left
      } else if (dx > 0 && onSwipeRight) {
        onSwipeRight(); // Swipe right
      }
    } else if (Math.abs(dx) < threshold && onSwipeReset) {
      // Didn't cross threshold - reset
      onSwipeReset();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [threshold, onSwipeLeft, onSwipeRight, onDoubleTap, onSwipeReset]);

  const attachListeners = useCallback((element) => {
    const el = element || elementRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const detachListeners = useCallback((element) => {
    const el = element || elementRef.current;
    if (!el) return;
    el.removeEventListener('touchstart', handleTouchStart);
    el.removeEventListener('touchmove', handleTouchMove);
    el.removeEventListener('touchend', handleTouchEnd);
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref: elementRef,
    attachListeners,
    detachListeners,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

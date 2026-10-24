import { useCallback, useEffect, useRef } from 'react';

const useDragSelect = ({ enabled, onSelect, onToggle }) => {
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastIdRef = useRef(null);
  const startIdRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerIdRef = useRef(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef(null);
  const scrollSpeedRef = useRef(0);
  const prevTouchActionRef = useRef('');
  const prevUserSelectRef = useRef('');
  const scrollContainerRef = useRef(null);

  const stopAutoScroll = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    scrollSpeedRef.current = 0;
  }, []);

  const getViewportBounds = useCallback(() => {
    const viewport = window.visualViewport;
    const topOffset = viewport?.offsetTop || 0;
    const viewportHeight = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
    const actionBar = document.querySelector('[data-selection-action-bar="true"]');
    const actionBarHeight = actionBar?.getBoundingClientRect().height || 0;
    return {
      top: topOffset,
      bottom: topOffset + viewportHeight,
      bottomOffset: actionBarHeight
    };
  }, []);

  const selectAtPoint = useCallback(() => {
    const { x, y: rawY } = lastPointRef.current;

    // Clamp Y to be within viewport safe area to handle dragging outside container (e.g. bottom tab bar)
    let y = rawY;

    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const buffer = 10;
      if (y < rect.top + buffer) {
        y = rect.top + buffer;
      } else if (y > rect.bottom - buffer) {
        y = rect.bottom - buffer;
      }
    } else {
      const { top, bottom, bottomOffset } = getViewportBounds();
      const buffer = 10;
      if (y < top + buffer) {
        y = top + buffer;
      } else if (y > bottom - bottomOffset - buffer) {
        y = bottom - bottomOffset - buffer;
      }
    }

    const element = document.elementFromPoint(x, y);
    const root = element?.closest?.('[data-select-id]');
    const id = root?.dataset?.selectId;
    if (id && id !== lastIdRef.current) {
      onSelect?.(id);
      lastIdRef.current = id;
    }
  }, [getViewportBounds, onSelect]);

  const tickAutoScroll = useCallback(function tick() {
    if (!isDraggingRef.current || scrollSpeedRef.current === 0) {
      stopAutoScroll();
      return;
    }
    window.scrollBy({ top: scrollSpeedRef.current });
    selectAtPoint();
    rafIdRef.current = requestAnimationFrame(tick);
  }, [selectAtPoint, stopAutoScroll]);

  const restorePageState = useCallback(() => {
    document.body.style.touchAction = prevTouchActionRef.current || '';
    document.body.style.userSelect = prevUserSelectRef.current || '';
  }, []);

  const stopDragging = useCallback((event) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const hasMoved = hasMovedRef.current;
    const startId = startIdRef.current;
    hasMovedRef.current = false;
    lastIdRef.current = null;
    startIdRef.current = null;
    if (event?.currentTarget?.releasePointerCapture && pointerIdRef.current !== null) {
      try {
        event.currentTarget.releasePointerCapture(pointerIdRef.current);
      } catch {
        // ignore pointer capture release failures
      }
    }
    pointerIdRef.current = null;
    restorePageState();
    stopAutoScroll();

    if (!hasMoved && startId) {
      suppressClickRef.current = true;
      onToggle?.(startId, event);
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 300);
    } else {
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 300);
    }
  }, [onToggle, restorePageState, stopAutoScroll]);

  const startDragging = useCallback((event) => {
    if (!enabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const root = event.currentTarget.closest('[data-select-id]');
    const id = root?.dataset?.selectId;
    if (!id) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startIdRef.current = id;
    pointerIdRef.current = event.pointerId;

    // Find scroll container
    scrollContainerRef.current = root.closest('.overflow-y-auto') || document.scrollingElement || document.body;

    prevTouchActionRef.current = document.body.style.touchAction;
    prevUserSelectRef.current = document.body.style.userSelect;
    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';
    event.currentTarget.setPointerCapture?.(event.pointerId);
    suppressClickRef.current = true;
    lastPointRef.current = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  }, [enabled]);

  const moveDragging = useCallback((event) => {
    if (!isDraggingRef.current) return;
    if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;

    lastPointRef.current = { x: event.clientX, y: event.clientY };
    if (!hasMovedRef.current) {
      hasMovedRef.current = true;
      if (startIdRef.current) {
        onSelect?.(startIdRef.current);
        lastIdRef.current = startIdRef.current;
        startIdRef.current = null;
      }
    }

    selectAtPoint();

    const topEdgeZone = 100;
    const bottomEdgeZone = 200; // Larger zone for bottom to handle tab bars
    const { top, bottom, bottomOffset } = getViewportBounds();
    const y = event.clientY;
    let speed = 0;
    if (y < top + topEdgeZone) {
      const intensity = (top + topEdgeZone - y) / topEdgeZone;
      speed = -Math.max(2, Math.round(intensity * 16));
    } else if (y > bottom - bottomEdgeZone - bottomOffset) {
      const intensity = (y - (bottom - bottomEdgeZone - bottomOffset)) / bottomEdgeZone;
      speed = Math.max(2, Math.round(intensity * 16));
    }
    scrollSpeedRef.current = speed;
    if (speed !== 0 && rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(tickAutoScroll);
    }
    if (speed === 0) {
      stopAutoScroll();
    }
    event.preventDefault();
  }, [getViewportBounds, onSelect, selectAtPoint, stopAutoScroll, tickAutoScroll]);

  useEffect(() => () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      restorePageState();
    }
    stopAutoScroll();
  }, [restorePageState, stopAutoScroll]);

  if (!enabled) {
    return { dragHandleProps: {} };
  }

  return {
    dragHandleProps: {
      onPointerDown: startDragging,
      onPointerMove: moveDragging,
      onPointerUp: stopDragging,
      onPointerCancel: stopDragging,
      style: { touchAction: 'none' },
      onClickCapture: (event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };
};

export default useDragSelect;

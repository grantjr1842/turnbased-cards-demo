import { useCallback, useEffect, useRef } from "react";

export function useTimerRegistry() {
  const timeoutIds = useRef<Set<number>>(new Set());
  const intervalIds = useRef<Set<number>>(new Set());
  const animationFrameIds = useRef<Set<number>>(new Set());

  const clearTimeoutId = useCallback((timeoutId: number) => {
    window.clearTimeout(timeoutId);
    timeoutIds.current.delete(timeoutId);
  }, []);

  const clearIntervalId = useCallback((intervalId: number) => {
    window.clearInterval(intervalId);
    intervalIds.current.delete(intervalId);
  }, []);

  const cancelAnimationFrameId = useCallback((frameId: number) => {
    window.cancelAnimationFrame(frameId);
    animationFrameIds.current.delete(frameId);
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutIds.current.add(timeoutId);
    return timeoutId;
  }, []);

  const scheduleInterval = useCallback((callback: () => void, delay: number) => {
    const intervalId = window.setInterval(callback, delay);
    intervalIds.current.add(intervalId);
    return intervalId;
  }, []);

  const scheduleAnimationFrame = useCallback((callback: FrameRequestCallback) => {
    const frameId = window.requestAnimationFrame((timestamp) => {
      animationFrameIds.current.delete(frameId);
      callback(timestamp);
    });
    animationFrameIds.current.add(frameId);
    return frameId;
  }, []);

  const clearAll = useCallback(() => {
    timeoutIds.current.forEach((id) => window.clearTimeout(id));
    intervalIds.current.forEach((id) => window.clearInterval(id));
    animationFrameIds.current.forEach((id) => window.cancelAnimationFrame(id));
    timeoutIds.current.clear();
    intervalIds.current.clear();
    animationFrameIds.current.clear();
  }, []);

  useEffect(() => {
    return clearAll;
  }, [clearAll]);

  return {
    scheduleTimeout,
    scheduleInterval,
    scheduleAnimationFrame,
    clearTimeout: clearTimeoutId,
    clearInterval: clearIntervalId,
    cancelAnimationFrame: cancelAnimationFrameId,
    clearAll,
  };
}

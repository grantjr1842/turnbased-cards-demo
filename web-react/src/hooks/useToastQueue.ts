import { useCallback, useRef, useState } from "react";
import type { Toast } from "../gameTypes";
import { useTimerRegistry } from "./useTimerRegistry";

export function useToastQueue() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useTimerRegistry();
  const toastSeq = useRef(0);

  const showToast = useCallback(
    (message: string, kind: Toast["kind"] = "info", duration = 2500) => {
      const id = `toast-${toastSeq.current++}`;
      setToasts((prev) => [...prev, { id, message, kind }]);
      timers.scheduleTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    },
    [timers],
  );

  return {
    showToast,
    toasts,
  };
}

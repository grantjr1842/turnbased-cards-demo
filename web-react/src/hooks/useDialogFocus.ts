import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useDialogFocus(open: boolean, dialogRef: RefObject<HTMLElement | null>) {
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const focusableSelector =
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstControl ?? dialogRef.current)?.focus();
    });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (controls.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trapFocus);
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus();
      }
    };
  }, [open, dialogRef]);
}

import type { Toast } from "../gameTypes";

interface ToastStackProps {
  toasts: Toast[];
}

export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

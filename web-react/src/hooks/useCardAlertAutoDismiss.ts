import { useEffect } from "react";
import type { CardAlert } from "../components/TableCardAlert";

export function useCardAlertAutoDismiss(params: {
  cardAlert: CardAlert | null;
  scheduleTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timeoutId: number) => void;
  setCardAlert: (value: CardAlert | null) => void;
}) {
  const { cardAlert, scheduleTimeout, clearTimeout, setCardAlert } = params;

  useEffect(() => {
    if (!cardAlert) return;
    const timer = scheduleTimeout(() => setCardAlert(null), 1600);
    return () => {
      clearTimeout(timer);
    };
  }, [cardAlert, clearTimeout, scheduleTimeout, setCardAlert]);
}

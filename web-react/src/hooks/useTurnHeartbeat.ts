import { useEffect } from "react";
import { sfx } from "../audio/sfx";

export function useTurnHeartbeat(params: {
  isMyTurn: boolean;
  turnDeadline: number | undefined;
  scheduleInterval: (callback: () => void, delay: number) => number;
  clearInterval: (intervalId: number) => void;
}) {
  const { isMyTurn, turnDeadline, scheduleInterval, clearInterval } = params;

  useEffect(() => {
    if (!isMyTurn || !turnDeadline) return;

    const checkHeartbeat = () => {
      const remaining = turnDeadline - Date.now();
      if (remaining > 0 && remaining < 2500) {
        sfx.playHeartbeat();
      }
    };

    checkHeartbeat();
    const heartbeatInterval = scheduleInterval(checkHeartbeat, 1000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [clearInterval, isMyTurn, scheduleInterval, turnDeadline]);
}

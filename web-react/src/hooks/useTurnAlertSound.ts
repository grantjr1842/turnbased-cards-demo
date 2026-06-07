import { useEffect, useRef } from "react";
import { sfx } from "../audio/sfx";

export function useTurnAlertSound(isMyTurn: boolean) {
  const lastIsMyTurn = useRef(false);

  useEffect(() => {
    if (isMyTurn && !lastIsMyTurn.current) {
      sfx.playTurnAlert();
    }
    lastIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);
}

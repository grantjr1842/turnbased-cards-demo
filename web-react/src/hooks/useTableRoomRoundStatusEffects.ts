import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getPlayerCardCount } from "../gameHelpers";
import { sfx } from "../audio/sfx";
import { updateStats } from "../stats";
import { buildRoundStatusPresentation } from "../components/tableRoomRoundPresentations";
import type { CardAlert } from "../components/TableCardAlert";
import type { PlayerSchema, UnoState } from "../gameTypes";

export function useTableRoomRoundStatusEffects(params: {
  state: UnoState | null;
  opponentPlayers: PlayerSchema[];
  playersBySeat: ReadonlyMap<number, PlayerSchema>;
  me: PlayerSchema | null;
  getBoardParticleOrigin: (offsetY?: number) => { x: number; y: number };
  setCardAlert: Dispatch<SetStateAction<CardAlert | null>>;
  triggerParticles: (x: number, y: number, count?: number, isWild?: boolean) => void;
  localPlayerCardsPlayedRef: MutableRefObject<number>;
  lastUnoRef: MutableRefObject<number>;
  lastPendingRef: MutableRefObject<number>;
  lastWinnerRef: MutableRefObject<number>;
  lastHandCountRef: MutableRefObject<number>;
  matchStartTimeRef: MutableRefObject<number | null>;
}) {
  const {
    state,
    opponentPlayers,
    playersBySeat,
    me,
    getBoardParticleOrigin,
    setCardAlert,
    triggerParticles,
    localPlayerCardsPlayedRef,
    lastUnoRef,
    lastPendingRef,
    lastWinnerRef,
    lastHandCountRef,
    matchStartTimeRef,
  } = params;

  useEffect(() => {
    if (!state) return;

    const roundStatus = buildRoundStatusPresentation({
      currentUno: state.unoCaller ?? -1,
      lastUno: lastUnoRef.current,
      currentPending: state.pendingDraw ?? 0,
      lastPending: lastPendingRef.current,
      currentWinner: state.winner ?? -1,
      lastWinner: lastWinnerRef.current,
      currentHand: getPlayerCardCount(me),
      lastHandCount: lastHandCountRef.current,
      me,
      playersBySeat,
      opponentPlayers,
      matchStartTimeMs: matchStartTimeRef.current,
      cardsPlayed: localPlayerCardsPlayedRef.current,
    });
    if (roundStatus.unoAlert) {
      setCardAlert(roundStatus.unoAlert);
      sfx.playChime();
      const unoOrigin = getBoardParticleOrigin();
      triggerParticles(unoOrigin.x, unoOrigin.y, roundStatus.unoParticleCount);
    }
    if (roundStatus.pendingDrawAlert) {
      setCardAlert(roundStatus.pendingDrawAlert);
      sfx.playPluck();
      const drawStackOrigin = getBoardParticleOrigin();
      triggerParticles(drawStackOrigin.x, drawStackOrigin.y, roundStatus.pendingDrawParticleCount);
    }
    if (roundStatus.winnerSummary) {
      sfx.playChime();
      updateStats(
        roundStatus.winnerSummary.win,
        roundStatus.winnerSummary.cardsPlayed,
        roundStatus.winnerSummary.botKills,
        roundStatus.winnerSummary.winnerName,
        roundStatus.winnerSummary.durationSec,
        roundStatus.winnerSummary.opponentNames,
      );
      const winOrigin = getBoardParticleOrigin();
      triggerParticles(winOrigin.x, winOrigin.y, roundStatus.winnerParticleCount);
    }
    if (roundStatus.handSwish) {
      sfx.playSwish();
    }
    lastUnoRef.current = state.unoCaller ?? -1;
    lastPendingRef.current = state.pendingDraw ?? 0;
    lastWinnerRef.current = state.winner ?? -1;
    lastHandCountRef.current = getPlayerCardCount(me);
  }, [
    getBoardParticleOrigin,
    lastHandCountRef,
    lastPendingRef,
    lastUnoRef,
    lastWinnerRef,
    localPlayerCardsPlayedRef,
    me,
    opponentPlayers,
    playersBySeat,
    setCardAlert,
    state,
    triggerParticles,
    matchStartTimeRef,
  ]);
}

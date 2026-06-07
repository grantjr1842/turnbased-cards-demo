import { useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { Room } from "@colyseus/sdk";
import { DISCARD_PILE_ANCHOR_ID, type ActionBubble, type TableRoomAnchorId } from "../components/tableRoomModel";
import { sfx } from "../audio/sfx";
import { buildDiscardPlayPresentation } from "../components/tableRoomActionPresentations";
import { buildTurnChangePresentation } from "../components/tableRoomRoundPresentations";
import type { CardAlert } from "../components/TableCardAlert";
import type { TurnBanner } from "../components/tableRoomOverlayFlow";
import type { CardSchema, PlayerSchema, UnoState } from "../gameTypes";

export function useTableRoomTurnEffects(params: {
  state: UnoState | null;
  players: PlayerSchema[];
  playersBySeat: Map<number, PlayerSchema>;
  me: PlayerSchema | null;
  room: Room<UnoState> | null;
  scheduleTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timeoutId: number) => void;
  triggerFlight: (card: CardSchema | null, isBack: boolean, startElId: TableRoomAnchorId, endElId: TableRoomAnchorId) => void;
  triggerBotEmotion: (seatIndex: number, emoji: string, duration?: number) => void;
  triggerParticles: (x: number, y: number, count?: number, isWild?: boolean) => void;
  getBoardParticleOrigin: (offsetY?: number) => { x: number; y: number };
  setCardAlert: Dispatch<SetStateAction<CardAlert | null>>;
  setActionBubbles: Dispatch<SetStateAction<ActionBubble[]>>;
  setTurnBanner: Dispatch<SetStateAction<TurnBanner | null>>;
  setSkippedSeatIndex: Dispatch<SetStateAction<number>>;
  setShowReverseSweep: Dispatch<SetStateAction<boolean>>;
  setShockwaves: Dispatch<SetStateAction<{ id: string; color: string }[]>>;
  localPlayerCardsPlayedRef: MutableRefObject<number>;
  prevCurrentPlayerRef: MutableRefObject<number>;
  lastDiscardCountRef: MutableRefObject<number>;
  boardRef: RefObject<HTMLElement | null>;
}) {
  const {
    state,
    players,
    playersBySeat,
    me,
    room,
    scheduleTimeout,
    clearTimeout,
    triggerFlight,
    triggerBotEmotion,
    triggerParticles,
    getBoardParticleOrigin,
    setCardAlert,
    setActionBubbles,
    setTurnBanner,
    setSkippedSeatIndex,
    setShowReverseSweep,
    setShockwaves,
    localPlayerCardsPlayedRef,
    prevCurrentPlayerRef,
    lastDiscardCountRef,
    boardRef,
  } = params;
  const turnBannerTimeoutRef = useRef<number | null>(null);
  const skippedSeatTimeoutRef = useRef<number | null>(null);
  const transitionIdSeqRef = useRef(0);

  const clearTrackedTimeout = (timeoutRef: MutableRefObject<number | null>) => {
    if (timeoutRef.current == null) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const nextTransitionArtifactId = (prefix: string) => {
    const id = `${prefix}-${Date.now()}-${transitionIdSeqRef.current}`;
    transitionIdSeqRef.current += 1;
    return id;
  };

  useEffect(() => {
    if (!state) return;

    const currentDiscard = state.discardPile?.length ?? 0;
    const prevSeat = prevCurrentPlayerRef.current;
    const currentSeat = state.currentPlayer ?? -1;

    const turnChange = buildTurnChangePresentation({
      state,
      players,
      playersBySeat,
      roomSessionId: room?.sessionId ?? null,
      prevSeat,
      currentSeat,
    });
    if (turnChange) {
      setTurnBanner(turnChange.turnBanner);
      clearTrackedTimeout(turnBannerTimeoutRef);
      turnBannerTimeoutRef.current = scheduleTimeout(() => {
        setTurnBanner(null);
        turnBannerTimeoutRef.current = null;
      }, 1200);

      if (turnChange.skippedSeatIndex !== -1) {
        setSkippedSeatIndex(turnChange.skippedSeatIndex);
        clearTrackedTimeout(skippedSeatTimeoutRef);
        skippedSeatTimeoutRef.current = scheduleTimeout(() => {
          setSkippedSeatIndex(-1);
          skippedSeatTimeoutRef.current = null;
        }, 1500);
      }

      if (turnChange.skippedBotEmotion) {
        triggerBotEmotion(turnChange.skippedBotEmotion.seatIndex, turnChange.skippedBotEmotion.emoji, 2000);
      }
    }

    if (currentDiscard > lastDiscardCountRef.current && lastDiscardCountRef.current > 0) {
      sfx.playPluck();

      const top = state.discardPile?.[state.discardPile.length - 1];
      const playedPlayer = prevSeat !== -1 ? playersBySeat.get(prevSeat) ?? null : null;
      const presentation =
        top && playedPlayer
          ? buildDiscardPlayPresentation({
              top,
              playedPlayer,
              roomSessionId: room?.sessionId ?? null,
            })
          : null;

      const drawOrigin = getBoardParticleOrigin(-50);
      triggerParticles(drawOrigin.x, drawOrigin.y, presentation?.drawParticleCount ?? 15, presentation?.isWild ?? false);

      if (me && me.seatIndex === state.currentPlayer) {
        localPlayerCardsPlayedRef.current += 1;
      }

      if (top) {
        if (presentation?.cardAlert) {
          setCardAlert(presentation.cardAlert);
        }

        scheduleTimeout(() => {
          const swColor = top.chosenColor || top.color || "gold";
          const swId = nextTransitionArtifactId("shockwave");
          setShockwaves((prev) => [...prev, { id: swId, color: swColor }]);
          scheduleTimeout(() => {
            setShockwaves((prev) => prev.filter((sw) => sw.id !== swId));
          }, 800);
        }, 350);

        if (presentation && playedPlayer) {
          const bubbleId = nextTransitionArtifactId("bubble");
          scheduleTimeout(() => {
            triggerFlight(top, false, presentation.startElId, DISCARD_PILE_ANCHOR_ID);
          }, 50);

          setActionBubbles((prev) => [
            ...prev,
            {
              id: bubbleId,
              seatIndex: prevSeat,
              text: presentation.bubbleText,
              themeColor: presentation.bubbleThemeColor,
            },
          ]);
          scheduleTimeout(() => {
            setActionBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
          }, 1800);

          if (presentation.botEmotion) {
            triggerBotEmotion(prevSeat, presentation.botEmotion, 2200);
          }
        }

        if (presentation?.shouldReverseSweep) {
          setShowReverseSweep(true);
          scheduleTimeout(() => setShowReverseSweep(false), 1500);
          const boardEl = boardRef.current;
          if (boardEl) {
            boardEl.classList.add("camera-shake");
            scheduleTimeout(() => boardEl.classList.remove("camera-shake"), 600);
          }
        }
      }
    }

    prevCurrentPlayerRef.current = currentSeat;
    lastDiscardCountRef.current = currentDiscard;
  }, [
    boardRef,
    getBoardParticleOrigin,
    lastDiscardCountRef,
    localPlayerCardsPlayedRef,
    me,
    players,
    playersBySeat,
    prevCurrentPlayerRef,
    room,
    scheduleTimeout,
    clearTimeout,
    setActionBubbles,
    setCardAlert,
    setShowReverseSweep,
    setShockwaves,
    setSkippedSeatIndex,
    setTurnBanner,
    state,
    triggerBotEmotion,
    triggerFlight,
    triggerParticles,
  ]);

  useEffect(() => {
    return () => {
      clearTrackedTimeout(turnBannerTimeoutRef);
      clearTrackedTimeout(skippedSeatTimeoutRef);
    };
  }, []);
}

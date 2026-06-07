import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Room } from "@colyseus/sdk";
import type { ActionBubble, TableRoomAnchorId } from "../components/tableRoomModel";
import type { CardAlert } from "../components/TableCardAlert";
import type { TurnBanner } from "../components/tableRoomOverlayFlow";
import type { CardSchema, PlayerSchema, UnoState } from "../gameTypes";
import { useTableRoomTurnEffects } from "./useTableRoomTurnEffects";
import { useTableRoomRoundStatusEffects } from "./useTableRoomRoundStatusEffects";

export function useTableRoomStateTransitions(params: {
  state: UnoState | null;
  players: PlayerSchema[];
  opponentPlayers: PlayerSchema[];
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
  localPlayerCardsPlayedRef: { current: number };
  prevCurrentPlayerRef: { current: number };
  lastDiscardCountRef: { current: number };
  lastUnoRef: { current: number };
  lastPendingRef: { current: number };
  lastWinnerRef: { current: number };
  lastHandCountRef: { current: number };
  matchStartTimeRef: { current: number | null };
  boardRef: RefObject<HTMLElement | null>;
}) {
  useTableRoomTurnEffects({
    state: params.state,
    players: params.players,
    playersBySeat: params.playersBySeat,
    me: params.me,
    room: params.room,
    scheduleTimeout: params.scheduleTimeout,
    clearTimeout: params.clearTimeout,
    triggerFlight: params.triggerFlight,
    triggerBotEmotion: params.triggerBotEmotion,
    triggerParticles: params.triggerParticles,
    getBoardParticleOrigin: params.getBoardParticleOrigin,
    setCardAlert: params.setCardAlert,
    setActionBubbles: params.setActionBubbles,
    setTurnBanner: params.setTurnBanner,
    setSkippedSeatIndex: params.setSkippedSeatIndex,
    setShowReverseSweep: params.setShowReverseSweep,
    setShockwaves: params.setShockwaves,
    localPlayerCardsPlayedRef: params.localPlayerCardsPlayedRef,
    prevCurrentPlayerRef: params.prevCurrentPlayerRef,
    lastDiscardCountRef: params.lastDiscardCountRef,
    boardRef: params.boardRef,
  });

  useTableRoomRoundStatusEffects({
    state: params.state,
    opponentPlayers: params.opponentPlayers,
    playersBySeat: params.playersBySeat,
    me: params.me,
    getBoardParticleOrigin: params.getBoardParticleOrigin,
    setCardAlert: params.setCardAlert,
    triggerParticles: params.triggerParticles,
    localPlayerCardsPlayedRef: params.localPlayerCardsPlayedRef,
    lastUnoRef: params.lastUnoRef,
    lastPendingRef: params.lastPendingRef,
    lastWinnerRef: params.lastWinnerRef,
    lastHandCountRef: params.lastHandCountRef,
    matchStartTimeRef: params.matchStartTimeRef,
  });
}

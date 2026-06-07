import type { Room } from "@colyseus/sdk";
import { cardLabel, getPlayDirection, normalizeActiveColor } from "../gameHelpers.ts";
import { getDeckLayerCount } from "./tableRoomModel.ts";
import type { UnoState } from "../gameTypes";

export function buildTableRoomSceneState({
  room,
  state,
  currentPlayerLabel,
  activePlayerThemeColor,
  isMyTurn,
  spotlightPos,
}: {
  room: Room<UnoState> | null;
  state: UnoState | null;
  currentPlayerLabel: string;
  activePlayerThemeColor: string;
  isMyTurn: boolean;
  spotlightPos: string;
}) {
  const discardPile = state?.discardPile ?? [];
  const topCard = discardPile[discardPile.length - 1] ?? null;
  const deckCount = state?.drawPileCount ?? state?.deckCount ?? 0;

  return {
    discardPile,
    topCard,
    topCardLabel: cardLabel(topCard),
    roomCode: room?.roomId ?? "Room",
    tableReady: Boolean(topCard),
    phase: state?.phase,
    activeColor: normalizeActiveColor(state?.activeColor),
    direction: getPlayDirection(state),
    activeSeat: state?.currentPlayer ?? -1,
    turnDeadline: state?.turnDeadline ?? undefined,
    deckCount,
    deckLayerCount: getDeckLayerCount(deckCount),
    currentPlayerLabel,
    activePlayerThemeColor,
    isMyTurn,
    spotlightPos,
  };
}

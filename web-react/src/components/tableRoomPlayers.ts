import type { PlayerSchema } from "../gameTypes.ts";
import { AVATAR_THEMES_BY_ID } from "../tableConfig.ts";
import { AVATAR_SYMBOLS_BY_ID } from "../tableConfig.ts";
import { getPlayerCardCount, parsePlayerName } from "../gameHelpers.ts";
import type { UnoState } from "../gameTypes.ts";

export type SpotlightPos = "bottom" | "top" | "left" | "right" | "none";

export interface MeSummary {
  displayName: string;
  symbol: string;
  theme: string;
  seatIndex: number;
  spectatorCount: number;
}

export interface RosterEntry {
  sessionId: string;
  displayName: string;
  symbol: string;
  theme: string;
  isBot: boolean;
  cardCount: number;
  active: boolean;
}

export interface TableRoomPlayerState {
  playersBySeat: Map<number, PlayerSchema>;
  me: PlayerSchema | null;
  opponentPlayers: PlayerSchema[];
  connectedHumanPlayers: PlayerSchema[];
  opponentSeatIndexBySeat: Map<number, number>;
  hasOneCardWarning: boolean;
}

export interface TableRoomTurnState {
  currentPlayerLabel: string;
  activePlayerThemeColor: string;
  isMyTurn: boolean;
  spotlightPos: SpotlightPos;
}

export function buildPlayerCardCountSnapshot(players: PlayerSchema[]) {
  const snapshot: Record<number, number> = {};
  for (const player of players) {
    snapshot[player.seatIndex] = getPlayerCardCount(player);
  }
  return snapshot;
}

export function buildBotEmotionState(players: PlayerSchema[]) {
  const botEmotions: Record<number, string> = {};
  for (const player of players) {
    if (!player.isBot) continue;
    const cardCount = getPlayerCardCount(player);
    if (cardCount === 1) {
      botEmotions[player.seatIndex] = "😰";
    } else if (cardCount === 2) {
      botEmotions[player.seatIndex] = "😬";
    }
  }
  return botEmotions;
}

export function buildVisibleBotEmotionState(params: {
  players: PlayerSchema[];
  baseBotEmotions: Record<string, string>;
  overrides: Record<string, string>;
}) {
  const { players, baseBotEmotions, overrides } = params;
  const botEmotions: Record<number, string> = {};
  for (const player of players) {
    if (!player.isBot) continue;
    const override = overrides[player.sessionId];
    if (override) {
      botEmotions[player.seatIndex] = override;
      continue;
    }
    const baseEmotion = baseBotEmotions[player.seatIndex];
    if (baseEmotion) {
      botEmotions[player.seatIndex] = baseEmotion;
    }
  }
  return botEmotions;
}

export function buildMeSummary(me: PlayerSchema | null | undefined, spectatorCount: number): MeSummary | null {
  if (!me) return null;
  const av = parsePlayerName(me.name);
  return {
    displayName: av.name,
    symbol: av.symbol,
    theme: av.theme,
    seatIndex: me.seatIndex,
    spectatorCount,
  };
}

export function buildRosterEntries(opponents: PlayerSchema[], currentPlayerSeat: number | undefined): RosterEntry[] {
  return opponents.map((player) => {
    const av = parsePlayerName(player.name);
    return {
      sessionId: player.sessionId,
      displayName: av.name,
      symbol: AVATAR_SYMBOLS_BY_ID.get(av.symbol)?.emoji ?? "🐯",
      theme: av.theme,
      isBot: player.isBot,
      cardCount: getPlayerCardCount(player),
      active: player.seatIndex === currentPlayerSeat,
    };
  });
}

export function buildTableRoomPlayerState(players: PlayerSchema[], roomSessionId: string | null): TableRoomPlayerState {
  const playersBySeat = new Map<number, PlayerSchema>();
  const opponentPlayers: PlayerSchema[] = [];
  const connectedHumanPlayers: PlayerSchema[] = [];
  const opponentSeatIndexBySeat = new Map<number, number>();
  let me: PlayerSchema | null = null;
  let opponentIndex = 0;
  let hasOneCardWarning = false;

  for (const player of players) {
    playersBySeat.set(player.seatIndex, player);
    if (!hasOneCardWarning && getPlayerCardCount(player) === 1) {
      hasOneCardWarning = true;
    }
    if (roomSessionId !== null && player.sessionId === roomSessionId) {
      me = player;
    }
    if (player.sessionId !== roomSessionId) {
      opponentPlayers.push(player);
      opponentSeatIndexBySeat.set(player.seatIndex, opponentIndex);
      opponentIndex += 1;
    }
    if (!player.isBot && player.connected) {
      connectedHumanPlayers.push(player);
    }
  }

  return { playersBySeat, me, opponentPlayers, connectedHumanPlayers, opponentSeatIndexBySeat, hasOneCardWarning };
}

export function buildTableRoomTurnState(params: {
  state: UnoState | null;
  playersBySeat: ReadonlyMap<number, PlayerSchema>;
  me: PlayerSchema | null;
  opponentSeatIndexBySeat: ReadonlyMap<number, number>;
  opponentPlayersCount: number;
}): TableRoomTurnState {
  const { state, playersBySeat, me, opponentSeatIndexBySeat, opponentPlayersCount } = params;
  const currentPlayer = state?.currentPlayer == null ? null : playersBySeat.get(state.currentPlayer) ?? null;
  const currentPlayerLabel = currentPlayer ? parsePlayerName(currentPlayer.name).name : "Waiting";
  const activePlayerThemeColor = getActivePlayerThemeColor(currentPlayer);
  const isMyTurn = !!me && me.seatIndex === state?.currentPlayer && state?.winner === -1;
  const spotlightPos = getSpotlightPos({
    isMyTurn,
    opponentSeatIndexBySeat,
    currentPlayerSeat: state?.currentPlayer,
    opponentSeatCount: opponentPlayersCount,
  });

  return {
    currentPlayerLabel,
    activePlayerThemeColor,
    isMyTurn,
    spotlightPos,
  };
}

export function getSpotlightPos(params: {
  isMyTurn: boolean;
  opponentSeatIndexBySeat: ReadonlyMap<number, number>;
  currentPlayerSeat: number | undefined;
  opponentSeatCount: number;
}): SpotlightPos {
  const { isMyTurn, opponentSeatIndexBySeat, currentPlayerSeat, opponentSeatCount } = params;
  if (isMyTurn) return "bottom";
  if (currentPlayerSeat == null) return "none";
  const activeOpponentIdx = opponentSeatIndexBySeat.get(currentPlayerSeat);
  if (activeOpponentIdx == null) return "none";
  const total = opponentSeatCount;
  if (total === 1) return "top";
  if (total === 2) return activeOpponentIdx === 0 ? "left" : "right";
  if (activeOpponentIdx === 0) return "left";
  if (activeOpponentIdx === 1) return "top";
  return "right";
}

export function getActivePlayerThemeColor(currentPlayer: PlayerSchema | null | undefined) {
  if (!currentPlayer) return "rgba(255, 255, 255, 0.1)";
  const av = parsePlayerName(currentPlayer.name);
  const themeInfo = AVATAR_THEMES_BY_ID.get(av.theme);
  return themeInfo ? themeInfo.primary : "rgba(255, 255, 255, 0.1)";
}

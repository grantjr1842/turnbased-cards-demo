import type { PlayerSchema, UnoState } from "../gameTypes.ts";
import { AVATAR_SYMBOLS_BY_ID, AVATAR_THEMES_BY_ID } from "../tableConfig.ts";
import { getPlayDirection, parsePlayerName } from "../gameHelpers.ts";
import { buildMatchSummary, type MatchSummary } from "../stats.ts";

export interface TurnChangePresentation {
  turnBanner: {
    name: string;
    subtitle: string;
    emoji: string;
    themeColor: string;
  };
  skippedSeatIndex: number;
  skippedBotEmotion: {
    seatIndex: number;
    emoji: string;
  } | null;
}

export interface RoundStatusPresentation {
  unoAlert:
    | {
        variant: "crest";
        kind: "warning" | "success";
        icon: "⚠️" | "🏆";
        title: string;
        subtitle: string;
      }
    | null;
  unoParticleCount: number;
  pendingDrawAlert:
    | {
        variant: "banner";
        tone: "warning";
        text: string;
      }
    | null;
  pendingDrawParticleCount: number;
  winnerSummary: MatchSummary | null;
  winnerParticleCount: number;
  handSwish: boolean;
}

export function buildTurnChangePresentation(params: {
  state: UnoState | null;
  players: PlayerSchema[];
  playersBySeat: ReadonlyMap<number, PlayerSchema>;
  roomSessionId: string | null;
  prevSeat: number;
  currentSeat: number;
}): TurnChangePresentation | null {
  const { state, players, playersBySeat, roomSessionId, prevSeat, currentSeat } = params;
  if (currentSeat === -1 || currentSeat === prevSeat || state?.winner !== -1) return null;

  const activePlayer = playersBySeat.get(currentSeat);
  if (!activePlayer) return null;

  const av = parsePlayerName(activePlayer.name);
  const themeInfo = AVATAR_THEMES_BY_ID.get(av.theme);
  const emoji = AVATAR_SYMBOLS_BY_ID.get(av.symbol)?.emoji || "🐯";
  const turnBanner = {
    name: activePlayer.sessionId === roomSessionId ? "Your Turn" : av.name,
    subtitle: activePlayer.sessionId === roomSessionId ? "Make your move!" : "Thinking...",
    emoji,
    themeColor: themeInfo ? themeInfo.primary : "var(--gold)",
  };

  const direction = getPlayDirection(state);
  const totalPlayers = players.length;
  let skippedSeatIndex = -1;
  let skippedBotEmotion: TurnChangePresentation["skippedBotEmotion"] = null;

  if (prevSeat !== -1 && totalPlayers > 1) {
    const expectedNext = (prevSeat + direction + totalPlayers) % totalPlayers;
    if (expectedNext !== currentSeat) {
      skippedSeatIndex = expectedNext;
      const skippedPlayer = playersBySeat.get(expectedNext);
      if (skippedPlayer?.isBot) {
        skippedBotEmotion = { seatIndex: expectedNext, emoji: "😱" };
      }
    }
  }

  return {
    turnBanner,
    skippedSeatIndex,
    skippedBotEmotion,
  };
}

export function buildRoundStatusPresentation(params: {
  currentUno: number;
  lastUno: number;
  currentPending: number;
  lastPending: number;
  currentWinner: number;
  lastWinner: number;
  currentHand: number;
  lastHandCount: number;
  me: PlayerSchema | null;
  playersBySeat: ReadonlyMap<number, PlayerSchema>;
  opponentPlayers: PlayerSchema[];
  matchStartTimeMs: number | null;
  cardsPlayed: number;
}): RoundStatusPresentation {
  const {
    currentUno,
    lastUno,
    currentPending,
    lastPending,
    currentWinner,
    lastWinner,
    currentHand,
    lastHandCount,
    me,
    playersBySeat,
    opponentPlayers,
    matchStartTimeMs,
    cardsPlayed,
  } = params;

  let unoAlert: RoundStatusPresentation["unoAlert"] = null;
  let unoParticleCount = 0;
  if (currentUno !== -1 && lastUno === -1) {
    const uPlayer = playersBySeat.get(currentUno);
    if (uPlayer) {
      const name = parsePlayerName(uPlayer.name).name;
      unoAlert = {
        variant: "crest",
        kind: "warning",
        icon: "⚠️",
        title: `${name} HAS 1 CARD!`,
        subtitle: "Single Card Alert",
      };
      unoParticleCount = 25;
    }
  } else if (currentUno === -1 && lastUno !== -1) {
    const uPlayer = playersBySeat.get(lastUno);
    if (uPlayer) {
      const name = parsePlayerName(uPlayer.name).name;
      unoAlert = {
        variant: "crest",
        kind: "success",
        icon: "🏆",
        title: `${name} CALLED UNO!`,
        subtitle: "Uno Championship Honor",
      };
      unoParticleCount = 35;
    }
  }

  const pendingDrawAlert =
    currentPending > lastPending && currentPending > 0
      ? {
          variant: "banner" as const,
          tone: "warning" as const,
          text: `🔥 +${currentPending} DRAW STACKED!`,
        }
      : null;
  const pendingDrawParticleCount = pendingDrawAlert ? 20 : 0;

  const winnerSummary =
    currentWinner !== -1 && lastWinner === -1
      ? buildMatchSummary({
          me,
          opponentPlayers,
          winnerSeat: currentWinner,
          matchStartTimeMs,
          cardsPlayed,
          playersBySeat,
        })
      : null;
  const winnerParticleCount = winnerSummary ? 40 : 0;

  const handSwish = currentHand > lastHandCount && lastHandCount > 0;

  return {
    unoAlert,
    unoParticleCount,
    pendingDrawAlert,
    pendingDrawParticleCount,
    winnerSummary,
    winnerParticleCount,
    handSwish,
  };
}

import { readStorageItem, writeStorageItem } from "./storage.ts";
import { parsePlayerName } from "./gameHelpers.ts";
import type { PlayerSchema } from "./gameTypes";

export interface MatchHistoryEntry {
  id: string;
  timestamp: number;
  win: boolean;
  winnerName: string;
  cardsPlayed: number;
  durationSec: number;
  opponentNames: string[];
}

export interface DisplayMatchHistoryEntry extends MatchHistoryEntry {
  winnerDisplayName: string;
  opponentDisplayNames: string[];
  formattedDate: string;
  durationLabel: string;
}

export interface MatchSummary {
  win: boolean;
  cardsPlayed: number;
  botKills: number;
  winnerName: string;
  durationSec: number;
  opponentNames: string[];
}

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  cardsPlayed: number;
  botKnockouts: number;
  history?: MatchHistoryEntry[];
}

function notifyStatsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("uno-stats-updated"));
}

export function subscribeToStatsChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = () => onStoreChange();
  const handleCustomEvent = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener("uno-stats-updated", handleCustomEvent);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("uno-stats-updated", handleCustomEvent);
  };
}

export function getStatsSnapshot() {
  return readStorageItem("uno_stats") ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonNegativeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeHistory(rawHistory: unknown): MatchHistoryEntry[] {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];

    const id = typeof entry.id === "string" ? entry.id : `match-${index}`;
    const timestamp = toNonNegativeNumber(entry.timestamp, Date.now());
    const win = entry.win === true;
    const winnerName = typeof entry.winnerName === "string" ? entry.winnerName : "Winner";
    const cardsPlayed = toNonNegativeNumber(entry.cardsPlayed, 0);
    const durationSec = toNonNegativeNumber(entry.durationSec, 0);
    const opponentNames = toStringArray(entry.opponentNames);

    return [
      {
        id,
        timestamp,
        win,
        winnerName,
        cardsPlayed,
        durationSec,
        opponentNames,
      },
    ];
  });
}

export function parseStatsSnapshot(raw: string): GameStats {
  const defaults: GameStats = {
    played: 0,
    wins: 0,
    losses: 0,
    cardsPlayed: 0,
    botKnockouts: 0,
    history: [],
  };

  try {
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return defaults;

    return {
      played: toNonNegativeNumber(parsed.played),
      wins: toNonNegativeNumber(parsed.wins),
      losses: toNonNegativeNumber(parsed.losses),
      cardsPlayed: toNonNegativeNumber(parsed.cardsPlayed),
      botKnockouts: toNonNegativeNumber(parsed.botKnockouts),
      history: normalizeHistory(parsed.history),
    };
  } catch {
    return defaults;
  }
}

export function getStats(): GameStats {
  return parseStatsSnapshot(getStatsSnapshot());
}

export function formatMatchHistory(history: MatchHistoryEntry[] = []): DisplayMatchHistoryEntry[] {
  return history.map((entry) => ({
    ...entry,
    winnerDisplayName: parsePlayerName(entry.winnerName).name,
    opponentDisplayNames: entry.opponentNames.map((name) => parsePlayerName(name).name),
    formattedDate: new Date(entry.timestamp).toLocaleDateString(),
    durationLabel: `${Math.round(entry.durationSec)}s`,
  }));
}

export function updateStats(
  win: boolean,
  cards: number,
  botKills: number,
  winnerName = "Winner",
  durationSec = 0,
  opponents: string[] = [],
) {
  try {
    const curr = parseStatsSnapshot(getStatsSnapshot());
    const timestamp = Date.now();
    const safeCards = toNonNegativeNumber(cards, 0);
    const safeBotKills = toNonNegativeNumber(botKills, 0);
    const safeDurationSec = toNonNegativeNumber(durationSec, 0);
    const safeWinnerName = typeof winnerName === "string" && winnerName.trim() ? winnerName.trim() : "Winner";
    const safeOpponents = opponents.filter((name): name is string => typeof name === "string" && name.trim().length > 0);

    curr.played += 1;
    if (win) curr.wins += 1;
    else curr.losses += 1;
    curr.cardsPlayed += safeCards;
    curr.botKnockouts += safeBotKills;

    if (!curr.history) curr.history = [];
    curr.history.unshift({
      id: `match-${timestamp}`,
      timestamp,
      win,
      winnerName: safeWinnerName,
      cardsPlayed: safeCards,
      durationSec: safeDurationSec,
      opponentNames: safeOpponents,
    });
    if (curr.history.length > 10) {
      curr.history = curr.history.slice(0, 10);
    }
    writeStorageItem("uno_stats", JSON.stringify(curr));
    notifyStatsUpdated();
  } catch {
    // ignored
  }
}

export function buildMatchSummary(params: {
  me: PlayerSchema | null;
  opponentPlayers: PlayerSchema[];
  winnerSeat: number;
  matchStartTimeMs: number | null;
  cardsPlayed: number;
  playersBySeat: ReadonlyMap<number, PlayerSchema>;
}): MatchSummary | null {
  const { me, opponentPlayers, winnerSeat, matchStartTimeMs, cardsPlayed, playersBySeat } = params;
  if (!me) return null;

  const win = me.seatIndex === winnerSeat;
  const botKills = win ? opponentPlayers.filter((player) => player.isBot).length : 0;
  const winnerPlayer = playersBySeat.get(winnerSeat);
  const winnerName = winnerPlayer ? winnerPlayer.name : "Winner";
  const durationSec = matchStartTimeMs ? (Date.now() - matchStartTimeMs) / 1000 : 0;
  const opponentNames = opponentPlayers.map((player) => player.name);

  return {
    win,
    cardsPlayed,
    botKills,
    winnerName,
    durationSec,
    opponentNames,
  };
}

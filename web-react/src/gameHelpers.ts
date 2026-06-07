import type { CardSchema, PlayDirection, PlayerSchema, UnoColor, UnoState } from "./gameTypes";

export function parsePlayerName(rawName: string) {
  const match = rawName.match(/^\[av-([a-z0-9]+)-([a-z0-9]+)\](.*)$/);
  if (match) {
    return {
      symbol: match[1],
      theme: match[2],
      name: match[3],
    };
  }

  const botMatch = rawName.match(/^Bot\s+(\d+)$/i);
  if (botMatch) {
    const num = parseInt(botMatch[1], 10);
    const symbols = ["fox", "owl", "panda", "wolf"];
    const themes = ["rose", "sapphire", "aurora", "sol"];
    return {
      symbol: symbols[(num - 1) % symbols.length],
      theme: themes[(num - 1) % themes.length],
      name: rawName,
    };
  }

  return {
    symbol: "tiger",
    theme: "rose",
    name: rawName || "Player",
  };
}

export function cardLabel(card: CardSchema | null | undefined) {
  if (!card) return "Empty";
  if (card.cardType === "wild") return card.value === "wild_draw4" ? "Wild +4" : "Wild";
  const value =
    card.value === "draw2"
      ? "+2"
      : card.value === "reverse"
        ? "Reverse"
        : card.value === "skip"
          ? "Skip"
          : card.value;
  return `${card.color} ${value}`;
}

export function getCardCountClass(count: number) {
  if (count === 1) return "gauge-critical";
  if (count <= 3) return "gauge-alert";
  return "gauge-safe";
}

export function getPlayerCardCount(player: PlayerSchema | null | undefined) {
  return player?.handCount ?? player?.hand?.length ?? 0;
}

export function getDeterministicRotation(idx: number) {
  const rotations = [-6, 8, -3, 5, -7, 4, -8, 2, -1, 6, -5, 3, -4, 7, -2, 9];
  return rotations[Math.abs(idx) % rotations.length];
}

export function getDeterministicOffsetX(idx: number) {
  const offsets = [-3, 5, -2, 3, -5, 1, -4, 2, -1, 4, -3, 0, -4, 4, -1, 2];
  return offsets[Math.abs(idx) % offsets.length];
}

export function getDeterministicOffsetY(idx: number) {
  const offsets = [1, -5, 3, -2, 4, -3, 5, -4, 0, -4, 2, -1, 3, -5, 1, -2];
  return offsets[Math.abs(idx) % offsets.length];
}

export function statePlayers(state: UnoState | null): PlayerSchema[] {
  if (!state?.players) return [];
  const players = state.players instanceof Map ? Array.from(state.players.values()) : Object.values(state.players);
  return players.sort((a, b) => a.seatIndex - b.seatIndex);
}

export function isCounterClockwise(direction: PlayDirection) {
  return direction === -1;
}

export function getPlayDirectionLabels(direction: PlayDirection) {
  return isCounterClockwise(direction)
    ? {
        short: "CCW ◀",
        full: "Counter-Clockwise ◀",
      }
    : {
        short: "CW ▶",
        full: "Clockwise ▶",
      };
}

export function getPlayDirection(state: Pick<UnoState, "direction"> | null | undefined): PlayDirection {
  return state?.direction ?? 1;
}

export function normalizeActiveColor(value: string | undefined): UnoColor {
  if (value === "red" || value === "blue" || value === "green" || value === "yellow") {
    return value;
  }
  return "red";
}

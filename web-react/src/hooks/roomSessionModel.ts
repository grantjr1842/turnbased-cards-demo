import type { CardSchema, ChatMessageSchema, PlayerSchema, Toast, UnoState } from "../gameTypes";
import { normalizeActiveColor } from "../gameHelpers.ts";

type SchemaCollection<T> = {
  forEach?: (callback: (value: T) => void) => void;
  values?: () => IterableIterator<T>;
};

export function schemaValues<T>(raw: unknown): T[] {
  if (!raw) return [];
  const collected: T[] = [];
  if (Array.isArray(raw)) return raw as T[];

  const maybeCollection = raw as SchemaCollection<T>;

  if (typeof maybeCollection.forEach === "function") {
    maybeCollection.forEach((value: T) => collected.push(value));
    return collected;
  }

  if (typeof maybeCollection.values === "function") {
    return Array.from(maybeCollection.values());
  }

  if (typeof raw === "object") {
    return Object.values(raw as Record<string, T>).filter(
      (value): value is T => value !== undefined && value !== null,
    );
  }

  return collected;
}

export function snapshotRoomState(next: UnoState): UnoState {
  const drawPileCount = next.drawPileCount ?? next.deckCount ?? 0;
  const deckCount = next.deckCount ?? drawPileCount;
  return {
    players: Object.fromEntries(
      schemaValues<PlayerSchema>(next.players).map((player) => [String(player.seatIndex), player]),
    ),
    discardPile: schemaValues<CardSchema>(next.discardPile),
    drawPileCount,
    deckCount,
    currentPlayer: next.currentPlayer ?? -1,
    direction: next.direction ?? 1,
    activeColor: normalizeActiveColor(next.activeColor),
    pendingDraw: next.pendingDraw ?? 0,
    winner: next.winner ?? -1,
    phase: next.phase ?? "waiting",
    spectatorCount: next.spectatorCount ?? 0,
    chatMessages: schemaValues<ChatMessageSchema>(next.chatMessages),
    unoCaller: next.unoCaller ?? -1,
    rematchVotes: schemaValues<number>(next.rematchVotes),
    turnDeadline: next.turnDeadline ?? 0,
  };
}

export function getJoinErrorMessage(err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const normalizedMessage = errorMessage.toLowerCase();
  const colyseusErr = err as { code?: number };

  if (
    colyseusErr.code === 1 ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("no such room")
  ) {
    return "Room not found. Check the invite code and try again.";
  }

  if (colyseusErr.code === 2 || normalizedMessage.includes("full")) {
    return "Room is full. The table already has the maximum number of players.";
  }

  if (
    colyseusErr.code === 3 ||
    normalizedMessage.includes("password") ||
    normalizedMessage.includes("invalid")
  ) {
    return "Wrong password. Please check the room password and try again.";
  }

  if (
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("econnrefused") ||
    normalizedMessage.includes("websocket")
  ) {
    return "Server unreachable. Make sure the game server is running.";
  }

  return `Could not join the room: ${errorMessage}`;
}

export function isNormalCloseCode(code: number) {
  return code === 1000 || code === 1001;
}

export interface RoomActionError {
  message?: unknown;
  code?: unknown;
}

export interface RoomActionToast {
  message: string;
  kind: Toast["kind"];
}

export function getRoomCommandFailureToast(): RoomActionToast {
  return {
    message: "Could not send that action. Check your connection.",
    kind: "warning",
  };
}

export function getRoomActionToast(error: RoomActionError): RoomActionToast {
  const message = typeof error.message === "string" ? error.message : "Action failed";
  const code = typeof error.code === "string" ? error.code : "";

  switch (code) {
    case "RATE_LIMITED":
      return { message: "You're tapping too fast. Try again in a moment.", kind: "warning" };
    case "NOT_YOUR_TURN":
      return { message: "It's not your turn yet.", kind: "warning" };
    case "GAME_FINISHED":
      return { message: "This round is already finished.", kind: "info" };
    case "INVALID_COLOR":
      return { message: "That color isn't valid.", kind: "warning" };
    case "CARD_NOT_FOUND":
      return { message: "That card is no longer available.", kind: "warning" };
    case "CANNOT_PLAY":
      return { message: "That card can't be played right now.", kind: "warning" };
    case "WILDDRAW4_VIOLATION":
      return { message: "Wild Draw 4 is blocked because you have a matching card.", kind: "warning" };
    case "INTERNAL_ERROR":
      return { message: "Something went wrong. Try again.", kind: "error" };
    default:
      return { message, kind: "warning" };
  }
}

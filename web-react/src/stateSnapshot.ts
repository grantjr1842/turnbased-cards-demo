import type { CardSchema, ChatMessageSchema, PlayerSchema, UnoState } from "./gameTypes";

export function schemaValues<T>(raw: unknown): T[] {
  if (!raw) return [];
  const maybeCollection = raw as {
    forEach?: (cb: (value: T) => void) => void;
    values?: () => IterableIterator<T>;
  };

  if (typeof maybeCollection.forEach === "function") {
    const collected: T[] = [];
    maybeCollection.forEach((value: T) => collected.push(value));
    return collected;
  }

  if (typeof maybeCollection.values === "function") {
    return Array.from(maybeCollection.values());
  }

  if (Array.isArray(raw)) return raw as T[];

  return Object.values(raw as Record<string, T>).filter(
    (value): value is T => value !== undefined && value !== null,
  );
}

export function snapshotState(next: UnoState): UnoState {
  // Colyseus hands us MapSchemas for players, chatMessages, and rematchVotes.
  // Snapshotting into plain objects/arrays keeps React state referentially
  // stable across re-renders that didn't actually change anything, and lets
  // downstream callers treat the result like a JSON object.
  //
  // Players are keyed by seat index so the snapshot shape stays compatible
  // with statePlayers() — it can iterate either a Map or a record without a
  // special branch in the consumers.
  const rawPlayers = schemaValues<PlayerSchema>(next.players);
  const playersRecord: Record<string, PlayerSchema> = {};
  for (const player of rawPlayers) {
    // Clone each player into a plain object with a plain-array hand.
    // Colyseus mutates the live ArraySchema in place (push/splice) without
    // changing its reference, so a snapshot that keeps the live hand would
    // defeat downstream useMemo([hand]) comparisons and render stale cards
    // after a draw/play. Plain-array hands give consumers a referentially
    // fresh, immutable copy on every server update while staying cheap
    // (this only runs on state change, not on local re-renders).
    playersRecord[String(player.seatIndex)] = {
      sessionId: player.sessionId,
      seatIndex: player.seatIndex,
      name: player.name,
      isBot: player.isBot,
      connected: player.connected,
      hand: schemaValues<CardSchema>(player.hand),
      handCount: player.handCount,
    };
  }

  return {
    players: playersRecord,
    discardPile: schemaValues<CardSchema>(next.discardPile),
    drawPileCount: next.drawPileCount,
    deckCount: next.deckCount,
    currentPlayer: next.currentPlayer,
    direction: next.direction,
    activeColor: next.activeColor,
    pendingDraw: next.pendingDraw,
    winner: next.winner,
    phase: next.phase,
    spectatorCount: next.spectatorCount,
    chatMessages: schemaValues<ChatMessageSchema>(next.chatMessages),
    unoCaller: next.unoCaller,
    rematchVotes: schemaValues<number>(next.rematchVotes),
    turnDeadline: next.turnDeadline,
  };
}

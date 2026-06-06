import { Room, Client } from "@colyseus/core";
import { StateView, ArraySchema } from "@colyseus/schema";
import {
  UnoRoomState,
  PlayerSchema,
  UnoCardSchema,
  ChatMessageSchema,
} from "./schema/UnoRoomState.ts";
import { AVATAR_SYMBOLS_BY_ID, AVATAR_THEMES_BY_ID } from "@repo/shared/avatar";
import {
  ACTION_COOLDOWN_MS,
  BOT_TURN_DELAY_MS,
  HAND_SIZE,
  HUMAN_TURN_TIMEOUT_MS,
  NUM_PLAYERS,
  UnoCard,
  UnoColor,
  canPlaySchema,
  createUnoDeck,
  getPlayableCardIndices,
  hasWildDrawFourAlternative,
  pickBestCardSchema,
  pickBestColorSchema,
  recycleDiscardPile,
  schemaCardToUnoCard,
  shuffleDeck,
  writeSchemaCardFields,
} from "@repo/server-game";
import { logger } from "../logger.ts";
import DOMPurify from "dompurify";

const VALID_COLORS: readonly UnoColor[] = ["red", "blue", "green", "yellow"];
const DEFAULT_HUMAN_TURN_TIMEOUT = HUMAN_TURN_TIMEOUT_MS;
const DEFAULT_BOT_TURN_DELAY = BOT_TURN_DELAY_MS;

function parsePositiveDelay(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeText(value: string): string {
  return typeof DOMPurify.sanitize === "function" ? DOMPurify.sanitize(value) : value;
}

type RoomState = InstanceType<typeof UnoRoomState>;
type PlayerInstance = InstanceType<typeof PlayerSchema>;
type CardInstance = InstanceType<typeof UnoCardSchema>;

export class UnoRoom extends Room<{ state: RoomState }> {
  private drawPile: UnoCard[] = [];
  private turnTimeout?: ReturnType<typeof setTimeout>;
  /** Seats that were handed to a bot because the current player disconnected. */
  private seatsHandedToBot = new Set<number>();
  /** Pending botTurn timeouts keyed by seatIndex — used to cancel on rejoin. */
  private turnCallbacks = new Map<number, ReturnType<typeof setTimeout>>();
  /** Connected human clients keyed by sessionId for O(1) lookup. */
  private clientsBySessionId = new Map<string, Client>();
  /** Players keyed by sessionId for O(1) lookup. */
  private playersBySessionId = new Map<string, PlayerInstance>();
  /** Clients watching as spectators (no seat). */
  private spectators = new Set<Client>();
  /** Guard flag: prevents botTurn from firing during an active human turn action. */
  private turnActionActive = false;
  /** Rate limiting: sessionId → timestamp of last game action (ms). */
  private lastActionTime = new Map<string, number>();
  /** Rematch votes keyed by seat index for O(1) membership checks. */
  private rematchVoteSeats = new Set<number>();
  /** Bot difficulty: "easy" | "medium" | "hard" */
  private difficulty: "easy" | "medium" | "hard" = "medium";
  /** Optional room password. */
  private password?: string;
  /** Card counting: tracks how many cards of each color/value have been discarded */
  private discardedCounts: Record<string, number> = {};
  /** Monotonic chat message sequence for unique message ids. */
  private chatMessageSeq = 0;

  onCreate(options: { private?: boolean; difficulty?: string; password?: string } = {}) {
    try {
      // Spectators don't count toward maxClients — they can always join
      this.maxClients = 256;
      if (options.private) this.setPrivate();
      if (
        options.password &&
        typeof options.password === "string" &&
        options.password.length <= 32
      ) {
        this.password = options.password;
      }
      if (options.difficulty === "easy" || options.difficulty === "hard") {
        this.difficulty = options.difficulty;
      }
      this.setState(new UnoRoomState());

      this.state.phase = "waiting";
      this.state.winner = -1;
      this.state.direction = 1;
      this.state.spectatorCount = 0;
      this.state.chatMessages = new ArraySchema();
      this.chatMessageSeq = 0;
      this.state.unoCaller = -1;
      this.state.rematchVotes = new ArraySchema();

      // Fill all seats with bots
      for (let i = 0; i < NUM_PLAYERS; i++) {
        const player = new PlayerSchema();
        player.sessionId = `bot-${i}`;
        player.seatIndex = i;
        player.name = `Bot ${i + 1}`;
        player.isBot = true;
        player.connected = false;
        player.handCount = 0;
        this.state.players.set(String(i), player);
        this.playersBySessionId.set(player.sessionId, player);
      }

      // Deal and start
      this.dealGame();
      this.state.phase = "playing";
      this.scheduleTurn();

      logger.info("UnoRoom", "Game started", { roomId: this.roomId });

      // Message handlers
      this.onMessage(
        "play_card",
        (client: Client, message: { cardId: string; chosenColor?: string }) => {
          this.handlePlayCard(client, message);
        },
      );

      this.onMessage("draw_card", (client: Client) => {
        this.handleDrawCard(client);
      });

      this.onMessage("restart", (client: Client) => {
        this.handleRestart(client);
      });

      this.onMessage("chat", (client: Client, message: { text?: unknown }) => {
        this.handleChat(client, message);
      });

      this.onMessage("uno", (client: Client) => {
        this.handleUno(client);
      });

      this.onMessage("vote_rematch", (client: Client) => {
        this.handleVoteRematch(client);
      });

      this.onMessage("ping", (client: Client) => {
        client.send("pong");
      });
    } catch (err) {
      logger.error("UnoRoom", "onCreate failed", { error: String(err) });
      throw err;
    }
  }

  onJoin(client: Client, options: { name?: string; spectator?: boolean; password?: string }) {
    try {
      // Validate password first
      if (this.password && options?.password !== this.password) {
        throw new Error("Invalid password");
      }

      // Spectator join — watch without taking a seat
      if (options?.spectator) {
        this.spectators.add(client);
        this.state.spectatorCount = this.spectators.size;
        logger.info("UnoRoom", "Spectator joined", { sessionId: client.sessionId });
        return;
      }

      // Find a bot seat to replace
      const botPlayer = this.findBotSeat();
      if (!botPlayer) return;

      const takingAbandonedSeat = this.seatsHandedToBot.has(botPlayer.seatIndex);
      if (takingAbandonedSeat) {
        this.seatsHandedToBot.delete(botPlayer.seatIndex);
        // Cancel any pending botTurn for this seat (player beat the timer)
        const pending = this.turnCallbacks.get(botPlayer.seatIndex);
        if (pending !== undefined) {
          clearTimeout(pending);
          this.turnCallbacks.delete(botPlayer.seatIndex);
        }
      }

      // Replace bot with human (keep hand intact)
      this.playersBySessionId.delete(botPlayer.sessionId);
      botPlayer.sessionId = client.sessionId;

      let name = "Player";
      if (typeof options?.name === "string") {
        const trimmed = options.name.trim();
        const sanitized = sanitizeText(trimmed).trim();
        const match = sanitized.match(/^\[av-([a-z0-9]+)-([a-z0-9]+)\](.*)$/);
        if (match) {
          const symbol = match[1];
          const theme = match[2];
          const actualName = match[3].trim();
          const validSymbol = AVATAR_SYMBOLS_BY_ID.has(symbol);
          const validTheme = AVATAR_THEMES_BY_ID.has(theme);
          if (validSymbol && validTheme && actualName.length >= 2 && actualName.length <= 16) {
            name = sanitized;
          }
        } else if (sanitized.length >= 2 && sanitized.length <= 16) {
          name = sanitized;
        }
      }
      botPlayer.name = sanitizeText(name);
      botPlayer.isBot = false;
      botPlayer.connected = true;
      this.playersBySessionId.set(client.sessionId, botPlayer);
      this.clientsBySessionId.set(client.sessionId, client);

      // Set up StateView — player can see their own hand
      client.view = new StateView();
      client.view.add(botPlayer);

      // If all seats are human, lock (spectators don't count toward locking)
      let allHuman = true;
      this.state.players.forEach((p: PlayerInstance) => {
        if (p.isBot) allHuman = false;
      });
      if (allHuman) this.lock();

      // Only schedule a turn if a NEW player is taking over a seat that was
      // abandoned by the current player. A player returning to their own seat
      // (takingAbandonedSeat=true but botPlayer is already the current player)
      // should NOT reset the deadline — their turn continues as-is.
      // Additionally, if anyone takes over the current active turn seat, reset
      // the timer to the human turn duration so they have full time to act.
      if (botPlayer.seatIndex === this.state.currentPlayer) {
        this.scheduleTurn();
      } else if (takingAbandonedSeat && botPlayer.seatIndex !== this.state.currentPlayer) {
        this.scheduleTurn();
      }

      logger.info("UnoRoom", "Player joined", {
        sessionId: client.sessionId,
        seatIndex: botPlayer.seatIndex,
        name: botPlayer.name,
        takingAbandonedSeat,
      });
    } catch (err) {
      logger.error("UnoRoom", "onJoin failed", { error: String(err) });
      throw err;
    }
  }

  async onLeave(client: Client) {
    try {
      // Handle spectator leaving
      if (this.spectators.has(client)) {
        this.spectators.delete(client);
        this.state.spectatorCount = this.spectators.size;
        logger.info("UnoRoom", "Spectator left", { sessionId: client.sessionId });
        return;
      }

      this.clientsBySessionId.delete(client.sessionId);
      const player = this.playersBySessionId.get(client.sessionId);
      if (!player) return;

      const wasCurrentPlayer = this.state.currentPlayer === player.seatIndex;

      // Convert back to bot
      this.playersBySessionId.delete(client.sessionId);
      player.sessionId = `bot-${player.seatIndex}`;
      player.name = `Bot ${player.seatIndex + 1}`;
      player.isBot = true;
      player.connected = false;
      this.playersBySessionId.set(player.sessionId, player);

      // Unlock so others can join
      this.unlock();

      // If it was this player's turn, mark the seat as handed-to-bot so
      // onJoin can distinguish a returning player from a new takeover.
      if (wasCurrentPlayer) {
        this.seatsHandedToBot.add(player.seatIndex);
        this.scheduleTurn();
        // Store timeout so it can be cancelled if the player rejoins before it fires
        if (this.turnTimeout !== undefined) {
          this.turnCallbacks.set(player.seatIndex, this.turnTimeout);
        }
      }

      // Clean up StateView to prevent memory leaks
      client.view = undefined;

      logger.info("UnoRoom", "Player left", {
        sessionId: client.sessionId,
        seatIndex: player.seatIndex,
        wasCurrentPlayer,
      });
    } catch (err) {
      logger.error("UnoRoom", "onLeave failed", { error: String(err) });
    }
  }

  onDispose() {
    this.resetTurnBookkeeping();
    this.resetPlayerLookupCaches();
  }

  // ── Helpers ───────────────────────────────────────────────────

  /** Returns true if the client should be rate-limited. Updates last-action time. */
  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const last = this.lastActionTime.get(sessionId) ?? 0;
    if (now - last < ACTION_COOLDOWN_MS) return true;
    this.lastActionTime.set(sessionId, now);
    return false;
  }

  private findBotSeat(): PlayerInstance | null {
    let found: PlayerInstance | null = null;
    this.state.players.forEach((player: PlayerInstance) => {
      if (player.isBot && found === null) found = player;
    });
    return found;
  }

  private findPlayerBySession(sessionId: string): PlayerInstance | null {
    const cached = this.playersBySessionId.get(sessionId);
    if (cached) return cached;

    let found: PlayerInstance | null = null;
    this.state.players.forEach((player: PlayerInstance) => {
      if (player.sessionId === sessionId) found = player;
    });
    if (found) {
      this.playersBySessionId.set(sessionId, found);
    }
    return found;
  }

  private getPlayerBySeat(seatIndex: number): PlayerInstance {
    return this.state.players.get(String(seatIndex))!;
  }

  private nextPlayer(skip = 0): number {
    let p = this.state.currentPlayer;
    for (let i = 0; i <= skip; i++) {
      p = (((p + this.state.direction) % NUM_PLAYERS) + NUM_PLAYERS) % NUM_PLAYERS;
    }
    return p;
  }

  private clearTurnTimeout() {
    clearTimeout(this.turnTimeout);
    this.turnTimeout = undefined;
    this.state.turnDeadline = 0;
  }

  private resetTurnBookkeeping() {
    this.clearTurnTimeout();
    for (const timeout of this.turnCallbacks.values()) {
      clearTimeout(timeout);
    }
    this.turnCallbacks.clear();
    this.lastActionTime.clear();
    this.seatsHandedToBot.clear();
    this.clearRematchVotes();
  }

  private resetPlayerLookupCaches() {
    this.clientsBySessionId.clear();
    this.playersBySessionId.clear();
  }

  private clearRematchVotes() {
    this.state.rematchVotes.splice(0, this.state.rematchVotes.length);
    this.rematchVoteSeats.clear();
  }

  private getConnectedHumanSeats(): number[] {
    const connectedHumanSeats: number[] = [];
    this.state.players.forEach((player: PlayerInstance) => {
      if (!player.isBot && player.connected) {
        connectedHumanSeats.push(player.seatIndex);
      }
    });
    return connectedHumanSeats;
  }

  private getPlayableCardIndicesForPlayer(player: PlayerInstance): number[] {
    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    if (!topDiscard) return [];

    return getPlayableCardIndices(
      player.hand,
      topDiscard,
      this.state.activeColor as UnoColor,
      this.state.pendingDraw,
      canPlaySchema,
      hasWildDrawFourAlternative,
    );
  }

  /** Find the Client for a human player (by sessionId). */
  private getClientForPlayer(player: PlayerInstance): Client | undefined {
    if (player.isBot) return undefined;
    return this.clientsBySessionId.get(player.sessionId);
  }

  /**
   * Push a card to a player's hand AND register it with the client's
   * StateView so it stays visible. Without this, new Schema instances
   * added to a `view: true` array after the initial view.add() are
   * invisible to the client.
   */
  private pushCardToHand(player: PlayerInstance, card: UnoCard) {
    const schemaCard = this.createCardSchema(card);
    player.hand.push(schemaCard);

    const client = this.getClientForPlayer(player);
    if (client?.view) {
      client.view.add(schemaCard);
    }
  }

  private createCardSchema(card: UnoCard): CardInstance {
    const c = new UnoCardSchema();
    return writeSchemaCardFields(c, card);
  }

  // ── Game Logic ────────────────────────────────────────────────

  private dealGame() {
    const deck = shuffleDeck(createUnoDeck());

    let idx = 0;
    for (let c = 0; c < HAND_SIZE; c++) {
      for (let p = 0; p < NUM_PLAYERS; p++) {
        const player = this.getPlayerBySeat(p);
        this.pushCardToHand(player, deck[idx++]);
      }
    }

    // Update hand counts
    for (let p = 0; p < NUM_PLAYERS; p++) {
      const player = this.getPlayerBySeat(p);
      player.handCount = player.hand.length;
    }

    // Find first non-wild card for discard pile
    let startIdx = idx;
    while (startIdx < deck.length && deck[startIdx].type === "wild") startIdx++;
    if (startIdx >= deck.length) startIdx = idx;

    const firstCard = deck[startIdx];
    const remaining = [...deck.slice(idx, startIdx), ...deck.slice(startIdx + 1)];

    this.state.discardPile.push(this.createCardSchema(firstCard));

    // Server-only draw pile
    this.drawPile = remaining;
    this.state.drawPileCount = this.drawPile.length;

    // Active color
    this.state.activeColor = firstCard.type === "color" ? firstCard.color : "red";

    // First card effects
    let currentPlayer = 0;
    let direction = 1;

    if (firstCard.type === "color") {
      if (firstCard.value === "skip") {
        currentPlayer = 1;
      } else if (firstCard.value === "reverse") {
        direction = -1;
        currentPlayer = NUM_PLAYERS - 1;
      }
    }

    this.state.currentPlayer = currentPlayer;
    this.state.direction = direction;
    this.state.pendingDraw = firstCard.type === "color" && firstCard.value === "draw2" ? 2 : 0;
    this.state.winner = -1;
  }

  private scheduleTurn() {
    this.clearTurnTimeout();

    if (this.state.phase !== "playing" || this.state.winner !== -1) return;

    const seatIndex = this.state.currentPlayer;
    const player = this.getPlayerBySeat(seatIndex);
    const timeout = parsePositiveDelay(process.env.HUMAN_TURN_TIMEOUT, DEFAULT_HUMAN_TURN_TIMEOUT);
    const botDelay = parsePositiveDelay(process.env.BOT_TURN_DELAY, DEFAULT_BOT_TURN_DELAY);
    const delay = player.isBot ? botDelay : timeout;

    this.state.turnDeadline = Date.now() + delay;

    this.turnTimeout = setTimeout(() => {
      this.clearTurnTimeout();
      this.turnCallbacks.delete(seatIndex);
      try {
        this.botTurn();
      } catch (err) {
        logger.error("UnoRoom", "botTurn failed", { error: String(err) });
      }
    }, delay);
  }

  private recycleDiscardIfNeeded() {
    const recycled = recycleDiscardPile(this.drawPile, this.state.discardPile, (card) =>
      schemaCardToUnoCard(card),
    );
    if (!recycled) return;
    this.drawPile = recycled;
    this.state.drawPileCount = this.drawPile.length;
  }

  private drawCards(player: PlayerInstance, count: number) {
    for (let i = 0; i < count; i++) {
      this.recycleDiscardIfNeeded();
      if (this.drawPile.length === 0) break;

      const card = this.drawPile.pop()!;
      this.pushCardToHand(player, card);
    }
    player.handCount = player.hand.length;
    this.state.drawPileCount = this.drawPile.length;

    // If the player drew cards and hand size is now > 1, they no longer need to call UNO.
    if (player.hand.length > 1 && this.state.unoCaller === player.seatIndex) {
      this.state.unoCaller = -1;
    }
  }

  private executePlayCard(player: PlayerInstance, cardIndex: number, chosenColor?: UnoColor) {
    this.turnActionActive = true;
    try {
      const card = player.hand[cardIndex];

      // Clone card data for discard pile
      const discardCard = new UnoCardSchema();
      discardCard.id = card.id;
      discardCard.cardType = card.cardType;
      discardCard.color = card.color;
      discardCard.value = card.value;

      // Set chosen color for wild cards
      if (discardCard.cardType === "wild") {
        discardCard.chosenColor = chosenColor || "red";
        this.state.activeColor = discardCard.chosenColor;
      } else {
        discardCard.chosenColor = "";
        this.state.activeColor = discardCard.color;
      }

      // Remove from hand
      const wasUnoCaller = this.state.unoCaller === player.seatIndex;
      player.hand.splice(cardIndex, 1);
      player.handCount = player.hand.length;

      // UNO penalty: if this player was supposed to call UNO but didn't
      if (wasUnoCaller) {
        this.drawCards(player, 2);
        this.state.unoCaller = -1;
      }

      // Mark player as needing to call UNO when they reach 1 card
      // Bots auto-call UNO (clear immediately), humans must send "uno" message
      if (player.hand.length === 1) {
        this.state.unoCaller = player.isBot ? -1 : player.seatIndex;
      }

      // Add to discard pile
      this.state.discardPile.push(discardCard);

      // Track discarded cards for card counting (hard difficulty)
      const countKey = discardCard.cardType === "color" ? discardCard.color : discardCard.value;
      this.discardedCounts[countKey] = (this.discardedCounts[countKey] || 0) + 1;

      // Check win
      if (player.hand.length === 0) {
        this.state.winner = player.seatIndex;
        logger.info("UnoRoom", "Game finished", {
          winnerSeat: player.seatIndex,
          winnerName: player.name,
          seatIndex: player.seatIndex,
        });
        this.state.phase = "finished";
        this.clearRematchVotes();
        clearTimeout(this.turnTimeout);
        // Reset flag before the finally runs
        this.turnActionActive = false;
        return;
      }

      this.applyPlayedCardEffects(discardCard);
      this.scheduleTurn();
    } finally {
      this.turnActionActive = false;
    }
  }

  private applyPlayedCardEffects(discardCard: CardInstance) {
    if (discardCard.cardType === "color") {
      switch (discardCard.value) {
        case "reverse":
          this.state.direction = this.state.direction === 1 ? -1 : 1;
          this.state.currentPlayer = this.nextPlayer();
          break;
        case "skip":
          this.state.currentPlayer = this.nextPlayer(1);
          break;
        case "draw2":
          this.state.pendingDraw += 2;
          this.state.currentPlayer = this.nextPlayer();
          break;
        default:
          this.state.currentPlayer = this.nextPlayer();
      }
      return;
    }

    if (discardCard.value === "wild_draw4") {
      this.state.pendingDraw += 4;
    }
    this.state.currentPlayer = this.nextPlayer();
  }

  private botTurn() {
    if (this.state.phase !== "playing" || this.state.winner !== -1) return;
    // Guard: if a human turn action is in progress, abort this scheduled call.
    if (this.turnActionActive) return;

    const player = this.getPlayerBySeat(this.state.currentPlayer);

    // Must draw if pending
    if (this.state.pendingDraw > 0) {
      this.drawCards(player, this.state.pendingDraw);
      this.state.pendingDraw = 0;
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
      return;
    }

    // Find playable cards
    const playable = this.getPlayableCardIndicesForPlayer(player);

    if (playable.length === 0) {
      // Draw 1 card, skip turn
      this.drawCards(player, 1);
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
      return;
    }

    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    if (!topDiscard) return;

    // Pick card based on difficulty
    let cardIndex: number;
    if (this.difficulty === "easy") {
      // Random playable card
      cardIndex = playable[Math.floor(Math.random() * playable.length)];
    } else {
      // Medium / Hard: strategic card selection
      cardIndex = pickBestCardSchema(playable, player.hand, this.state.activeColor as UnoColor);
    }
    const card = player.hand[cardIndex];

    // Choose color for wild cards
    let chosenColor: UnoColor | undefined;
    if (card.cardType === "wild") {
      if (this.difficulty === "easy") {
        const colors: UnoColor[] = ["red", "blue", "green", "yellow"];
        chosenColor = colors[Math.floor(Math.random() * colors.length)];
      } else {
        // Medium and hard use strategic selection; hard additionally considers card depletion
        chosenColor = pickBestColorSchema(
          player.hand,
          topDiscard.cardType === "color" ? topDiscard.value : undefined,
          this.difficulty === "hard" ? this.discardedCounts : undefined,
        );
      }
    }

    this.executePlayCard(player, cardIndex, chosenColor);
  }

  // ── Message Handlers ──────────────────────────────────────────

  private handlePlayCard(client: Client, message: { cardId: string; chosenColor?: string }) {
    try {
      const { cardId, chosenColor } = message;

      // Input validation
      if (typeof cardId !== "string" || cardId.length > 64) return;

      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      // Rate limit
      if (this.checkRateLimit(client.sessionId)) {
        client.send("error", { message: "Rate limited", code: "RATE_LIMITED" });
        return;
      }

      // Validate turn
      if (this.state.currentPlayer !== player.seatIndex) {
        client.send("error", { message: "Not your turn", code: "NOT_YOUR_TURN" });
        return;
      }
      if (this.state.winner !== -1) {
        client.send("error", { message: "Game is finished", code: "GAME_FINISHED" });
        return;
      }

      // Validate chosenColor
      if (chosenColor !== undefined && !VALID_COLORS.includes(chosenColor as UnoColor)) {
        client.send("error", { message: "Invalid color", code: "INVALID_COLOR" });
        return;
      }

      // Find card in hand
      let cardIndex = -1;
      for (let i = 0; i < player.hand.length; i++) {
        if (player.hand[i].id === cardId) {
          cardIndex = i;
          break;
        }
      }
      if (cardIndex === -1) {
        client.send("error", { message: "Card not found in hand", code: "CARD_NOT_FOUND" });
        return;
      }

      const card = player.hand[cardIndex];
      const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
      if (!topDiscard) {
        client.send("error", { message: "Card cannot be played", code: "CANNOT_PLAY" });
        return;
      }
      if (!canPlaySchema(card, topDiscard, this.state.activeColor, this.state.pendingDraw)) {
        client.send("error", { message: "Card cannot be played", code: "CANNOT_PLAY" });
        return;
      }
      if (card.cardType === "wild" && card.value === "wild_draw4" && this.state.pendingDraw === 0) {
        if (hasWildDrawFourAlternative(player.hand, topDiscard, this.state.activeColor)) {
          client.send("error", {
            message: "Cannot play Wild Draw 4 — you have a valid alternative",
            code: "WILDDRAW4_VIOLATION",
          });
          return;
        }
      }

      this.executePlayCard(player, cardIndex, chosenColor as UnoColor | undefined);
    } catch (err) {
      logger.error("UnoRoom", "handlePlayCard failed", { error: String(err) });
      client.send("error", { message: "Internal error", code: "INTERNAL_ERROR" });
    }
  }

  private handleDrawCard(client: Client) {
    try {
      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      // Rate limit
      if (this.checkRateLimit(client.sessionId)) {
        client.send("error", { message: "Rate limited", code: "RATE_LIMITED" });
        return;
      }

      if (this.state.currentPlayer !== player.seatIndex) {
        client.send("error", { message: "Not your turn", code: "NOT_YOUR_TURN" });
        return;
      }
      if (this.state.winner !== -1) {
        client.send("error", { message: "Game is finished", code: "GAME_FINISHED" });
        return;
      }

      const count = this.state.pendingDraw > 0 ? this.state.pendingDraw : 1;
      this.drawCards(player, count);
      this.state.pendingDraw = 0;
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
    } catch (err) {
      logger.error("UnoRoom", "handleDrawCard failed", { error: String(err) });
      client.send("error", { message: "Internal error", code: "INTERNAL_ERROR" });
    }
  }

  private handleRestart(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    // Only allow restart when game is finished, or during play if all bots (dev mode)
    if (this.state.phase !== "finished") {
      if (this.getConnectedHumanSeats().length > 0) return;
    }

    this.resetTurnBookkeeping();

    // Clear all hands and discard pile
    this.state.players.forEach((player: PlayerInstance) => {
      player.hand.splice(0, player.hand.length);
      player.handCount = 0;
    });
    this.state.discardPile.splice(0, this.state.discardPile.length);
    this.discardedCounts = {};
    this.state.unoCaller = -1;
    // Re-deal
    this.dealGame();
    this.state.phase = "playing";
    this.scheduleTurn();
  }

  private handleChat(client: Client, message: { text?: unknown }) {
    let senderName = "";
    const player = this.findPlayerBySession(client.sessionId);
    if (player) {
      senderName = player.name;
    } else if (this.spectators.has(client)) {
      senderName = `Spectator (${client.sessionId.slice(0, 4)})`;
    } else {
      return;
    }

    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!text || text.length > 200) return;
    const chatMsg = new ChatMessageSchema();
    chatMsg.id = `${Date.now()}-${this.chatMessageSeq++}`;
    chatMsg.sender = sanitizeText(senderName);
    chatMsg.text = sanitizeText(text);
    chatMsg.timestamp = Date.now();
    this.state.chatMessages.push(chatMsg);
    // Keep last 50 messages
    if (this.state.chatMessages.length > 50) {
      this.state.chatMessages.splice(0, this.state.chatMessages.length - 50);
    }
  }

  private handleUno(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    // Only the player who must call UNO can do so
    if (this.state.unoCaller === player.seatIndex) {
      this.state.unoCaller = -1;
    }
  }

  private handleVoteRematch(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    if (this.state.phase !== "finished") return;
    if (player.isBot) return;
    if (!player.connected) return;

    // Add vote if not already present
    this.addRematchVote(player.seatIndex);

    // Check if all connected humans have voted
    const connectedHumanSeats = this.getConnectedHumanSeats();
    const allVoted =
      connectedHumanSeats.length > 0 &&
      connectedHumanSeats.every((seat) => this.hasRematchVote(seat));

    if (allVoted) {
      this.clearRematchVotes();
      this.handleRestart(client);
    }
  }

  private hasRematchVote(seatIndex: number): boolean {
    const voted = this.state.rematchVotes.includes(seatIndex);
    if (voted) {
      this.rematchVoteSeats.add(seatIndex);
    } else {
      this.rematchVoteSeats.delete(seatIndex);
    }
    return voted;
  }

  private addRematchVote(seatIndex: number): void {
    if (this.hasRematchVote(seatIndex)) return;
    this.rematchVoteSeats.add(seatIndex);
    this.state.rematchVotes.push(seatIndex);
  }
}

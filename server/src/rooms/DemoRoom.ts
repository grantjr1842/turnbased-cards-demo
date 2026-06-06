import { Room, Client } from "colyseus";
import { ArraySchema } from "@colyseus/schema";
import {
  DemoState,
  DemoCardSchema,
  DemoPlayerSchema,
  DemoPlaybackSchema,
  TurnHistoryEntrySchema,
} from "./schema/DemoState.ts";
import {
  HAND_SIZE,
  NUM_PLAYERS,
  UnoCard,
  UnoColor,
  canPlay,
  createUnoDeck,
  getPlayableCards,
  pickBestCard,
  pickBestColor,
  recycleDiscardPile,
  shuffleDeck,
  writeSchemaCardFields,
} from "@repo/server-game";
import { logger } from "../logger.ts";

export class DemoRoom extends Room<{ state: InstanceType<typeof DemoState> }> {
  private tickTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private gameStarted = false;
  private currentState!: {
    drawPile: UnoCard[];
    hands: UnoCard[][];
    discardPile: UnoCard[];
    currentPlayer: number;
    direction: 1 | -1;
    activeColor: UnoColor;
    pendingDraw: number;
    winner: number | null;
  };
  private tickMs = 1000;
  private paused = true;

  onCreate(_options: Record<string, unknown> = {}) {
    this.setState(new DemoState());
    this.state.demo = new DemoPlaybackSchema();
    this.state.demo.phase = "idle";
    this.state.demo.tickMs = 1000;
    this.state.demo.turnCount = 0;
    this.state.demo.winner = -1;
    this.state.turnHistory = new ArraySchema();

    // Initialize 4 bot players
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const player = new DemoPlayerSchema();
      player.sessionId = `bot-${i}`;
      player.seatIndex = i;
      player.name = `Bot ${i + 1}`;
      player.isBot = true;
      player.connected = false;
      player.handCount = 0;
      this.state.players.set(String(i), player);
    }

    this.onMessage("start", (_client: Client) => {
      this.startGame();
    });
    this.onMessage("pause", (_client: Client) => {
      this.pauseGame();
    });
    this.onMessage("resume", (_client: Client) => {
      this.resumeGame();
    });
    this.onMessage("step", (_client: Client) => {
      this.stepOnce();
    });
    this.onMessage("set_speed", (_client: Client, message: { tickMs: number }) => {
      this.setTickSpeed(message.tickMs);
    });

    logger.info("DemoRoom", "Created");
  }

  onJoin(client: Client, _options: Record<string, unknown> = {}) {
    // Assign this client as player 0 (local) so Game.tsx renders their hand face-up.
    // All other players are bots shown face-down.
    const localPlayer = this.state.players.get("0");
    if (localPlayer) {
      localPlayer.sessionId = client.sessionId;
      localPlayer.name = "You (Demo)";
      localPlayer.isBot = false;
      localPlayer.connected = true;
    }
    logger.info("DemoRoom", "Client joined", { sessionId: client.sessionId });
  }

  onLeave(client: Client) {
    logger.info("DemoRoom", "Client left", { sessionId: client.sessionId });
  }

  onDispose() {
    this.disposed = true;
    this.gameStarted = false;
    this.clearTickTimer();
  }

  private clearTickTimer() {
    clearTimeout(this.tickTimer);
    this.tickTimer = undefined;
  }

  private setTickSpeed(rawTickMs: unknown) {
    const tickMs = Number(rawTickMs);
    if (!Number.isFinite(tickMs) || tickMs <= 0) return;
    this.tickMs = Math.max(100, Math.min(10000, tickMs));
    this.state.demo.tickMs = this.tickMs;
  }

  private startGame() {
    if (this.disposed) return;
    this.gameStarted = true;
    this.paused = false;
    this.state.demo.phase = "running";
    this.state.demo.turnCount = 0;
    this.state.demo.winner = -1;
    this.state.turnHistory = new ArraySchema();

    // Initialize game state
    const deck = shuffleDeck(createUnoDeck());
    this.currentState = {
      drawPile: [],
      hands: Array.from({ length: NUM_PLAYERS }, () => [] as UnoCard[]),
      discardPile: [],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: null,
    };

    // Deal cards
    let deckIdx = 0;
    for (let c = 0; c < HAND_SIZE; c++) {
      for (let p = 0; p < NUM_PLAYERS; p++) {
        this.currentState.hands[p].push(deck[deckIdx++]);
      }
    }

    // Discard pile
    let startIdx = deckIdx;
    while (startIdx < deck.length && deck[startIdx].type === "wild") startIdx++;
    if (startIdx >= deck.length) startIdx = deckIdx;
    const firstCard = deck[startIdx];
    const remaining = [...deck.slice(deckIdx, startIdx), ...deck.slice(startIdx + 1)];
    this.currentState.drawPile = remaining;

    this.currentState.discardPile.push(firstCard);
    this.currentState.activeColor = firstCard.type === "color" ? firstCard.color : "red";
    this.currentState.direction = 1;
    this.currentState.currentPlayer = 0;
    this.currentState.pendingDraw = 0;
    this.currentState.winner = null;

    if (firstCard.type === "color") {
      if (firstCard.value === "skip") {
        this.currentState.currentPlayer = 1;
      } else if (firstCard.value === "reverse") {
        this.currentState.direction = -1;
        this.currentState.currentPlayer = NUM_PLAYERS - 1;
      }
    }

    // Sync initial state
    this.syncState();
    this.recordHistory(this.currentState.currentPlayer, "start", "", "");
    this.scheduleTick();
    logger.info("DemoRoom", "Game started");
  }

  private pauseGame() {
    if (this.disposed || !this.gameStarted) return;
    this.paused = true;
    this.state.demo.phase = "paused";
    this.clearTickTimer();
  }

  private resumeGame() {
    if (this.disposed || !this.gameStarted || this.currentState.winner !== null) return;
    this.paused = false;
    this.state.demo.phase = "running";
    this.scheduleTick();
  }

  private stepOnce() {
    if (!this.disposed && this.gameStarted && this.paused) {
      this.tick();
    }
  }

  private scheduleTick() {
    if (this.disposed || !this.gameStarted) return;
    this.clearTickTimer();
    this.tickTimer = setTimeout(() => {
      if (!this.disposed && this.gameStarted && !this.paused) {
        this.tick();
        if (!this.disposed && this.gameStarted && !this.paused) this.scheduleTick();
      }
    }, this.tickMs);
  }

  private tick() {
    if (this.disposed || !this.gameStarted) return;
    if (this.currentState.winner !== null) {
      this.finishGame();
      return;
    }

    const player = this.currentState.currentPlayer;

    // Determine action
    if (this.currentState.pendingDraw > 0) {
      // Forced draw
      const count = this.currentState.pendingDraw;
      for (let i = 0; i < count; i++) {
        this.recycleDiscard();
        if (this.currentState.drawPile.length === 0) break;
        this.currentState.hands[player].push(this.currentState.drawPile.pop()!);
      }
      this.currentState.pendingDraw = 0;
      this.advancePlayer();
      this.recordHistory(player, "draw", "", "");
    } else {
      const playable = getPlayableCards(this.currentState, player);
      if (playable.length === 0) {
        // Draw then play if possible, or just draw
        this.recycleDiscard();
        if (this.currentState.drawPile.length === 0) {
          this.advancePlayer();
          this.recordHistory(player, "draw", "", "");
        } else {
          const drawn = this.currentState.drawPile.pop()!;
          this.currentState.hands[player].push(drawn);
          const topCard = this.currentState.discardPile[this.currentState.discardPile.length - 1];
          const canPlayDrawn = topCard
            ? canPlay(drawn, topCard, this.currentState.activeColor, this.currentState.pendingDraw)
            : false;
          if (canPlayDrawn) {
            this.playCard(player, drawn);
            this.recordHistory(player, "play", drawn.id, this.currentState.activeColor);
          } else {
            this.advancePlayer();
            this.recordHistory(player, "draw", drawn.id, "");
          }
        }
      } else {
        // AI plays best card
        const card = pickBestCard(playable, this.currentState.activeColor);
        this.playCard(player, card);
        this.recordHistory(player, "play", card.id, this.currentState.activeColor);
      }
    }

    // Win check
    if (this.currentState.hands[player].length === 0) {
      this.currentState.winner = player;
    }

    this.state.demo.turnCount++;
    this.syncState();

    if (this.currentState.winner !== null) {
      this.finishGame();
    }
  }

  private advancePlayer(skip = 0) {
    let p = this.currentState.currentPlayer;
    for (let i = 0; i <= skip; i++) {
      p = (((p + this.currentState.direction) % NUM_PLAYERS) + NUM_PLAYERS) % NUM_PLAYERS;
    }
    this.currentState.currentPlayer = p;
  }

  private applyCardEffects(card: UnoCard) {
    if (card.type === "color") {
      switch (card.value) {
        case "reverse":
          this.currentState.direction = (this.currentState.direction === 1 ? -1 : 1) as 1 | -1;
          this.advancePlayer();
          break;
        case "skip":
          this.advancePlayer(1);
          break;
        case "draw2":
          this.currentState.pendingDraw += 2;
          this.advancePlayer();
          break;
        default:
          this.advancePlayer();
      }
      return;
    }

    if (card.wildType === "wild_draw4") {
      this.currentState.pendingDraw += 4;
    }
    this.advancePlayer();
  }

  private playCard(player: number, card: UnoCard) {
    const hand = this.currentState.hands[player];
    const handIdx = hand.findIndex((c) => c.id === card.id);
    if (handIdx !== -1) {
      hand.splice(handIdx, 1);
    }

    this.currentState.discardPile.push(card);
    this.currentState.activeColor =
      card.type === "wild" ? pickBestColor(this.currentState.hands[player]) : card.color;
    this.applyCardEffects(card);
  }

  private recycleDiscard() {
    const recycled = recycleDiscardPile(
      this.currentState.drawPile,
      this.currentState.discardPile,
      (card) => card,
    );
    if (recycled) {
      this.currentState.drawPile = recycled;
    }
  }

  private toCardSchema(card: UnoCard) {
    const sc = new DemoCardSchema();
    return writeSchemaCardFields(sc, card);
  }

  private syncState() {
    // Sync players
    for (let p = 0; p < NUM_PLAYERS; p++) {
      const player = this.state.players.get(String(p));
      if (!player) continue;
      player.handCount = this.currentState.hands[p].length;

      // Sync hand array for player 0 (local) — Game.tsx needs this for face-up rendering
      if (p === 0) {
        player.hand = new ArraySchema();
        for (const card of this.currentState.hands[p]) {
          player.hand.push(this.toCardSchema(card));
        }
      }
    }

    // Sync discard pile
    this.state.discardPile = new ArraySchema();
    for (const card of this.currentState.discardPile) {
      this.state.discardPile.push(this.toCardSchema(card));
    }

    this.state.drawPileCount = this.currentState.drawPile.length;
    this.state.currentPlayer = this.currentState.currentPlayer;
    this.state.direction = this.currentState.direction;
    this.state.activeColor = this.currentState.activeColor;
    this.state.pendingDraw = this.currentState.pendingDraw;
    this.state.winner = this.currentState.winner ?? -1;
    this.state.demo.winner = this.currentState.winner ?? -1;
  }

  private recordHistory(player: number, action: string, cardId: string, chosenColor: string) {
    const entry = new TurnHistoryEntrySchema();
    entry.turn = this.state.demo.turnCount;
    entry.player = player;
    entry.action = action;
    entry.cardId = cardId;
    entry.chosenColor = chosenColor;
    entry.timestamp = Date.now();
    entry.handCounts = new ArraySchema();
    for (let p = 0; p < NUM_PLAYERS; p++) {
      entry.handCounts.push(this.currentState.hands[p].length);
    }
    this.state.turnHistory.push(entry);

    // Keep history bounded
    if (this.state.turnHistory.length > 500) {
      this.state.turnHistory.shift();
    }
  }

  private finishGame() {
    if (this.disposed || !this.gameStarted) return;
    this.paused = true;
    this.state.demo.phase = "finished";
    this.state.demo.winner = this.currentState.winner ?? -1;
    this.recordHistory(
      this.currentState.winner ?? -1,
      `win:${this.currentState.winner ?? -1}`,
      "",
      "",
    );
    this.clearTickTimer();
    logger.info("DemoRoom", "Game finished", { winner: this.currentState.winner });
  }
}

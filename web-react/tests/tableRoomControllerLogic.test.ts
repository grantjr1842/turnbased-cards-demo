import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiscardPlayPresentation,
  buildDrawDiffPresentations,
} from "../src/components/tableRoomActionPresentations.ts";
import { buildBurstParticles, buildCardFlight, buildFlightTrailParticle, buildRadialBurstParticles, getEasedFlightPoint } from "../src/components/tableRoomMotion.ts";
import { buildActionCallout, buildGuidanceState, buildHandInteractionState, getActionCalloutLabel } from "../src/components/tableRoomHand.ts";
import {
  buildMeSummary,
  buildPlayerCardCountSnapshot,
  buildRosterEntries,
  buildTableRoomPlayerState,
  buildTableRoomTurnState,
  buildVisibleBotEmotionState,
  getActivePlayerThemeColor,
  getSpotlightPos,
} from "../src/components/tableRoomPlayers.ts";
import { buildRoundStatusPresentation, buildTurnChangePresentation } from "../src/components/tableRoomRoundPresentations.ts";
import { sortHand } from "../src/components/tableRoomSorting.ts";
import {
  buildDiscardBackdropCards,
  buildChatMessageViews,
  buildRecentChatMessageState,
  HAND_DOCK_ANCHOR_ID,
  RECENT_CHAT_MESSAGE_LIMIT,
  getDeckLayerCount,
  getDiscardCardTransform,
  getPlayerPillAnchorId,
  getPlayerStripPositionClass,
} from "../src/components/tableRoomModel.ts";
import { buildTableRoomSceneState } from "../src/components/tableRoomSceneState.ts";
import { sendTableRoomCommand } from "../src/hooks/tableRoomCommands.ts";
import {
  getDeterministicOffsetX,
  getDeterministicOffsetY,
  getDeterministicRotation,
  getPlayDirection,
} from "../src/gameHelpers.ts";
import type { CardSchema, ChatMessageSchema, PlayerSchema, UnoState } from "../src/gameTypes.ts";
import type { Room } from "@colyseus/sdk";

function card(id: string, cardType: CardSchema["cardType"], color: string, value: string): CardSchema {
  return { id, cardType, color, value };
}

function player(overrides: Partial<PlayerSchema> & Pick<PlayerSchema, "sessionId" | "seatIndex" | "name">): PlayerSchema {
  return {
    isBot: false,
    connected: true,
    handCount: 0,
    ...overrides,
  };
}

test("sortHand keeps wild cards last when sorting by color", () => {
  const hand = [
    card("w4", "wild", "wild", "wild_draw4"),
    card("g9", "color", "green", "9"),
    card("r2", "color", "red", "2"),
    card("y1", "color", "yellow", "1"),
  ];

  const sorted = sortHand(hand, "color");
  assert.deepEqual(sorted.map((c) => c.id), ["r2", "y1", "g9", "w4"]);
});

test("getDeckLayerCount caps the visible deck stack layers", () => {
  assert.equal(getDeckLayerCount(0), 0);
  assert.equal(getDeckLayerCount(1), 1);
  assert.equal(getDeckLayerCount(15), 1);
  assert.equal(getDeckLayerCount(16), 2);
  assert.equal(getDeckLayerCount(105), 7);
});

test("getPlayDirection falls back to clockwise when direction is missing", () => {
  assert.equal(getPlayDirection(null), 1);
  assert.equal(getPlayDirection(undefined), 1);
  assert.equal(getPlayDirection({ direction: -1 }), -1);
});

test("sendTableRoomCommand returns false without a room and forwards commands when connected", () => {
  assert.equal(sendTableRoomCommand(null, "uno"), false);

  const calls: Array<[string, unknown?]> = [];
  const room = {
    send(type: string, payload?: unknown) {
      calls.push([type, payload]);
    },
  } as unknown as Room<UnoState>;

  assert.equal(sendTableRoomCommand(room, "chat", { text: "Hello" }), true);
  assert.equal(sendTableRoomCommand(room, "ping"), true);
  assert.deepEqual(calls, [
    ["chat", { text: "Hello" }],
    ["ping", undefined],
  ]);
});

test("sendTableRoomCommand returns false when room.send throws", () => {
  const room = {
    send() {
      throw new Error("socket closed");
    },
  } as unknown as Room<UnoState>;

  assert.equal(sendTableRoomCommand(room, "uno"), false);
});

test("buildTableRoomSceneState centralizes board and room-derived display state", () => {
  const state = {
    phase: "playing" as const,
    activeColor: "green",
    direction: -1,
    currentPlayer: 2,
    turnDeadline: 1234,
    drawPileCount: 19,
    deckCount: 25,
    discardPile: [card("c1", "color", "red", "2"), card("c2", "color", "green", "7")],
  } as UnoState;

  const viewState = buildTableRoomSceneState({
    room: { roomId: "ROOM42" } as unknown as Room<UnoState>,
    state,
    currentPlayerLabel: "Bot 2",
    activePlayerThemeColor: "#ff0",
    isMyTurn: true,
    spotlightPos: "bottom",
  });

  assert.equal(viewState.roomCode, "ROOM42");
  assert.equal(viewState.tableReady, true);
  assert.equal(viewState.phase, "playing");
  assert.equal(viewState.activeColor, "green");
  assert.equal(viewState.direction, -1);
  assert.equal(viewState.activeSeat, 2);
  assert.equal(viewState.turnDeadline, 1234);
  assert.equal(viewState.deckCount, 19);
  assert.equal(viewState.deckLayerCount, 2);
  assert.equal(viewState.topCardLabel, "green 7");
  assert.equal(viewState.currentPlayerLabel, "Bot 2");
  assert.equal(viewState.activePlayerThemeColor, "#ff0");
  assert.equal(viewState.isMyTurn, true);
  assert.equal(viewState.spotlightPos, "bottom");
  assert.deepEqual(viewState.discardPile.map((c) => c.id), ["c1", "c2"]);
  assert.equal(viewState.topCard?.id, "c2");
});

test("getDiscardCardTransform uses the deterministic discard geometry helpers", () => {
  const index = 5;
  assert.equal(
    getDiscardCardTransform(index),
    `rotate(${getDeterministicRotation(index)}deg) translate(${getDeterministicOffsetX(index)}px, ${getDeterministicOffsetY(index)}px)`,
  );
});

test("buildDiscardBackdropCards returns the visible discard history with style data", () => {
  const pile = [
    card("c0", "color", "red", "1"),
    card("c1", "color", "blue", "2"),
    card("c2", "color", "green", "3"),
    card("c3", "color", "yellow", "4"),
    card("c4", "wild", "wild", "wild"),
  ];

  const backdrop = buildDiscardBackdropCards(pile);
  assert.equal(backdrop.length, 3);
  assert.deepEqual(backdrop.map((entry) => entry.id), ["c1", "c2", "c3"]);
  assert.equal(backdrop[0].card.id, "c1");
  assert.equal(backdrop[1].opacity, 0.65);
  assert.equal(backdrop[2].transform, getDiscardCardTransform(3));
});

test("buildDiscardBackdropCards keeps geometry indices non-negative for short piles", () => {
  const pile = [
    card("c0", "color", "red", "1"),
    card("c1", "color", "blue", "2"),
    card("c2", "color", "green", "3"),
  ];

  const backdrop = buildDiscardBackdropCards(pile);

  assert.deepEqual(
    backdrop.map((entry) => entry.id),
    ["c0", "c1"],
  );
  assert.equal(backdrop[0].transform, getDiscardCardTransform(0));
  assert.equal(backdrop[1].transform, getDiscardCardTransform(1));
});

test("buildChatMessageViews normalizes message sender labels and stable ids", () => {
  const messages: ChatMessageSchema[] = [
    { id: "chat-101", sender: "[av-owl-rose]Rook", text: "Hello", timestamp: 101 },
    { id: "chat-102", sender: "Bot 2", text: "Ping", timestamp: 102 },
  ];

  const views = buildChatMessageViews(messages);

  assert.deepEqual(views, [
    { id: "chat-101", senderName: "Rook", text: "Hello" },
    { id: "chat-102", senderName: "Bot 2", text: "Ping" },
  ]);
});

test("buildChatMessageViews keeps ids unique when messages share sender and timestamp", () => {
  const messages: ChatMessageSchema[] = [
    { id: "chat-a", sender: "Bot 2", text: "First", timestamp: 200 },
    { id: "chat-b", sender: "Bot 2", text: "Second", timestamp: 200 },
  ];

  const views = buildChatMessageViews(messages);

  assert.notEqual(views[0].id, views[1].id);
  assert.deepEqual(
    views.map((view) => view.senderName),
    ["Bot 2", "Bot 2"],
  );
});

test("buildRecentChatMessageState keeps the most recent messages and latest id together", () => {
  const messages: ChatMessageSchema[] = Array.from({ length: RECENT_CHAT_MESSAGE_LIMIT + 1 }, (_, index) => ({
    id: `chat-${index}`,
    sender: index % 2 === 0 ? "Bot 2" : "Bot 3",
    text: `Message ${index}`,
    timestamp: 200 + index,
  }));

  const result = buildRecentChatMessageState(messages);

  assert.equal(result.chatMessageViews.length, RECENT_CHAT_MESSAGE_LIMIT);
  assert.deepEqual(result.chatMessageViews[0], {
    id: "chat-1",
    senderName: "Bot 3",
    text: "Message 1",
  });
  assert.deepEqual(result.chatMessageViews[result.chatMessageViews.length - 1], {
    id: `chat-${RECENT_CHAT_MESSAGE_LIMIT}`,
    senderName: "Bot 2",
    text: `Message ${RECENT_CHAT_MESSAGE_LIMIT}`,
  });
  assert.equal(result.latestChatMessageId, `chat-${RECENT_CHAT_MESSAGE_LIMIT}`);
});

test("getPlayerStripPositionClass maps seats onto the expected layout positions", () => {
  assert.equal(getPlayerStripPositionClass(0, 1), "position-top");
  assert.equal(getPlayerStripPositionClass(0, 2), "position-left");
  assert.equal(getPlayerStripPositionClass(1, 2), "position-right");
  assert.equal(getPlayerStripPositionClass(0, 4), "position-left");
  assert.equal(getPlayerStripPositionClass(1, 4), "position-top");
  assert.equal(getPlayerStripPositionClass(3, 4), "position-right");
});

test("sortHand orders by rank first when sorting by value", () => {
  const hand = [
    card("g9", "color", "green", "9"),
    card("r2", "color", "red", "2"),
    card("y2", "color", "yellow", "2"),
    card("b1", "color", "blue", "1"),
  ];

  const sorted = sortHand(hand, "value");
  assert.deepEqual(sorted.map((c) => c.id), ["b1", "r2", "y2", "g9"]);
});

test("buildRosterEntries marks the active opponent seat", () => {
  const roster = buildRosterEntries(
    [
      player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", handCount: 3, isBot: true }),
      player({ sessionId: "op-2", seatIndex: 2, name: "[av-owl-rose]Rook", handCount: 7 }),
    ],
    2,
  );

  assert.equal(roster.length, 2);
  assert.deepEqual(
    roster.map((entry) => ({ id: entry.sessionId, active: entry.active, count: entry.cardCount })),
    [
      { id: "op-1", active: false, count: 3 },
      { id: "op-2", active: true, count: 7 },
    ],
  );
});

test("buildTableRoomPlayerState splits me, opponents, and connected humans", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me", handCount: 5 }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", handCount: 1, isBot: true }),
    player({ sessionId: "op-2", seatIndex: 2, name: "[av-owl-rose]Rook", handCount: 7, connected: false }),
  ];

  const state = buildTableRoomPlayerState(players, "me");
  assert.equal(state.me?.sessionId, "me");
  assert.deepEqual(
    state.opponentPlayers.map((p) => p.sessionId),
    ["op-1", "op-2"],
  );
  assert.deepEqual(
    state.connectedHumanPlayers.map((p) => p.sessionId),
    ["me"],
  );
  assert.equal(state.opponentSeatIndexBySeat.get(1), 0);
  assert.equal(state.opponentSeatIndexBySeat.get(2), 1);
  assert.equal(state.hasOneCardWarning, true);
});

test("getSpotlightPos matches the active turn location", () => {
  const opponentSeatIndexBySeat = new Map<number, number>([
    [1, 0],
    [2, 1],
    [3, 2],
  ]);

  assert.equal(
    getSpotlightPos({
      isMyTurn: true,
      opponentSeatIndexBySeat,
      currentPlayerSeat: 0,
      opponentSeatCount: 3,
    }),
    "bottom",
  );
  assert.equal(
    getSpotlightPos({
      isMyTurn: false,
      opponentSeatIndexBySeat,
      currentPlayerSeat: 1,
      opponentSeatCount: 3,
    }),
    "left",
  );
  assert.equal(
    getSpotlightPos({
      isMyTurn: false,
      opponentSeatIndexBySeat,
      currentPlayerSeat: 2,
      opponentSeatCount: 3,
    }),
    "top",
  );
});

test("buildTableRoomTurnState derives turn and spotlight metadata", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me" }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", isBot: true }),
    player({ sessionId: "op-2", seatIndex: 2, name: "Bot 3", isBot: true }),
    player({ sessionId: "op-3", seatIndex: 3, name: "Bot 4", isBot: true }),
  ];
  const playersBySeat = new Map(players.map((p) => [p.seatIndex, p] as const));
  const opponentSeatIndexBySeat = new Map<number, number>([
    [1, 0],
    [2, 1],
    [3, 2],
  ]);

  const turn = buildTableRoomTurnState({
    state: { currentPlayer: 2, winner: -1 } as never,
    playersBySeat,
    me: players[0],
    opponentSeatIndexBySeat,
    opponentPlayersCount: 3,
  });

  assert.equal(turn.currentPlayerLabel, "Bot 3");
  assert.equal(turn.activePlayerThemeColor, "hsl(148, 65%, 45%)");
  assert.equal(turn.isMyTurn, false);
  assert.equal(turn.spotlightPos, "top");
});

test("buildTurnChangePresentation exposes banner, skip, and emotion state", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me" }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", isBot: true }),
    player({ sessionId: "op-2", seatIndex: 2, name: "Bot 3", isBot: true }),
    player({ sessionId: "op-3", seatIndex: 3, name: "Bot 4", isBot: true }),
  ];
  const playersBySeat = new Map(players.map((p) => [p.seatIndex, p] as const));

  const presentation = buildTurnChangePresentation({
    state: { currentPlayer: 2, direction: 1, winner: -1 } as never,
    players,
    playersBySeat,
    roomSessionId: "me",
    prevSeat: 0,
    currentSeat: 2,
  });

  assert.deepEqual(presentation, {
    turnBanner: {
      name: "Bot 3",
      subtitle: "Thinking...",
      emoji: "🐼",
      themeColor: "hsl(148, 65%, 45%)",
    },
    skippedSeatIndex: 1,
    skippedBotEmotion: {
      seatIndex: 1,
      emoji: "😱",
    },
  });
});

test("buildTurnChangePresentation uses the explicit turn subtitle for the current player", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me" }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", isBot: true }),
  ];
  const playersBySeat = new Map(players.map((p) => [p.seatIndex, p] as const));

  const presentation = buildTurnChangePresentation({
    state: { currentPlayer: 0, direction: 1, winner: -1 } as never,
    players,
    playersBySeat,
    roomSessionId: "me",
    prevSeat: 1,
    currentSeat: 0,
  });

  assert.deepEqual(presentation?.turnBanner, {
    name: "Your Turn",
    subtitle: "Make your move!",
    emoji: "🐯",
    themeColor: "hsl(358, 75%, 55%)",
  });
});

test("buildVisibleBotEmotionState layers overrides over base bot emotions", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me" }),
    player({ sessionId: "bot-1", seatIndex: 1, name: "Bot 2", isBot: true }),
    player({ sessionId: "bot-2", seatIndex: 2, name: "Bot 3", isBot: true }),
  ];

  const result = buildVisibleBotEmotionState({
    players,
    baseBotEmotions: {
      1: "😬",
      2: "😰",
    },
    overrides: {
      "bot-2": "😎",
    },
  });

  assert.deepEqual(result, {
    1: "😬",
    2: "😎",
  });
});

test("buildDiscardPlayPresentation summarizes the played card state", () => {
  const playedPlayer = player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", isBot: true });
  const presentation = buildDiscardPlayPresentation({
    top: { id: "w4", cardType: "wild", color: "wild", value: "wild_draw4" },
    playedPlayer,
    roomSessionId: "me",
  });

  assert.deepEqual(presentation, {
    drawParticleCount: 35,
    isWild: true,
    cardAlert: {
      variant: "banner",
      tone: "warning",
      text: "+4 DRAW!",
    },
    bubbleText: "Wild +4",
    bubbleThemeColor: "hsl(208, 85%, 52%)",
    startElId: getPlayerPillAnchorId(1),
    botEmotion: "😈",
    shouldReverseSweep: false,
  });
});

test("buildBurstParticles produces a deterministic burst when randomness is stubbed", () => {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  Date.now = () => 123;
  Math.random = () => 0.25;

  try {
    const particles = buildBurstParticles({
      x: 10,
      y: 20,
      count: 2,
      emojis: ["🔥", "💥"],
      idPrefix: "fire",
      batchId: "batch-1",
    });

    assert.equal(particles.length, 2);
    assert.deepEqual(particles[0], {
      id: "fire-batch-1-0",
      x: 10,
      y: 20,
      emoji: "🔥",
      tx: "-30px",
      ty: "-30px",
      tr: "-90deg",
    });
    assert.deepEqual(particles[1], {
      id: "fire-batch-1-1",
      x: 10,
      y: 20,
      emoji: "🔥",
      tx: "-30px",
      ty: "-30px",
      tr: "-90deg",
    });
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test("buildCardFlight derives launch state from the launch geometry", () => {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  Date.now = () => 123;
  Math.random = () => 0.25;

  try {
    const flight = buildCardFlight({
      card: card("c1", "color", "blue", "1"),
      isBack: true,
      startX: 1,
      startY: 2,
      endX: 3,
      endY: 4,
      batchId: "flight-batch",
    });

    assert.deepEqual(flight, {
      id: "flight-flight-batch",
      card: card("c1", "color", "blue", "1"),
      isBack: true,
      startX: 1,
      startY: 2,
      endX: 3,
      endY: 4,
      rotation: -22.5,
      animating: false,
    });
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test("buildRadialBurstParticles uses radial placement for wild and non-wild bursts", () => {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  Date.now = () => 321;
  Math.random = () => 0.25;

  try {
    const particles = buildRadialBurstParticles({
      x: 4,
      y: 8,
      count: 1,
      emojis: ["✨"],
      idPrefix: "particle",
      isWild: false,
      batchId: "batch-2",
    });

    assert.equal(particles[0].id, "particle-batch-2-0");
    assert.equal(particles[0].x, 4);
    assert.equal(particles[0].y, 8);
    assert.equal(particles[0].emoji, "✨");
    assert.equal(Math.abs(Number.parseFloat(particles[0].tx)) < 1e-9, true);
    assert.equal(particles[0].ty, "90px");
    assert.equal(particles[0].tr, "-90deg");
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test("buildFlightTrailParticle uses the current position and sparkle palette", () => {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  Date.now = () => 123;
  Math.random = () => 0.25;

  try {
    const particle = buildFlightTrailParticle({
      x: 10,
      y: 20,
      id: "trail-123-0.25",
      emojis: ["✨", "🌟", "💫", "⭐"],
    });

    assert.deepEqual(particle, {
      id: "trail-123-0.25",
      x: 10,
      y: 20,
      emoji: "🌟",
      tx: "-5px",
      ty: "-5px",
      tr: "-45deg",
    });
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test("getEasedFlightPoint follows the cubic ease-out path", () => {
  const point = getEasedFlightPoint({
    startX: 10,
    startY: 20,
    endX: 50,
    endY: 100,
    progress: 0.5,
  });

  assert.deepEqual(point, {
    x: 45,
    y: 90,
  });
});

test("buildPlayerCardCountSnapshot uses the current count source for each seat", () => {
  const snapshot = buildPlayerCardCountSnapshot([
    player({ sessionId: "me", seatIndex: 0, name: "Me", handCount: 5 }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", handCount: 1 }),
  ]);

  assert.deepEqual(snapshot, { 0: 5, 1: 1 });
});

test("buildDrawDiffPresentations maps draw gains to the correct targets", () => {
  const presentations = buildDrawDiffPresentations({
    players: [
      player({ sessionId: "me", seatIndex: 0, name: "Me", handCount: 5 }),
      player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", handCount: 3, isBot: true }),
      player({ sessionId: "op-2", seatIndex: 2, name: "Bot 3", handCount: 2, isBot: true }),
    ],
    prevHandCounts: { 0: 3, 1: 1, 2: 2 },
    roomSessionId: "me",
  });

  assert.deepEqual(presentations, [
    { seatIndex: 0, drawDiff: 2, targetElId: HAND_DOCK_ANCHOR_ID, isBot: false, fireBurstCount: 15 },
    { seatIndex: 1, drawDiff: 2, targetElId: getPlayerPillAnchorId(1), isBot: true, fireBurstCount: 15 },
  ]);
});

test("buildRoundStatusPresentation surfaces UNO, penalty, winner, and hand-swish signals", () => {
  const originalNow = Date.now;
  Date.now = () => 6000;

  try {
    const players = [
      player({ sessionId: "op-0", seatIndex: 0, name: "Bot 1", isBot: true }),
      player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", isBot: true }),
      player({ sessionId: "me", seatIndex: 2, name: "Me" }),
    ];
    const playersBySeat = new Map(players.map((p) => [p.seatIndex, p] as const));

    const round = buildRoundStatusPresentation({
      currentUno: 1,
      lastUno: -1,
      currentPending: 3,
      lastPending: 1,
      currentWinner: 2,
      lastWinner: -1,
      currentHand: 5,
      lastHandCount: 2,
      me: players[2],
      playersBySeat,
      opponentPlayers: players.slice(0, 2),
      matchStartTimeMs: 1000,
      cardsPlayed: 7,
    });

    assert.deepEqual(round.unoAlert, {
      variant: "crest",
      kind: "warning",
      icon: "⚠️",
      title: "Bot 2 HAS 1 CARD!",
      subtitle: "Single Card Alert",
    });
    assert.equal(round.unoParticleCount, 25);
    assert.deepEqual(round.pendingDrawAlert, {
      variant: "banner",
      tone: "warning",
      text: "🔥 +3 DRAW STACKED!",
    });
    assert.equal(round.pendingDrawParticleCount, 20);
    assert.deepEqual(round.winnerSummary, {
      win: true,
      cardsPlayed: 7,
      botKills: 2,
      winnerName: "Me",
      durationSec: 5,
      opponentNames: ["Bot 1", "Bot 2"],
    });
    assert.equal(round.winnerParticleCount, 40);
    assert.equal(round.handSwish, true);
  } finally {
    Date.now = originalNow;
  }
});

test("buildGuidanceState covers turn, penalty, and invalid-selection states", () => {
  assert.equal(
    buildGuidanceState({
      mustCallUno: true,
      isMyTurn: true,
      pendingDraw: 0,
      hasPlayableCards: true,
      selectedCard: null,
      isSelectedPlayable: true,
    }).guidanceStatus,
    "warning",
  );

  const penalty = buildGuidanceState({
    mustCallUno: false,
    isMyTurn: true,
    pendingDraw: 4,
    hasPlayableCards: false,
    selectedCard: null,
    isSelectedPlayable: true,
  });
  assert.match(penalty.guidanceText, /Draw penalty: \+4/);

  const invalid = buildGuidanceState({
    mustCallUno: false,
    isMyTurn: true,
    pendingDraw: 0,
    hasPlayableCards: true,
    selectedCard: card("r2", "color", "red", "2"),
    isSelectedPlayable: false,
  });
  assert.equal(invalid.guidanceStatus, "error");
  assert.match(invalid.guidanceText, /Invalid selection!/);
});

test("buildHandInteractionState keeps wild draw four legality aligned with shared rules", () => {
  const baseState = {
    discardPile: [card("top", "color", "red", "5")],
    activeColor: "red",
    pendingDraw: 0,
    unoCaller: -1,
  };

  const blocked = buildHandInteractionState({
    hand: [
      card("alt", "color", "red", "2"),
      card("w4", "wild", "wild", "wild_draw4"),
    ],
    selectedCardId: null,
    state: baseState as never,
    meSeatIndex: 0,
    isMyTurn: true,
    tableReady: true,
  });
  assert.equal(blocked.playableCardIds.has("w4"), false);

  const allowed = buildHandInteractionState({
    hand: [card("w4", "wild", "wild", "wild_draw4")],
    selectedCardId: null,
    state: baseState as never,
    meSeatIndex: 0,
    isMyTurn: true,
    tableReady: true,
  });
  assert.equal(allowed.playableCardIds.has("w4"), true);
});

test("buildActionCallout mirrors UNO and draw-penalty prompts", () => {
  assert.deepEqual(
    buildActionCallout({
      mustCallUno: true,
      isMyTurn: true,
      pendingDraw: 0,
      hasPlayableCards: true,
    }),
    {
      kind: "uno",
      title: "UNO call required",
      text: "Tap UNO before you play again to avoid the 2-card penalty.",
    },
  );

  assert.equal(
    buildActionCallout({
      mustCallUno: false,
      isMyTurn: false,
      pendingDraw: 2,
      hasPlayableCards: true,
    }),
    null,
  );

  assert.match(
    buildActionCallout({
      mustCallUno: false,
      isMyTurn: true,
      pendingDraw: 2,
      hasPlayableCards: false,
    })?.text ?? "",
    /No stacking card available/,
  );
});

test("getActionCalloutLabel keeps the hand dock callout copy centralized", () => {
  assert.equal(getActionCalloutLabel(null), "");
  assert.equal(getActionCalloutLabel({ kind: "uno", title: "UNO!", text: "Call it now" }), "Action required");
  assert.equal(
    getActionCalloutLabel({ kind: "penalty", title: "+2 DRAW!", text: "Stack draws" }),
    "Draw stack active",
  );
});

test("me summary and theme helpers stay stable", () => {
  const me = player({ sessionId: "me", seatIndex: 4, name: "[av-panda-rose]Nova", handCount: 8 });
  assert.deepEqual(buildMeSummary(me, 3), {
    displayName: "Nova",
    symbol: "panda",
    theme: "rose",
    seatIndex: 4,
    spectatorCount: 3,
  });
  assert.equal(getActivePlayerThemeColor(me), "hsl(358, 75%, 55%)");
  assert.equal(getActivePlayerThemeColor(null), "rgba(255, 255, 255, 0.1)");
});

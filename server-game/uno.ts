// ── Uno Types & Game Logic (server-only) ─────────────────────────────────────
// This file contains server-only game logic (AI, deck management, etc.)
// Pure types and shared functions are re-exported from the top-level shared/

// Re-export pure types and shared functions from @repo/shared for server use
export type {
  UnoColor,
  UnoValue,
  WildType,
  ColorCard,
  WildCard,
  UnoCard,
} from "../shared/types.ts";
export {
  canPlay,
  cardTextureFromSchema,
  canPlaySchema,
  getActiveColor,
  cardTexture,
  hasWildDrawFourAlternative,
  isUnoColor,
} from "../shared/gameLogic.ts";
export {
  ACTION_COOLDOWN_MS,
  BOT_TURN_DELAY_MS,
  HAND_SIZE,
  HUMAN_TURN_TIMEOUT_MS,
  NUM_PLAYERS,
} from "../shared/constants.ts";

// Import for internal use within this file
import type { UnoColor, UnoValue, WildCard, UnoCard } from "../shared/types.ts";
import { canPlay, hasWildDrawFourAlternative, isUnoColor } from "../shared/gameLogic.ts";
import { NUM_PLAYERS, HAND_SIZE } from "../shared/constants.ts";

// ── Server-only implementations ──────────────────────────────────────────────

/** Monotonic counter so card IDs are unique across rounds */
let globalUid = 0;

/** Build a full 108-card Uno deck */
export function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let uid = globalUid;

  const colors: UnoColor[] = ["red", "blue", "green", "yellow"];
  const values: UnoValue[] = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "skip",
    "reverse",
    "draw2",
  ];

  for (const color of colors) {
    for (const value of values) {
      const copies = value === "0" ? 1 : 2;
      for (let c = 0; c < copies; c++) {
        deck.push({ type: "color", color, value, id: `${color}_${value}_${uid++}` });
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ type: "wild", wildType: "wild", chosenColor: null, id: `wild_${uid++}` });
    deck.push({
      type: "wild",
      wildType: "wild_draw4",
      chosenColor: null,
      id: `wild_draw4_${uid++}`,
    });
  }

  globalUid = uid;
  return deck;
}

export function shuffleDeck(deck: UnoCard[]): UnoCard[] {
  const d = shuffleArray(deck);
  return d;
}

function shuffleArray<T>(items: readonly T[]): T[] {
  const d = [...items];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// UnoState and game management functions
export interface UnoState {
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  hands: UnoCard[][];
  currentPlayer: number;
  direction: 1 | -1;
  activeColor: UnoColor;
  pendingDraw: number;
  winner: number | null;
}

// Note: NUM_PLAYERS and HAND_SIZE already imported at top of file

type CardLike = {
  type?: string;
  cardType?: string;
  color?: string;
  value?: string;
  wildType?: string;
};

function nextPlayer(state: UnoState, skip = 0): number {
  let p = state.currentPlayer;
  for (let i = 0; i <= skip; i++) {
    p = (((p + state.direction) % NUM_PLAYERS) + NUM_PLAYERS) % NUM_PLAYERS;
  }
  return p;
}

function recycleDiscard(state: UnoState) {
  const recycled = recycleDiscardPile(state.drawPile, state.discardPile, (card) => card);
  if (recycled) {
    state.drawPile = recycled;
  }
}

export function drawCards(state: UnoState, player: number, count: number): UnoState {
  const hands = [...state.hands];
  hands[player] = [...state.hands[player]];
  const s = { ...state, hands, drawPile: state.drawPile, discardPile: state.discardPile };
  let discardPileCloned = false;
  for (let i = 0; i < count; i++) {
    if (s.drawPile.length === 0 && s.discardPile.length <= 1) break;
    if (s.drawPile === state.drawPile) {
      s.drawPile = [...state.drawPile];
    }
    if (s.drawPile.length === 0 && !discardPileCloned) {
      s.discardPile = [...state.discardPile];
      discardPileCloned = true;
    }
    recycleDiscard(s);
    if (s.drawPile.length === 0) break;
    s.hands[player].push(s.drawPile.pop()!);
  }
  return s;
}

export function createGame(): UnoState {
  const deck = shuffleDeck(createUnoDeck());
  const hands: UnoCard[][] = Array.from({ length: NUM_PLAYERS }, () => []);

  let idx = 0;
  for (let c = 0; c < HAND_SIZE; c++) {
    for (let p = 0; p < NUM_PLAYERS; p++) {
      hands[p].push(deck[idx++]);
    }
  }

  let startIdx = idx;
  while (startIdx < deck.length && deck[startIdx].type === "wild") startIdx++;
  if (startIdx >= deck.length) startIdx = idx;

  const firstCard = deck[startIdx];
  const remaining = [...deck.slice(idx, startIdx), ...deck.slice(startIdx + 1)];

  const activeColor = firstCard.type === "color" ? firstCard.color : "red";

  let currentPlayer = 0;
  let direction: 1 | -1 = 1;

  if (firstCard.type === "color") {
    if (firstCard.value === "skip") {
      currentPlayer = 1;
    } else if (firstCard.value === "reverse") {
      direction = -1;
      currentPlayer = NUM_PLAYERS - 1;
    }
  }

  return {
    drawPile: remaining,
    discardPile: [firstCard],
    hands,
    currentPlayer,
    direction,
    activeColor,
    pendingDraw: firstCard.type === "color" && firstCard.value === "draw2" ? 2 : 0,
    winner: null,
  };
}

export function getPlayableCards(state: UnoState, player: number): UnoCard[] {
  if (!Number.isInteger(player) || player < 0 || player >= state.hands.length) return [];
  if (state.winner !== null) return [];
  if (player !== state.currentPlayer) return [];

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (!topCard) return [];
  const hand = state.hands[player];
  const playableIndices = getPlayableCardIndices(
    hand,
    topCard,
    state.activeColor,
    state.pendingDraw,
    canPlay,
    hasWildDrawFourAlternative,
  );
  return playableIndices.map((index) => hand[index]);
}

export function getPlayableCardIndices<TCard extends CardLike, TTopCard extends CardLike>(
  hand: ArrayLike<TCard>,
  topCard: TTopCard,
  activeColor: UnoColor | string,
  pendingDraw: number | undefined,
  canPlayCard: (
    card: TCard,
    topCard: TTopCard,
    activeColor: UnoColor | string,
    pendingDraw?: number,
  ) => boolean,
  hasAlternative: (
    hand: Iterable<TCard>,
    topCard: TTopCard,
    activeColor: UnoColor | string,
  ) => boolean,
): number[] {
  const playable: number[] = [];
  let wildDraw4Alternative: boolean | undefined;
  const handCards = Array.from({ length: hand.length }, (_, index) => hand[index]) as TCard[];

  for (let i = 0; i < handCards.length; i++) {
    const card = handCards[i];
    if (!canPlayCard(card, topCard, activeColor, pendingDraw)) continue;
    const cardValue = (card as TCard & { wildType?: string }).wildType ?? card.value;
    if (
      (card.type === "wild" || card.cardType === "wild") &&
      cardValue === "wild_draw4" &&
      pendingDraw === 0
    ) {
      if (wildDraw4Alternative === undefined) {
        wildDraw4Alternative = hasAlternative(handCards, topCard, activeColor);
      }
      if (wildDraw4Alternative) continue;
    }
    playable.push(i);
  }
  return playable;
}

export function handleDraw(state: UnoState): UnoState {
  const player = state.currentPlayer;
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
  let s = drawCards(state, player, count);
  s.pendingDraw = 0;
  s.currentPlayer = nextPlayer(s);
  return s;
}

const COLOR_ORDER: readonly UnoColor[] = ["red", "blue", "green", "yellow"];

type ColorCardLike = {
  type?: string;
  cardType?: string;
  color?: string;
  value?: string;
};

type ColorStats = Record<
  UnoColor,
  {
    count: number;
    hasMatchingValue: boolean;
    actionCount: number;
  }
>;

type PlayableCardLike = {
  type?: string;
  cardType?: string;
  color?: string;
  value?: string;
  wildType?: string;
};

export type SchemaCardShape = {
  id: string;
  cardType: string;
  color: string;
  value: string;
  chosenColor: string;
};

function createColorStats(): ColorStats {
  return {
    red: { count: 0, hasMatchingValue: false, actionCount: 0 },
    blue: { count: 0, hasMatchingValue: false, actionCount: 0 },
    green: { count: 0, hasMatchingValue: false, actionCount: 0 },
    yellow: { count: 0, hasMatchingValue: false, actionCount: 0 },
  };
}

function collectColorStats(hand: Iterable<ColorCardLike>, topCardValue?: string): ColorStats {
  const stats = createColorStats();
  for (const card of hand) {
    const isColorCard = card.type === "color" || card.cardType === "color";
    if (!isColorCard) continue;
    const color = card.color;
    if (!isUnoColor(color)) continue;
    const stat = stats[color];
    if (!stat) continue;
    stat.count++;
    const cardValue = card.value;
    if (cardValue === topCardValue) stat.hasMatchingValue = true;
    if (cardValue && isActionValue(cardValue)) stat.actionCount++;
  }
  return stats;
}

function scoreColorStats(
  stats: ColorStats,
  color: UnoColor,
  discardedCounts?: Record<string, number>,
): number {
  const { count, hasMatchingValue, actionCount } = stats[color];
  const discarded = discardedCounts?.[color] ?? 0;
  let score = 100 + count * 10 + discarded * 2;
  if (hasMatchingValue) score += 15;
  score += actionCount * 5;
  return score;
}

function pickBestColorFromStats(
  stats: ColorStats,
  discardedCounts?: Record<string, number>,
): UnoColor {
  let bestColor: UnoColor = COLOR_ORDER[0];
  let bestScore = -Infinity;

  for (const color of COLOR_ORDER) {
    const score = scoreColorStats(stats, color, discardedCounts);
    if (score > bestScore) {
      bestColor = color;
      bestScore = score;
    }
  }

  return bestColor;
}

function isWildCardLike(card: PlayableCardLike): boolean {
  return card.type === "wild" || card.cardType === "wild";
}

function isActionValue(value: string): boolean {
  return value === "skip" || value === "reverse" || value === "draw2";
}

function pickBestCardIndex(
  length: number,
  getCard: (index: number) => PlayableCardLike,
  activeColor: UnoColor,
): number {
  const actionCards: number[] = [];
  const reverseCards: number[] = [];
  const skipCards: number[] = [];
  const numberCards: number[] = [];
  const matchingColorCards: number[] = [];
  const wildCards: number[] = [];

  for (let i = 0; i < length; i++) {
    const card = getCard(i);
    if (isWildCardLike(card)) {
      wildCards.push(i);
      continue;
    }

    if (card.value && isActionValue(card.value)) {
      actionCards.push(i);
      if (card.value === "reverse") reverseCards.push(i);
      if (card.value === "skip") skipCards.push(i);
      continue;
    }

    numberCards.push(i);
    if (card.color === activeColor) matchingColorCards.push(i);
  }

  if (actionCards.length > 0) {
    if (reverseCards.length > 0)
      return reverseCards[Math.floor(Math.random() * reverseCards.length)];
    if (skipCards.length > 0) return skipCards[Math.floor(Math.random() * skipCards.length)];
    if (numberCards.length === 0 && wildCards.length === 0) {
      return actionCards[0];
    }
  }

  if (numberCards.length > 0) {
    if (matchingColorCards.length > 0) {
      return matchingColorCards[Math.floor(Math.random() * matchingColorCards.length)];
    }
    return numberCards[Math.floor(Math.random() * numberCards.length)];
  }

  return wildCards[0] ?? 0;
}

export function pickBestCard(playable: UnoCard[], activeColor: UnoColor): UnoCard {
  return playable[pickBestCardIndex(playable.length, (index) => playable[index], activeColor)];
}

export function aiTurn(state: UnoState): UnoState {
  const player = state.currentPlayer;

  if (state.pendingDraw > 0) {
    const stackable = getPlayableCards(state, player);
    if (stackable.length === 0) {
      return handleDraw(state);
    }
  }

  const playable = getPlayableCards(state, player);
  if (playable.length === 0) {
    return handleDraw(state);
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  const card = pickBestCard(playable, state.activeColor);

  let chosenColor: UnoColor | undefined;
  if (card.type === "wild") {
    const topCardValue = topCard.type === "color" ? topCard.value : undefined;
    chosenColor = pickBestColorFromStats(collectColorStats(state.hands[player], topCardValue));
  }

  return playCard(state, player, card.id, chosenColor);
}

export function pickBestColor(hand: UnoCard[]): UnoColor {
  return pickBestColorFromStats(collectColorStats(hand));
}

export function recycleDiscardPile<TDraw, TDiscard>(
  drawPile: TDraw[],
  discardPile: { length: number; splice(start: number, deleteCount: number): TDiscard[] },
  mapCard: (card: TDiscard) => TDraw,
): TDraw[] | null {
  if (drawPile.length > 0 || discardPile.length <= 1) return null;

  const removed = discardPile.splice(0, discardPile.length - 1);
  return shuffleArray(removed.map(mapCard));
}

export function writeSchemaCardFields<T extends SchemaCardShape>(target: T, card: UnoCard): T {
  target.id = card.id;
  if (card.type === "color") {
    target.cardType = "color";
    target.color = card.color;
    target.value = card.value;
    target.chosenColor = "";
  } else {
    target.cardType = "wild";
    target.color = "";
    target.value = card.wildType;
    target.chosenColor = card.chosenColor || "";
  }
  return target;
}

export function schemaCardToUnoCard(schema: {
  id: string;
  cardType: string;
  color: string;
  value: string;
  chosenColor?: string;
}): UnoCard {
  if (schema.cardType === "color") {
    return {
      type: "color",
      color: schema.color as UnoColor,
      value: schema.value as UnoValue,
      id: schema.id,
    };
  }

  return {
    type: "wild",
    wildType: schema.value as WildCard["wildType"],
    chosenColor: (schema.chosenColor || null) as UnoColor | null,
    id: schema.id,
  };
}

export interface AutoPlayResult {
  state: UnoState;
  completed: boolean;
  turnsPlayed: number;
  winner: number | null;
  reason: "winner" | "turn_limit";
}

export interface AutoPlayOptions {
  maxTurns?: number;
  onTurn?: (state: UnoState, turn: number) => void;
}

export function autoPlayGame(
  initialState: UnoState = createGame(),
  options: AutoPlayOptions = {},
): AutoPlayResult {
  const maxTurns = options.maxTurns ?? 1000;
  let state = initialState;
  let turnsPlayed = 0;

  while (state.winner === null && turnsPlayed < maxTurns) {
    const before = state;
    state = aiTurn(state);
    turnsPlayed++;
    options.onTurn?.(state, turnsPlayed);

    if (state === before) {
      break;
    }
  }

  return {
    state,
    completed: state.winner !== null,
    turnsPlayed,
    winner: state.winner,
    reason: state.winner !== null ? "winner" : "turn_limit",
  };
}

// AI strategy functions using schema card format (for Colyseus)
type SchemaHandCard = { cardType: string; color: string; value: string };
type SchemaHandLike = ArrayLike<SchemaHandCard> & Iterable<SchemaHandCard>;

export function pickBestCardSchema(
  playableIndices: number[],
  hand: ArrayLike<{ cardType: string; color: string; value: string; id: string }>,
  activeColor: UnoColor,
): number {
  return playableIndices[
    pickBestCardIndex(playableIndices.length, (index) => hand[playableIndices[index]], activeColor)
  ];
}

export function pickBestColorSchema(
  hand: SchemaHandLike,
  topCardValue: string | undefined,
  discardedCounts?: Record<string, number>,
): UnoColor {
  return pickBestColorFromStats(collectColorStats(hand, topCardValue), discardedCounts);
}

// Internal helper for aiTurn (canPlay already imported/re-exported at top)
export function playCard(
  state: UnoState,
  player: number,
  cardId: string,
  chosenColor?: UnoColor,
): UnoState {
  if (!Number.isInteger(player) || player < 0 || player >= state.hands.length) return state;
  if (state.winner !== null) return state;
  if (player !== state.currentPlayer) return state;

  const hands = [...state.hands];
  hands[player] = [...state.hands[player]];
  const s = { ...state, hands, discardPile: [...state.discardPile] };

  const handIdx = s.hands[player].findIndex((c) => c.id === cardId);
  if (handIdx === -1) return state;

  const card = { ...s.hands[player][handIdx] };
  const topCard = s.discardPile[s.discardPile.length - 1];
  if (!topCard) return state;
  if (!canPlay(card, topCard, s.activeColor, s.pendingDraw)) return state;
  if (card.type === "wild" && card.wildType === "wild_draw4" && s.pendingDraw === 0) {
    if (hasWildDrawFourAlternative(s.hands[player], topCard, s.activeColor)) return state;
  }
  if (card.type === "wild" && chosenColor !== undefined && !isUnoColor(chosenColor)) return state;

  s.hands[player].splice(handIdx, 1);

  if (card.type === "wild") {
    (card as WildCard).chosenColor = chosenColor ?? "red";
    s.activeColor = (card as WildCard).chosenColor!;
  } else {
    s.activeColor = card.color;
  }

  s.discardPile.push(card);

  if (card.type === "color") {
    switch (card.value) {
      case "reverse":
        s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
        s.currentPlayer = nextPlayer(s);
        break;
      case "skip":
        s.currentPlayer = nextPlayer(s, 1);
        break;
      case "draw2":
        s.pendingDraw += 2;
        s.currentPlayer = nextPlayer(s);
        break;
      default:
        s.currentPlayer = nextPlayer(s);
    }
  } else {
    if (card.wildType === "wild_draw4") {
      s.pendingDraw += 4;
    }
    s.currentPlayer = nextPlayer(s);
  }

  if (s.hands[player].length === 0) {
    s.winner = player;
  }

  return s;
}

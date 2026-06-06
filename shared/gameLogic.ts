// ── Uno Game Logic ─────────────────────────────────────────────────────

import type { UnoCard, UnoColor } from './types.ts';

const UNO_COLORS: readonly UnoColor[] = ['red', 'blue', 'green', 'yellow'];
const UNO_COLOR_SET = new Set<UnoColor>(UNO_COLORS);
const UNO_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']);
const WILD_VALUES = new Set(['wild', 'wild_draw4']);

type CardLike = {
  type?: unknown;
  cardType?: unknown;
  color?: unknown;
  value?: unknown;
  wildType?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCardType(card: unknown): 'color' | 'wild' | undefined {
  if (!isRecord(card)) return undefined;
  const rawType = card.type ?? card.cardType;
  return rawType === 'color' || rawType === 'wild' ? rawType : undefined;
}

function getCardValue(card: unknown): string | undefined {
  if (!isRecord(card)) return undefined;
  const raw = card as CardLike;
  const value = raw.wildType ?? raw.value;
  return typeof value === 'string' ? value : undefined;
}

function getCardColor(card: unknown): string | undefined {
  if (!isRecord(card)) return undefined;
  const raw = card as CardLike;
  return typeof raw.color === 'string' ? raw.color : undefined;
}

export function isUnoColor(value: unknown): value is UnoColor {
  return typeof value === 'string' && UNO_COLOR_SET.has(value as UnoColor);
}

function isValidPlayableCard(card: unknown): boolean {
  const cardType = getCardType(card);
  const value = getCardValue(card);
  const color = getCardColor(card);

  if (cardType === 'color') {
    return isUnoColor(color) && typeof value === 'string' && UNO_VALUES.has(value);
  }

  if (cardType === 'wild') {
    return typeof value === 'string' && WILD_VALUES.has(value);
  }

  return false;
}

function isValidTopCard(card: unknown): boolean {
  const cardType = getCardType(card);
  const value = getCardValue(card);

  if (cardType === 'color') {
    return typeof value === 'string' && UNO_VALUES.has(value);
  }

  if (cardType === 'wild') {
    return typeof value === 'string' && WILD_VALUES.has(value);
  }

  return false;
}

function evaluateCanPlay(
  card: UnoCard | { cardType: string; color: string; value: string; wildType?: string },
  topCard: UnoCard | { cardType: string; value: string },
  activeColor: UnoColor | string,
  pendingDraw?: number,
): boolean {
  if (!isValidPlayableCard(card) || !isValidTopCard(topCard) || !isUnoColor(activeColor)) return false;

  const cardType = getCardType(card);
  const topCardType = getCardType(topCard);
  const cardValue = getCardValue(card);
  const topValue = getCardValue(topCard);
  const cardColor = getCardColor(card);

  // Draw-2 stacking: if pendingDraw > 0, only draw2 cards can stack
  if (pendingDraw && pendingDraw > 0) {
    if (topCardType === 'color' && topValue === 'draw2') {
      return cardType === 'color' && cardValue === 'draw2';
    }
    if (topCardType === 'wild' && topValue === 'wild_draw4') {
      return cardType === 'wild' && cardValue === 'wild_draw4' && pendingDraw >= 4;
    }
    return false;
  }

  if (cardType === 'wild') return true;
  if (cardColor === activeColor) return true;
  if (topCardType === 'color' && cardValue === topValue) return true;
  return false;
}

/** The filename (without extension) used to load the card texture */
export function cardTexture(card: UnoCard): string {
  if (card.type === 'wild') return card.wildType;
  return `${card.color}_${card.value}`;
}

/** Can this card be played on top of the discard pile? (accepts both UnoCard and schema card formats) */
export function canPlay(
  card: UnoCard | { cardType: string; color: string; value: string; wildType?: string },
  topCard: UnoCard | { cardType: string; value: string },
  activeColor: UnoColor | string,
  pendingDraw?: number,
): boolean {
  return evaluateCanPlay(card, topCard, activeColor, pendingDraw);
}

/** Get the active color (considering wild card choices) */
export function getActiveColor(topCard: UnoCard): UnoColor {
  if (topCard.type === 'wild') return topCard.chosenColor ?? 'red';
  return topCard.color;
}

// ── Schema-compatible helpers (for Colyseus multiplayer) ─────────────

/** Card texture name from schema card data */
export function cardTextureFromSchema(card: { cardType: string; color: string; value: string }): string {
  if (card.cardType === 'wild') return card.value;
  return `${card.color}_${card.value}`;
}

/** Can this schema card be played on top of the discard pile? */
export function canPlaySchema(
  card: UnoCard | { cardType: string; color: string; value: string; wildType?: string },
  topCard: UnoCard | { cardType: string; value: string },
  activeColor: string,
  pendingDraw?: number,
): boolean {
  return evaluateCanPlay(card, topCard, activeColor, pendingDraw);
}

/** Does this hand contain a normal legal option that blocks wild draw four? */
export function hasWildDrawFourAlternative(
  hand: Iterable<UnoCard | { cardType: string; color: string; value: string }>,
  topCard: UnoCard | { cardType: string; value: string },
  activeColor: UnoColor | string,
): boolean {
  const topCardType = getCardType(topCard);
  const topValue = getCardValue(topCard);

  for (const card of hand) {
    const cardType = getCardType(card);
    const cardColor = getCardColor(card);
    const cardValue = getCardValue(card);
    if (cardType !== 'color') continue;
    if (cardColor === activeColor) return true;
    if (topCardType === 'color' && cardValue === topValue) return true;
  }
  return false;
}

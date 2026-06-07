import type { CardSchema, UnoColor } from "../gameTypes";
import type { ChatMessageSchema } from "../gameTypes";
import {
  getDeterministicOffsetX,
  getDeterministicOffsetY,
  getDeterministicRotation,
} from "../gameHelpers.ts";
import { parsePlayerName } from "../gameHelpers.ts";

export const colors: UnoColor[] = ["red", "yellow", "green", "blue"];

export const RULE_CARD_EXAMPLES: Array<{ card: CardSchema; title: string; text: string }> = [
  {
    card: { id: "rule-skip", cardType: "color", color: "red", value: "skip" },
    title: "Skip",
    text: "The next player loses their turn.",
  },
  {
    card: { id: "rule-reverse", cardType: "color", color: "yellow", value: "reverse" },
    title: "Reverse",
    text: "Play order changes direction.",
  },
  {
    card: { id: "rule-draw2", cardType: "color", color: "blue", value: "draw2" },
    title: "Draw 2",
    text: "The next player draws 2 unless they stack another Draw 2.",
  },
  {
    card: { id: "rule-wild", cardType: "wild", color: "wild", value: "wild" },
    title: "Wild",
    text: "Play anytime, then choose the active color.",
  },
  {
    card: { id: "rule-wild-draw4", cardType: "wild", color: "wild", value: "wild_draw4" },
    title: "Wild Draw 4",
    text: "Choose a color and add 4 cards. Use it only when you have no matching color or symbol.",
  },
];

export interface HandLayout {
  handMid: number;
  dynamicFanAngle: number;
  dynamicFanOffset: number;
  dynamicMarginValue: string;
}

export interface ActionBubble {
  id: string;
  seatIndex: number;
  text: string;
  themeColor: string;
}

export const HAND_DOCK_ANCHOR_ID = "hand-dock" as const;
export const DECK_STACK_ANCHOR_ID = "deck-stack-anchor" as const;
export const DISCARD_PILE_ANCHOR_ID = "discard-pile-anchor" as const;
export const PLAYER_PILL_ANCHOR_PREFIX = "player-pill-" as const;

export type TableRoomAnchorId =
  | typeof HAND_DOCK_ANCHOR_ID
  | typeof DECK_STACK_ANCHOR_ID
  | typeof DISCARD_PILE_ANCHOR_ID
  | `${typeof PLAYER_PILL_ANCHOR_PREFIX}${number}`;

export function getPlayerPillAnchorId(seatIndex: number): TableRoomAnchorId {
  return `${PLAYER_PILL_ANCHOR_PREFIX}${seatIndex}`;
}

export function getDeckLayerCount(deckCount: number) {
  return Math.min(7, Math.ceil(deckCount / 15));
}

export function getDiscardCardTransform(cardIndex: number) {
  return `rotate(${getDeterministicRotation(cardIndex)}deg) translate(${getDeterministicOffsetX(cardIndex)}px, ${getDeterministicOffsetY(cardIndex)}px)`;
}

export interface DiscardBackdropCard {
  id: string;
  card: CardSchema;
  transform: string;
  opacity: number;
}

export interface ChatMessageView {
  id: string;
  senderName: string;
  text: string;
}

export const RECENT_CHAT_MESSAGE_LIMIT = 10;

export function buildDiscardBackdropCards(discardPile: CardSchema[]): DiscardBackdropCard[] {
  const startIdx = Math.max(0, discardPile.length - 4);
  return discardPile.slice(startIdx, -1).map((card, hIdx) => {
    const globalIdx = startIdx + hIdx;
    return {
      id: card.id,
      card,
      transform: getDiscardCardTransform(globalIdx),
      opacity: 0.5 + hIdx * 0.15,
    };
  });
}

export function buildChatMessageViews(messages: ChatMessageSchema[]): ChatMessageView[] {
  return messages.map((message) => ({
    id: message.id,
    senderName: parsePlayerName(message.sender).name,
    text: message.text,
  }));
}

export function buildRecentChatMessageState(messages: ChatMessageSchema[]) {
  const recentMessages = messages.slice(-RECENT_CHAT_MESSAGE_LIMIT);
  const latestMessage = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1] : null;
  return {
    chatMessageViews: buildChatMessageViews(recentMessages),
    latestChatMessageId: latestMessage?.id ?? null,
  };
}

export function getPlayerStripPositionClass(index: number, total: number) {
  if (total === 1) return "position-top";
  if (total === 2) return index === 0 ? "position-left" : "position-right";
  if (index === 0) return "position-left";
  if (index === 1) return "position-top";
  return "position-right";
}

export function getHandLayout(handCount: number): HandLayout {
  const handMid = (handCount - 1) / 2;
  const dynamicFanAngle = handCount > 8 ? Math.max(1.2, 40 / handCount) : 5;
  const dynamicFanOffset = handCount > 8 ? Math.max(0.8, 32 / handCount) : 4;
  const dynamicMarginValue = handCount <= 4 ? "10px" : `${Math.max(-56, -12 - handCount * 4)}px`;
  return { handMid, dynamicFanAngle, dynamicFanOffset, dynamicMarginValue };
}

export const TUTORIAL_CARDS = [
  {
    eyebrow: "Step 1 of 3",
    title: "Match the discard",
    text: "Look at the face-up card in the center. Play a card with the same color or symbol. Wild cards match anything.",
    target: "The face-up card sets the match",
  },
  {
    eyebrow: "Step 2 of 3",
    title: "Draw when stuck",
    text: "No matching card? Tap the face-down deck. It glows when drawing is your best move.",
    target: "Tap the deck to draw one card",
  },
  {
    eyebrow: "Step 3 of 3",
    title: "Play from your hand",
    text: "Playable cards glow below the table. Tap once to inspect and again to play. When prompted at one card, tap UNO.",
    target: "Your playable cards glow",
  },
] as const;

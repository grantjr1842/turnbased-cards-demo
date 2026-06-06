import type { CardSchema, UnoState } from "../gameTypes.ts";
import { cardLabel } from "../gameHelpers.ts";
import { canPlaySchema, hasWildDrawFourAlternative } from "@repo/shared/gameLogic";

export type ActionCallout =
  | {
      kind: "uno";
      title: string;
      text: string;
    }
  | {
      kind: "penalty";
      title: string;
      text: string;
    }
  | null;

export interface GuidanceState {
  guidanceText: string;
  guidanceStatus: "normal" | "warning" | "error";
}

export interface HandInteractionState {
  selectedCardIdx: number;
  selectedCardPlayable: boolean;
  hasPlayableCards: boolean;
  playableCardIds: ReadonlySet<string>;
  pendingDraw: number;
  mustCallUno: boolean;
  shouldDrawHint: boolean;
  guidanceText: string;
  guidanceStatus: GuidanceState["guidanceStatus"];
  actionCallout: ActionCallout;
}

export function getActionCalloutLabel(callout: ActionCallout) {
  if (!callout) return "";
  return callout.kind === "uno" ? "Action required" : "Draw stack active";
}

export function buildGuidanceState(params: {
  mustCallUno: boolean;
  isMyTurn: boolean;
  pendingDraw: number;
  hasPlayableCards: boolean;
  selectedCard: CardSchema | null;
  isSelectedPlayable: boolean;
}): GuidanceState {
  const { mustCallUno, isMyTurn, pendingDraw, hasPlayableCards, selectedCard, isSelectedPlayable } =
    params;

  if (mustCallUno) {
    return {
      guidanceText: "Call UNO now! Tap the red UNO button before playing your next card.",
      guidanceStatus: "warning",
    };
  }
  if (!isMyTurn) {
    return {
      guidanceText: "Awaiting opponent's turn... Inspect your hand in the meantime.",
      guidanceStatus: "normal",
    };
  }
  if (pendingDraw > 0) {
    return hasPlayableCards
      ? {
          guidanceText: `Draw penalty: +${pendingDraw}. Play a glowing draw card to stack it, or tap the deck to take ${pendingDraw} cards.`,
          guidanceStatus: "warning",
        }
      : {
          guidanceText: `Draw penalty: +${pendingDraw}. You cannot stack it. Tap the glowing deck to take ${pendingDraw} cards.`,
          guidanceStatus: "warning",
        };
  }
  if (selectedCard && !isSelectedPlayable) {
    return {
      guidanceText: `Invalid selection! ${cardLabel(selectedCard)} doesn't match discard pile.`,
      guidanceStatus: "error",
    };
  }
  if (!hasPlayableCards) {
    return {
      guidanceText: "No playable cards in hand! Click the glowing Deck Stack to Draw.",
      guidanceStatus: "warning",
    };
  }
  return {
    guidanceText: "Select a glowing playable card and click it again to play.",
    guidanceStatus: "normal",
  };
}

export function buildActionCallout(params: {
  mustCallUno: boolean;
  isMyTurn: boolean;
  pendingDraw: number;
  hasPlayableCards: boolean;
}): ActionCallout {
  const { mustCallUno, isMyTurn, pendingDraw, hasPlayableCards } = params;
  if (mustCallUno) {
    return {
      kind: "uno",
      title: "UNO call required",
      text: "Tap UNO before you play again to avoid the 2-card penalty.",
    };
  }
  if (isMyTurn && pendingDraw > 0) {
    return {
      kind: "penalty",
      title: `Take or stack +${pendingDraw}`,
      text: hasPlayableCards
        ? "Play a glowing draw card to pass the penalty on, or tap the deck to take the cards."
        : "No stacking card available. Tap the glowing deck to take the cards.",
    };
  }
  return null;
}

export function buildHandInteractionState(params: {
  hand: CardSchema[];
  selectedCardId: string | null;
  state: UnoState | null;
  meSeatIndex: number | undefined;
  isMyTurn: boolean;
  tableReady: boolean;
}): HandInteractionState {
  const { hand, selectedCardId, state, meSeatIndex, isMyTurn, tableReady } = params;
  const discardPile = state?.discardPile ?? [];
  const topCard = discardPile[discardPile.length - 1] ?? null;
  const activeColor = state?.activeColor ?? "red";
  const pendingDraw = state?.pendingDraw ?? 0;
  const wildDrawFourBlocked =
    Boolean(topCard) && pendingDraw === 0 && hasWildDrawFourAlternative(hand, topCard, activeColor);
  const selectedCardIdx = selectedCardId
    ? hand.findIndex((card) => card.id === selectedCardId)
    : -1;
  const selectedCard = selectedCardIdx === -1 ? null : (hand[selectedCardIdx] ?? null);

  const playableCardIds = new Set<string>();
  for (const card of hand) {
    const playable =
      Boolean(topCard) &&
      canPlaySchema(card, topCard, activeColor, pendingDraw) &&
      !(card.cardType === "wild" && card.value === "wild_draw4" && wildDrawFourBlocked);
    if (playable) {
      playableCardIds.add(card.id);
    }
  }

  const hasPlayableCards = playableCardIds.size > 0;
  const mustCallUno = state?.unoCaller === meSeatIndex;
  const shouldDrawHint = isMyTurn && !hasPlayableCards && tableReady;
  const selectedCardPlayable = selectedCard != null ? playableCardIds.has(selectedCard.id) : false;
  const { guidanceText, guidanceStatus } = buildGuidanceState({
    mustCallUno,
    isMyTurn,
    pendingDraw,
    hasPlayableCards,
    selectedCard,
    isSelectedPlayable: selectedCardPlayable,
  });
  const actionCallout = buildActionCallout({
    mustCallUno,
    isMyTurn,
    pendingDraw,
    hasPlayableCards,
  });

  return {
    selectedCardIdx,
    selectedCardPlayable,
    hasPlayableCards,
    playableCardIds,
    pendingDraw,
    mustCallUno,
    shouldDrawHint,
    guidanceText,
    guidanceStatus,
    actionCallout,
  };
}

import type { CardSchema, PlayerSchema } from "../gameTypes.ts";
import { AVATAR_THEMES } from "../tableConfig.ts";
import { cardLabel, parsePlayerName } from "../gameHelpers.ts";

export type SortMode = "none" | "color" | "value";

export type SpotlightPos = "bottom" | "top" | "left" | "right" | "none";

export interface MeSummary {
  displayName: string;
  symbol: string;
  theme: string;
  seatIndex: number;
  spectatorCount: number;
}

export interface RosterEntry {
  sessionId: string;
  displayName: string;
  symbol: string;
  theme: string;
  isBot: boolean;
  cardCount: number;
  active: boolean;
}

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

export type TurnCoachAction = "play" | "draw" | "uno" | null;

export interface TurnCoachStep {
  title: string;
  detail: string;
  state: "done" | "active" | "idle";
}

export interface TurnCoachState {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  primaryAction: TurnCoachAction;
  primaryLabel: string | null;
  primaryHint: string;
  steps: TurnCoachStep[];
  colorHint: string | null;
}

export function isHandInteractive(isMyTurn: boolean) {
  return isMyTurn;
}

export function shouldEmphasizeDrawDeck(params: {
  isMyTurn: boolean;
  tableReady: boolean;
  pendingDraw: number;
  hasPlayableCards: boolean;
}) {
  const { isMyTurn, tableReady, pendingDraw, hasPlayableCards } = params;
  return isMyTurn && tableReady && (pendingDraw > 0 || !hasPlayableCards);
}

export function sortHand(hand: CardSchema[], sortBy: SortMode) {
  const rawHand = [...hand];
  if (sortBy === "color") {
    return rawHand.sort((a, b) => {
      if (a.cardType === "wild" && b.cardType !== "wild") return 1;
      if (b.cardType === "wild" && a.cardType !== "wild") return -1;
      if (a.color !== b.color) {
        return a.color.localeCompare(b.color);
      }
      return a.value.localeCompare(b.value);
    });
  }
  if (sortBy === "value") {
    return rawHand.sort((a, b) => {
      if (a.value !== b.value) {
        return a.value.localeCompare(b.value);
      }
      return a.color.localeCompare(b.color);
    });
  }
  return rawHand;
}

export function buildMeSummary(me: PlayerSchema | null | undefined, spectatorCount: number): MeSummary | null {
  if (!me) return null;
  const av = parsePlayerName(me.name);
  return {
    displayName: av.name,
    symbol: av.symbol,
    theme: av.theme,
    seatIndex: me.seatIndex,
    spectatorCount,
  };
}

export function buildRosterEntries(
  players: PlayerSchema[],
  meSessionId: string | undefined,
  currentPlayerSeat: number | undefined,
): RosterEntry[] {
  return players
    .filter((player) => player.sessionId !== meSessionId)
    .map((player) => {
      const av = parsePlayerName(player.name);
      return {
        sessionId: player.sessionId,
        displayName: av.name,
        symbol: av.symbol,
        theme: av.theme,
        isBot: player.isBot,
        cardCount: player.handCount ?? player.hand?.length ?? 0,
        active: player.seatIndex === currentPlayerSeat,
      };
    });
}

export function getSpotlightPos(params: {
  isMyTurn: boolean;
  players: PlayerSchema[];
  meSessionId: string | undefined;
  currentPlayerSeat: number | undefined;
}): SpotlightPos {
  const { isMyTurn, players, meSessionId, currentPlayerSeat } = params;
  if (isMyTurn) return "bottom";
  const opponents = players.filter((player) => player.sessionId !== meSessionId);
  const activeOpponentIdx = opponents.findIndex((p) => p.seatIndex === currentPlayerSeat);
  if (activeOpponentIdx === -1) return "none";
  const total = opponents.length;
  if (total === 1) return "top";
  if (total === 2) return activeOpponentIdx === 0 ? "left" : "right";
  if (activeOpponentIdx === 0) return "left";
  if (activeOpponentIdx === 1) return "top";
  return "right";
}

export function buildGuidanceState(params: {
  mustCallUno: boolean;
  isMyTurn: boolean;
  pendingDraw: number;
  hasPlayableCards: boolean;
  playableCardCount: number;
  selectedCard: CardSchema | null;
  isSelectedPlayable: boolean;
}): GuidanceState {
  const {
    mustCallUno,
    isMyTurn,
    pendingDraw,
    hasPlayableCards,
    playableCardCount,
    selectedCard,
    isSelectedPlayable,
  } = params;

  if (mustCallUno) {
    return {
      guidanceText: "Call UNO now. Tap the UNO button before playing your next card.",
      guidanceStatus: "warning",
    };
  }
  if (!isMyTurn) {
    return {
      guidanceText: "Waiting for the next move. Review your hand in the meantime.",
      guidanceStatus: "normal",
    };
  }
  if (pendingDraw > 0) {
    return {
      guidanceText: `Draw penalty: +${pendingDraw}. Tap the deck to take ${pendingDraw} card${pendingDraw === 1 ? "" : "s"}.`,
      guidanceStatus: "warning",
    };
  }
  if (selectedCard && !isSelectedPlayable) {
    return {
      guidanceText: `Invalid selection: ${cardLabel(selectedCard)} doesn't match the discard pile.`,
      guidanceStatus: "error",
    };
  }
  if (!hasPlayableCards) {
    return {
      guidanceText: "No playable cards in hand. Draw from the deck.",
      guidanceStatus: "warning",
    };
  }
  return {
    guidanceText: `${playableCardCount} legal play${playableCardCount === 1 ? "" : "s"} ready. Tap a card or draw if you want a new option.`,
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
      text: "Tap UNO before your next move to avoid the 2-card penalty.",
    };
  }
  if (isMyTurn && pendingDraw > 0) {
    return {
      kind: "penalty",
      title: `Take +${pendingDraw}`,
      text: hasPlayableCards
        ? "Draw penalty active. Tap the deck to take the cards."
        : "No stacking card available. Tap the deck to take the cards.",
    };
  }
  return null;
}

export function isTutorialCompleteFlagSet(storage: Pick<Storage, "getItem">) {
  return storage.getItem("uno_tutorial_complete") === "true";
}

export function getActivePlayerThemeColor(currentPlayer: PlayerSchema | null | undefined) {
  if (!currentPlayer) return "rgba(255, 255, 255, 0.1)";
  const av = parsePlayerName(currentPlayer.name);
  const themeInfo = AVATAR_THEMES.find((t) => t.id === av.theme);
  return themeInfo ? themeInfo.primary : "rgba(255, 255, 255, 0.1)";
}

export function buildTurnCoachState(params: {
  isMyTurn: boolean;
  currentPlayerLabel: string;
  activeColor: string | undefined;
  pendingDraw: number;
  mustCallUno: boolean;
  hasPlayableCards: boolean;
  playableCardCount: number;
  selectedCard: CardSchema | null;
  isSelectedPlayable: boolean;
}): TurnCoachState {
  const {
    isMyTurn,
    currentPlayerLabel,
    activeColor,
    pendingDraw,
    mustCallUno,
    hasPlayableCards,
    playableCardCount,
    selectedCard,
    isSelectedPlayable,
  } = params;

  const activeColorLabel = activeColor ? activeColor.toUpperCase() : "UNKNOWN";
  const selectedCardText = selectedCard ? cardLabel(selectedCard) : null;
  const waitingLabel = currentPlayerLabel === "Waiting" ? "the table" : currentPlayerLabel;

  if (!isMyTurn) {
    return {
      eyebrow: "Waiting",
      title: waitingLabel === "the table" ? "Waiting for the next turn" : `${waitingLabel} is on the move`,
      subtitle:
        waitingLabel === "the table"
          ? "The opening move has not landed yet."
          : `Wait for their play, then react to ${activeColorLabel}.`,
      accent: "calm",
      primaryAction: null,
      primaryLabel: null,
      primaryHint: "Watch the active player and plan your response.",
      colorHint: waitingLabel === "the table" ? "Active color: pending" : `Active color: ${activeColorLabel}`,
      steps: [
        {
          title: "Watch the table",
          detail:
            waitingLabel === "the table"
              ? "The match is settling before the first move."
              : `${waitingLabel} controls the turn right now.`,
          state: "active",
        },
        {
          title: "Track the color",
          detail: `Match ${activeColorLabel} or the card value when your turn arrives.`,
          state: "idle",
        },
        {
          title: "Prepare your answer",
          detail: "Keep a playable card in mind or be ready to draw.",
          state: "idle",
        },
      ],
    };
  }

  if (mustCallUno) {
    return {
      eyebrow: "UNO check",
      title: "Call UNO before your next play",
      subtitle: "You are at one card. Call UNO now or risk the penalty.",
      accent: "urgent",
      primaryAction: "uno",
      primaryLabel: "UNO!",
      primaryHint: "Keyboard: U",
      colorHint: selectedCardText ? `Selected card: ${selectedCardText}` : `Active color: ${activeColorLabel}`,
      steps: [
        {
          title: "Call UNO",
          detail: "Lock in the one-card warning before you play again.",
          state: "active",
        },
        {
          title: "Play or draw",
          detail: hasPlayableCards ? "Use a matching card when you are ready." : "Draw if you have no legal play.",
          state: "idle",
        },
        {
          title: "Protect the finish",
          detail: "Stay on one card until you can empty your hand.",
          state: "idle",
        },
      ],
    };
  }

  if (pendingDraw > 0) {
    return {
      eyebrow: "Penalty turn",
      title: `Draw ${pendingDraw} card${pendingDraw === 1 ? "" : "s"}`,
      subtitle: hasPlayableCards
        ? "The draw penalty is active. Draw the cards before you can continue."
        : "No stacking here. Draw the penalty cards and re-evaluate your hand.",
      accent: "warning",
      primaryAction: "draw",
      primaryLabel: `Draw ${pendingDraw}`,
      primaryHint: "Keyboard: D",
      colorHint: `Active color: ${activeColorLabel}`,
      steps: [
        {
          title: "Take the penalty",
          detail: `Draw ${pendingDraw} card${pendingDraw === 1 ? "" : "s"} from the deck.`,
          state: "active",
        },
        {
          title: "Rebuild your hand",
          detail: "Check for a matching color or value after the draw resolves.",
          state: "idle",
        },
        {
          title: "Pass the turn",
          detail: "Your move ends once the penalty is satisfied.",
          state: "idle",
        },
      ],
    };
  }

  if (selectedCard && !isSelectedPlayable) {
    return {
      eyebrow: "Selection blocked",
      title: `${selectedCardText} cannot be played yet`,
      subtitle: `It does not match ${activeColorLabel} or the discard pile.`,
      accent: "warning",
      primaryAction: "draw",
      primaryLabel: "Draw instead",
      primaryHint: "Keyboard: D",
      colorHint: `Active color: ${activeColorLabel}`,
      steps: [
        {
          title: "Change the selection",
          detail: "Pick a matching card or draw from the deck.",
          state: "active",
        },
        {
          title: "Confirm the move",
          detail: "Playable cards can be tapped twice to play.",
          state: "idle",
        },
        {
          title: "Wrap with UNO",
          detail: "If you fall to one card, hit UNO before the next play.",
          state: "idle",
        },
      ],
    };
  }

  if (selectedCard && isSelectedPlayable) {
    return {
      eyebrow: "Ready to play",
      title: `${selectedCardText} is live`,
      subtitle: `Tap it again or press Enter to play on ${activeColorLabel}.`,
      accent: "play",
      primaryAction: "play",
      primaryLabel: "Play selected",
      primaryHint: "Keyboard: Enter",
      colorHint: `Active color: ${activeColorLabel}`,
      steps: [
        {
          title: "Play the selection",
          detail: `${selectedCardText} matches the discard state.`,
          state: "active",
        },
        {
          title: "Watch the reaction",
          detail: "Special cards can skip, reverse, or force a draw.",
          state: "idle",
        },
        {
          title: "Call UNO if needed",
          detail: "Stay ahead of the one-card penalty.",
          state: "idle",
        },
      ],
    };
  }

  if (!hasPlayableCards) {
    return {
      eyebrow: "No legal play",
      title: "Draw from the deck",
      subtitle: `Nothing in hand matches ${activeColorLabel}. ${playableCardCount} legal play${playableCardCount === 1 ? "" : "s"} available.`,
      accent: "warning",
      primaryAction: "draw",
      primaryLabel: "Draw card",
      primaryHint: "Keyboard: D",
      colorHint: `Active color: ${activeColorLabel}`,
      steps: [
        {
          title: "Draw first",
          detail: "The deck is your only legal move right now.",
          state: "active",
        },
        {
          title: "Check the new card",
          detail: "A fresh draw may create a playable option.",
          state: "idle",
        },
        {
          title: "Then continue",
          detail: "If you hit one card later, remember the UNO button.",
          state: "idle",
        },
      ],
    };
  }

  return {
    eyebrow: "Your turn",
    title: "Play a matching card",
    subtitle: `${playableCardCount} legal play${playableCardCount === 1 ? "" : "s"} ready. Match ${activeColorLabel} or the discard value, then keep an eye on UNO.`,
    accent: "calm",
    primaryAction: null,
    primaryLabel: null,
    primaryHint: "Tap a playable card or use the deck if you want to redraw.",
    colorHint: `Active color: ${activeColorLabel}`,
    steps: [
        {
          title: "Read the table",
          detail: `The current color is ${activeColorLabel}.`,
          state: "active",
        },
        {
          title: "Choose a move",
          detail: hasPlayableCards ? "Play a playable card or draw to reset." : "Draw if no legal card appears.",
          state: "idle",
        },
        {
          title: "Watch your count",
          detail: "Tap UNO when you reach one card.",
          state: "idle",
        },
      ],
    };
  }

import { useEffect, useEffectEvent, type RefObject } from "react";
import type { CardSchema, UnoColor } from "../gameTypes";

export function useTableKeyboardShortcuts(params: {
  hand: CardSchema[];
  selectedCardIdx: number;
  selectedCardPlayable: boolean;
  setSelectedCardId: (cardId: string | null) => void;
  isMyTurn: boolean;
  tableReady: boolean;
  showRules: boolean;
  openRules: () => void;
  closeRules: () => void;
  wildFor: CardSchema | null;
  setWildFor: (card: CardSchema | null) => void;
  tutorialStep: number;
  closeTutorial: () => void;
  playCard: (card: CardSchema, color?: UnoColor) => void;
  drawCard: () => void;
  callUno: () => void;
  chatInputRef: RefObject<HTMLInputElement | null>;
}) {
  const {
    hand,
    selectedCardIdx,
    selectedCardPlayable,
    setSelectedCardId,
    isMyTurn,
    tableReady,
    showRules,
    openRules,
    closeRules,
    wildFor,
    setWildFor,
    tutorialStep,
    closeTutorial,
    playCard,
    drawCard,
    callUno,
    chatInputRef,
  } = params;

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable)
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const shouldPreventDefault =
      key === "escape" ||
      key === "arrowleft" ||
      key === "arrowright" ||
      key === " " ||
      key === "enter" ||
      key === "d" ||
      key === "u" ||
      key === "c" ||
      key === "?" ||
      key === "r" ||
      key === "y" ||
      key === "g" ||
      key === "b";
    if (shouldPreventDefault) {
      event.preventDefault();
    }

    if (showRules) {
      if (event.key === "Escape") {
        closeRules();
      }
      return;
    }
    if (wildFor) {
      if (key === "r") {
        playCard(wildFor, "red");
      } else if (key === "y") {
        playCard(wildFor, "yellow");
      } else if (key === "g") {
        playCard(wildFor, "green");
      } else if (key === "b") {
        playCard(wildFor, "blue");
      } else if (event.key === "Escape") {
        setWildFor(null);
      }
      return;
    }
    if (tutorialStep >= 0) {
      if (event.key === "Escape") {
        closeTutorial();
      }
      return;
    }

    if (key === "arrowleft") {
      if (hand.length === 0) return;
      const nextIdx = selectedCardIdx < 0 ? 0 : Math.max(0, selectedCardIdx - 1);
      setSelectedCardId(hand[nextIdx]?.id ?? null);
    } else if (key === "arrowright") {
      if (hand.length === 0) return;
      const nextIdx = selectedCardIdx < 0 ? 0 : Math.min(hand.length - 1, selectedCardIdx + 1);
      setSelectedCardId(hand[nextIdx]?.id ?? null);
    } else if (event.key === " " || event.key === "Enter") {
      if (selectedCardIdx >= 0 && selectedCardIdx < hand.length) {
        const card = hand[selectedCardIdx];
        if (isMyTurn && selectedCardPlayable) {
          playCard(card);
        }
      }
    } else if (key === "d") {
      if (isMyTurn && tableReady) {
        drawCard();
      }
    } else if (key === "u") {
      callUno();
    } else if (key === "c") {
      chatInputRef.current?.focus();
    } else if (key === "?") {
      if (showRules) {
        closeRules();
      } else {
        openRules();
      }
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

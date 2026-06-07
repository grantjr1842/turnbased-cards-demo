import { useCallback, useState } from "react";
import type { CardSchema } from "../gameTypes";
import type { CardAlert } from "../components/TableCardAlert";
import { getCloseTutorialSnapshot, getReplayGuideSnapshot, type TurnBanner } from "../components/tableRoomOverlayFlow";
import { readStorageItem, removeStorageItem, writeStorageItem } from "../storage";
import { TUTORIAL_CARDS } from "../components/tableRoomModel";

function isTutorialCompleteFlagSet(storage: Pick<Storage, "getItem">) {
  return storage.getItem("uno_tutorial_complete") === "true";
}

export function useTutorialGuideState(params: {
  wildFor: CardSchema | null;
  cardAlert: CardAlert | null;
  turnBanner: TurnBanner | null;
  showReverseSweep: boolean;
}) {
  const { wildFor, cardAlert, turnBanner, showReverseSweep } = params;
  const [showRules, setShowRules] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(() => {
    return isTutorialCompleteFlagSet({ getItem: readStorageItem }) ? -1 : 0;
  });
  const isLastTutorialStep = tutorialStep >= 0 && tutorialStep === TUTORIAL_CARDS.length - 1;
  const tutorial = tutorialStep >= 0 ? TUTORIAL_CARDS[tutorialStep] : null;

  const openRules = useCallback(() => {
    setShowRules(true);
  }, []);

  const closeRules = useCallback(() => {
    setShowRules(false);
  }, []);

  const closeTutorial = useCallback(() => {
    writeStorageItem("uno_tutorial_complete", "true");
    setTutorialStep(
      getCloseTutorialSnapshot({
        showRules,
        tutorialStep,
        wildFor,
        cardAlert,
        turnBanner,
        showReverseSweep,
      }).tutorialStep,
    );
  }, [cardAlert, showRules, showReverseSweep, tutorialStep, turnBanner, wildFor]);

  const replayGuide = useCallback(() => {
    removeStorageItem("uno_tutorial_complete");
    const next = getReplayGuideSnapshot({
      showRules: true,
      tutorialStep,
      wildFor,
      cardAlert,
      turnBanner,
      showReverseSweep,
    });
    setShowRules(next.showRules);
    setTutorialStep(next.tutorialStep);
  }, [cardAlert, setShowRules, showRules, showReverseSweep, tutorialStep, turnBanner, wildFor]);

  const advanceTutorial = useCallback(() => {
    if (isLastTutorialStep) {
      closeTutorial();
      return;
    }
    setTutorialStep((step) => step + 1);
  }, [closeTutorial, isLastTutorialStep]);

  return {
    showRules,
    openRules,
    closeRules,
    tutorialStep,
    isLastTutorialStep,
    tutorial,
    advanceTutorial,
    closeTutorial,
    replayGuide,
  };
}

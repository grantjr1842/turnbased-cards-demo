import { memo } from "react";
import type { RefObject } from "react";
import type { CardSchema, UnoColor } from "../gameTypes";
import { TableCardAlert, type CardAlert } from "./TableCardAlert";
import { TableReverseSweep } from "./TableReverseSweep";
import { TableRulesDrawer } from "./TableRulesDrawer";
import { TableTurnBanner } from "./TableTurnBanner";
import type { TurnBanner } from "./tableRoomOverlayFlow";
import { TableTutorialGuide, type TutorialCard } from "./TableTutorialGuide";
import { TableWildColorModal } from "./TableWildColorModal";
import type { PlayDirection } from "../gameTypes";

interface TableRoomOverlaysProps {
  colorblindMode: boolean;
  cardAlert: CardAlert | null;
  showRules: boolean;
  onCloseRules: () => void;
  onReplayGuide: () => void;
  rulesDialogRef: RefObject<HTMLDivElement | null>;
  tutorial: TutorialCard | null;
  tutorialStep: number;
  isLastTutorialStep: boolean;
  tutorialDialogRef: RefObject<HTMLElement | null>;
  onCloseTutorial: () => void;
  onAdvanceTutorial: () => void;
  turnBanner: TurnBanner | null;
  showReverseSweep: boolean;
  direction: PlayDirection;
  wildFor: CardSchema | null;
  onCloseWild: () => void;
  onSelectWildColor: (color: UnoColor) => void;
  wildDialogRef: RefObject<HTMLDivElement | null>;
}

function TableRoomOverlaysBase({
  colorblindMode,
  cardAlert,
  showRules,
  onCloseRules,
  onReplayGuide,
  rulesDialogRef,
  tutorial,
  tutorialStep,
  isLastTutorialStep,
  tutorialDialogRef,
  onCloseTutorial,
  onAdvanceTutorial,
  turnBanner,
  showReverseSweep,
  direction,
  wildFor,
  onCloseWild,
  onSelectWildColor,
  wildDialogRef,
}: TableRoomOverlaysProps) {
  return (
    <>
      {turnBanner && <TableTurnBanner turnBanner={turnBanner} />}
      <TableReverseSweep showReverseSweep={showReverseSweep} direction={direction} />
      {cardAlert && <TableCardAlert cardAlert={cardAlert} />}
      {showRules && (
        <TableRulesDrawer
          colorblindMode={colorblindMode}
          rulesDialogRef={rulesDialogRef}
          onReplayGuide={onReplayGuide}
          onCloseRules={onCloseRules}
        />
      )}
      {tutorial && (
        <TableTutorialGuide
          tutorial={tutorial}
          tutorialStep={tutorialStep}
          isLastTutorialStep={isLastTutorialStep}
          tutorialDialogRef={tutorialDialogRef}
          onCloseTutorial={onCloseTutorial}
          onAdvanceTutorial={onAdvanceTutorial}
        />
      )}
      {wildFor && (
        <TableWildColorModal
          wildDialogRef={wildDialogRef}
          onCloseWild={onCloseWild}
          onSelectWildColor={onSelectWildColor}
        />
      )}
    </>
  );
}

export const TableRoomOverlays = memo(TableRoomOverlaysBase);

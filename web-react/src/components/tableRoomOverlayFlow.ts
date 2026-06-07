import type { CardSchema } from "../gameTypes";
import type { CardAlert } from "./TableCardAlert";

export interface TurnBanner {
  name: string;
  subtitle: string;
  emoji: string;
  themeColor: string;
}

export interface TableRoomOverlaySnapshot {
  showRules: boolean;
  tutorialStep: number;
  wildFor: CardSchema | null;
  cardAlert: CardAlert | null;
  turnBanner: TurnBanner | null;
  showReverseSweep: boolean;
}

export function getReplayGuideSnapshot(snapshot: TableRoomOverlaySnapshot) {
  return {
    ...snapshot,
    showRules: false,
    tutorialStep: 0,
  };
}

export function getCloseTutorialSnapshot(snapshot: TableRoomOverlaySnapshot) {
  return {
    ...snapshot,
    tutorialStep: -1,
  };
}

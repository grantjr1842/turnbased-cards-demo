import assert from "node:assert/strict";
import test from "node:test";
import { getCloseTutorialSnapshot, getReplayGuideSnapshot } from "../src/components/tableRoomOverlayFlow.ts";

test("replay guide resets the rules drawer and tutorial step", () => {
  const snapshot = getReplayGuideSnapshot({
    showRules: true,
    tutorialStep: 2,
    wildFor: { id: "wild", cardType: "wild", color: "wild", value: "wild" },
    cardAlert: "SKIP!",
    turnBanner: { name: "Test", subtitle: "Thinking...", emoji: "🃏", themeColor: "gold" },
    showReverseSweep: true,
  });

  assert.deepEqual(snapshot, {
    showRules: false,
    tutorialStep: 0,
    wildFor: { id: "wild", cardType: "wild", color: "wild", value: "wild" },
    cardAlert: "SKIP!",
    turnBanner: { name: "Test", subtitle: "Thinking...", emoji: "🃏", themeColor: "gold" },
    showReverseSweep: true,
  });
});

test("closing the tutorial marks it inactive", () => {
  const snapshot = getCloseTutorialSnapshot({
    showRules: true,
    tutorialStep: 3,
    wildFor: null,
    cardAlert: null,
    turnBanner: null,
    showReverseSweep: false,
  });

  assert.deepEqual(snapshot, {
    showRules: true,
    tutorialStep: -1,
    wildFor: null,
    cardAlert: null,
    turnBanner: null,
    showReverseSweep: false,
  });
});

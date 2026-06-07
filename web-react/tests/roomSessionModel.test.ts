import assert from "node:assert/strict";
import test from "node:test";
import {
  getJoinErrorMessage,
  getRoomCommandFailureToast,
  getRoomActionToast,
  isNormalCloseCode,
  snapshotRoomState,
} from "../src/hooks/roomSessionModel.ts";
import type { UnoState } from "../src/gameTypes.ts";

test("snapshotRoomState preserves schema-backed collection data", () => {
  const players = new Map([
    [
      "a",
      {
        sessionId: "a",
        seatIndex: 0,
        name: "Player 1",
        isBot: false,
        connected: true,
        handCount: 4,
      },
    ],
    [
      "b",
      {
        sessionId: "b",
        seatIndex: 3,
        name: "Bot 4",
        isBot: true,
        connected: false,
        handCount: 7,
      },
    ],
  ]) as unknown as UnoState["players"];

  const discardPile = new Map([
    [
      "card-1",
      { id: "card-1", cardType: "color", color: "red", value: "9" },
    ],
  ]) as unknown as UnoState["discardPile"];

  const chatMessages = new Map([
    [
      "msg-1",
      { id: "msg-1", sender: "Player 1", text: "Hello", timestamp: 1 },
    ],
  ]) as unknown as UnoState["chatMessages"];

  const rematchVotes = new Map([
    ["vote-1", 2],
  ]) as unknown as UnoState["rematchVotes"];

  const next = snapshotRoomState({
    players,
    discardPile,
    drawPileCount: 12,
    deckCount: 24,
    currentPlayer: 3,
    direction: -1,
    activeColor: "blue",
    pendingDraw: 4,
    winner: -1,
    phase: "playing",
    spectatorCount: 1,
    chatMessages,
    unoCaller: 0,
    rematchVotes,
    turnDeadline: 12345,
  });

  assert.equal(next.players?.["0"]?.name, "Player 1");
  assert.equal(next.players?.["3"]?.isBot, true);
  assert.equal(next.discardPile?.[0]?.id, "card-1");
  assert.equal(next.chatMessages?.[0]?.id, "msg-1");
  assert.deepEqual(next.rematchVotes, [2]);
  assert.equal(next.turnDeadline, 12345);
});

test("snapshotRoomState fills controller defaults for missing fields", () => {
  const next = snapshotRoomState({} as UnoState);

  assert.deepEqual(next.players, {});
  assert.deepEqual(next.discardPile, []);
  assert.equal(next.drawPileCount, 0);
  assert.equal(next.deckCount, 0);
  assert.equal(next.currentPlayer, -1);
  assert.equal(next.direction, 1);
  assert.equal(next.activeColor, "red");
  assert.equal(next.pendingDraw, 0);
  assert.equal(next.winner, -1);
  assert.equal(next.phase, "waiting");
  assert.equal(next.spectatorCount, 0);
  assert.deepEqual(next.chatMessages, []);
  assert.equal(next.unoCaller, -1);
  assert.deepEqual(next.rematchVotes, []);
  assert.equal(next.turnDeadline, 0);
});

test("getJoinErrorMessage classifies common room errors", () => {
  assert.equal(
    getJoinErrorMessage({ code: 1, message: "not found" }),
    "Room not found. Check the invite code and try again.",
  );
  assert.equal(
    getJoinErrorMessage({ code: 2, message: "full" }),
    "Room is full. The table already has the maximum number of players.",
  );
  assert.equal(
    getJoinErrorMessage({ code: 3, message: "invalid password" }),
    "Wrong password. Please check the room password and try again.",
  );
  assert.equal(
    getJoinErrorMessage(new Error("WebSocket failed")),
    "Server unreachable. Make sure the game server is running.",
  );
  assert.equal(
    getJoinErrorMessage(new Error("NO SUCH ROOM")),
    "Room not found. Check the invite code and try again.",
  );
});

test("isNormalCloseCode classifies standard room closures", () => {
  assert.equal(isNormalCloseCode(1000), true);
  assert.equal(isNormalCloseCode(1001), true);
  assert.equal(isNormalCloseCode(1006), false);
});

test("getRoomActionToast turns server action errors into user-friendly toasts", () => {
  assert.deepEqual(getRoomActionToast({ code: "RATE_LIMITED" }), {
    message: "You're tapping too fast. Try again in a moment.",
    kind: "warning",
  });
  assert.deepEqual(getRoomActionToast({ code: "INTERNAL_ERROR" }), {
    message: "Something went wrong. Try again.",
    kind: "error",
  });
  assert.deepEqual(getRoomActionToast({ message: "Custom failure" }), {
    message: "Custom failure",
    kind: "warning",
  });
});

test("getRoomCommandFailureToast returns a generic transport failure toast", () => {
  assert.deepEqual(getRoomCommandFailureToast(), {
    message: "Could not send that action. Check your connection.",
    kind: "warning",
  });
});

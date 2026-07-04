import assert from "node:assert/strict";
import test from "node:test";
import {
  getRoomDisconnectMessage,
  getRoomJoinErrorMessage,
  isNormalRoomClose,
} from "../src/connectionFeedback.ts";

// Colyseus HTTP match-making error codes — must stay aligned with
// @colyseus/shared-types ErrorCode values.
const COLYSEUS_ERROR = {
  NO_HANDLER: 520,
  INVALID_CRITERIA: 521,
  INVALID_ROOM_ID: 522,
  UNHANDLED: 523,
  EXPIRED: 524,
  AUTH_FAILED: 525,
  APPLICATION_ERROR: 526,
  INVALID_PAYLOAD: 4217,
} as const;

test("getRoomJoinErrorMessage maps Colyseus error codes to user-facing copy", () => {
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.INVALID_ROOM_ID, message: 'room "abc" not found' }),
    "Room not found. Check the invite code and try again.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.INVALID_ROOM_ID, message: 'room "abc" is locked' }),
    "Room is locked. The host is restarting the table.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.INVALID_CRITERIA, message: "no rooms found with provided criteria" }),
    "Room is full. The table already has the maximum number of players.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.APPLICATION_ERROR, message: "Invalid password" }),
    "Wrong password. Please check the room password and try again.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.APPLICATION_ERROR, message: "Rate limited" }),
    "Too many join attempts. Wait a moment and try again.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.NO_HANDLER, message: "provided room name not defined" }),
    "Game server is missing the required table type. Try restarting the server.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.AUTH_FAILED, message: "rejected" }),
    "This table rejected the join request.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.EXPIRED, message: "seat reservation expired" }),
    "Your invite expired. Refresh and try joining again.",
  );
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.INVALID_PAYLOAD, message: "bad payload" }),
    "The join request was rejected by the server. Refresh and try again.",
  );
});

test("getRoomJoinErrorMessage reports network failures as server unreachable", () => {
  assert.equal(
    getRoomJoinErrorMessage(new Error("Failed to fetch")),
    "Server unreachable. Make sure the game server is running.",
  );
  assert.equal(
    getRoomJoinErrorMessage(new Error("WebSocket connection to ws://localhost:2567 failed")),
    "Server unreachable. Make sure the game server is running.",
  );
  assert.equal(
    getRoomJoinErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:2567")),
    "Server unreachable. Make sure the game server is running.",
  );
});

test("getRoomJoinErrorMessage falls back to the original error message", () => {
  assert.equal(getRoomJoinErrorMessage(new Error("Unexpected failure")), "Could not join the room: Unexpected failure");
  // Application-level errors without a known shape still surface their message.
  assert.equal(
    getRoomJoinErrorMessage({ code: COLYSEUS_ERROR.APPLICATION_ERROR, message: "Server is restarting" }),
    "Could not join the room: Server is restarting",
  );
});

test("isNormalRoomClose treats 1000 and 1001 as normal closures", () => {
  assert.equal(isNormalRoomClose(1000), true);
  assert.equal(isNormalRoomClose(1001), true);
  assert.equal(isNormalRoomClose(1006), false);
  assert.equal(isNormalRoomClose(null), false);
  assert.equal(isNormalRoomClose(undefined), false);
});

test("getRoomDisconnectMessage only reports abnormal disconnects", () => {
  assert.equal(getRoomDisconnectMessage(1000), null);
  assert.equal(getRoomDisconnectMessage(1001), null);
  assert.equal(getRoomDisconnectMessage(4000), "Connection lost. You were returned to the lobby.");
  assert.equal(getRoomDisconnectMessage(undefined), "Connection lost. You were returned to the lobby.");
});
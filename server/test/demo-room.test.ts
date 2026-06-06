import { describe, expect, it, vi } from "vitest";
import { DemoRoom } from "../src/rooms/DemoRoom.ts";
import {
  pickBestCard,
  pickBestCardSchema,
  pickBestColor,
  pickBestColorSchema,
} from "@repo/server-game";

describe("DemoRoom lifecycle", () => {
  it("auto-plays a drawn card that matches the top card by value", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      drawPile: [{ type: "color", color: "blue", value: "skip", id: "drawn-blue-skip" }],
      hands: [[{ type: "color", color: "yellow", value: "5", id: "yellow-5" }], [], [], []],
      discardPile: [{ type: "color", color: "red", value: "skip", id: "top-red-skip" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: null,
    };
    room["gameStarted"] = true;
    room["paused"] = true;
    room["syncState"]();

    room["tick"]();

    expect(room["currentState"].hands[0]).toHaveLength(1);
    expect(room["currentState"].discardPile.at(-1)?.id).toBe("drawn-blue-skip");
    expect(room["currentState"].currentPlayer).toBe(2);

    room.onDispose();
  });

  it("applies the effect of a drawn card that is played immediately", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      drawPile: [{ type: "color", color: "red", value: "skip", id: "drawn-red-skip" }],
      hands: [[{ type: "color", color: "blue", value: "5", id: "blue-5" }], [], [], []],
      discardPile: [{ type: "color", color: "red", value: "1", id: "top-red-1" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: null,
    };
    room["gameStarted"] = true;
    room["paused"] = true;
    room["syncState"]();

    room["tick"]();

    expect(room["currentState"].hands[0]).toHaveLength(1);
    expect(room["currentState"].discardPile.at(-1)?.id).toBe("drawn-red-skip");
    expect(room["currentState"].currentPlayer).toBe(2);
    expect(room.state.turnHistory.at(-1)?.player).toBe(0);

    room.onDispose();
  });

  it("removes a drawn card from the hand when it is played immediately", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      drawPile: [{ type: "color", color: "red", value: "7", id: "drawn-red-7" }],
      hands: [[{ type: "color", color: "blue", value: "5", id: "blue-5" }], [], [], []],
      discardPile: [{ type: "color", color: "green", value: "1", id: "top-green-1" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: null,
    };
    room["gameStarted"] = true;
    room["paused"] = true;
    room["syncState"]();

    room["tick"]();

    expect(room["currentState"].hands[0]).toHaveLength(1);
    expect(room["currentState"].hands[0][0].id).toBe("blue-5");
    expect(room["currentState"].discardPile.at(-1)?.id).toBe("drawn-red-7");

    room.onDispose();
  });

  it("starts a game without dereferencing an uninitialized current state", () => {
    const room = new DemoRoom();
    room.onCreate();

    expect(() => room["startGame"]()).not.toThrow();
    expect(room["gameStarted"]).toBe(true);
    expect(room["paused"]).toBe(false);
    expect(room["currentState"].hands).toHaveLength(4);
    expect(room["currentState"].hands.every((hand: unknown[]) => hand.length === 7)).toBe(true);

    room.onDispose();
  });

  it("clears an existing tick timer before scheduling a new one", () => {
    const room = new DemoRoom();
    room.onCreate();

    const previousTimer = setTimeout(() => {}, 1000);
    room["tickTimer"] = previousTimer;
    room["gameStarted"] = true;

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    room["scheduleTick"]();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(previousTimer);

    clearTimeoutSpy.mockRestore();
    room.onDispose();
  });

  it("clears the scheduled tick timer when disposed", () => {
    const room = new DemoRoom();
    room.onCreate();

    const timer = setTimeout(() => {}, 1000);
    room["tickTimer"] = timer;

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    room.onDispose();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);

    clearTimeoutSpy.mockRestore();
  });

  it("prevents future scheduling after dispose", () => {
    const room = new DemoRoom();
    room.onCreate();

    room.onDispose();

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    room["scheduleTick"]();

    expect(setTimeoutSpy).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });

  it("ignores resume and step commands before a game starts", () => {
    const room = new DemoRoom();
    room.onCreate();

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    expect(() => room["resumeGame"]()).not.toThrow();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(() => room["stepOnce"]()).not.toThrow();

    setTimeoutSpy.mockRestore();
    room.onDispose();
  });

  it("ignores resume after the game has finished", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["gameStarted"] = true;
    room["paused"] = true;
    room["currentState"] = {
      drawPile: [],
      hands: [[], [], [], []],
      discardPile: [{ type: "color", color: "red", value: "5", id: "top" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: 1,
    };

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    room["resumeGame"]();

    expect(setTimeoutSpy).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
    room.onDispose();
  });

  it("ignores invalid speed values", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["setTickSpeed"](NaN);
    expect(room["tickMs"]).toBe(1000);
    expect(room.state.demo.tickMs).toBe(1000);

    room["setTickSpeed"](-50);
    expect(room["tickMs"]).toBe(1000);
    expect(room.state.demo.tickMs).toBe(1000);

    room.onDispose();
  });

  it("prefers action cards over number cards when choosing a play", () => {
    const actionCard = { type: "color", color: "red", value: "skip", id: "skip" } as const;
    const numberCard = { type: "color", color: "red", value: "5", id: "number" } as const;

    expect(pickBestCard([numberCard, actionCard], "red").id).toBe("skip");
  });

  it("prefers number cards over wild cards when no matching color card exists", () => {
    const wildCard = { type: "wild", wildType: "wild", value: "wild", id: "wild" } as const;
    const numberCard = { type: "color", color: "blue", value: "5", id: "number" } as const;

    expect(pickBestCard([numberCard, wildCard], "red").id).toBe("number");
  });

  it("chooses the most common color for wild cards", () => {
    const hand = [
      { type: "color", color: "red", value: "1", id: "red-1" },
      { type: "color", color: "blue", value: "2", id: "blue-2" },
      { type: "color", color: "blue", value: "3", id: "blue-3" },
      { type: "wild", wildType: "wild", chosenColor: null, id: "wild" },
    ] as const;

    expect(pickBestColor(hand)).toBe("blue");
  });

  it("chooses the most common color for schema wild cards", () => {
    const hand = [
      { cardType: "color", color: "red", value: "1", id: "red-1" },
      { cardType: "color", color: "blue", value: "2", id: "blue-2" },
      { cardType: "color", color: "blue", value: "3", id: "blue-3" },
      { cardType: "wild", color: "", value: "wild", id: "wild" },
    ] as const;

    expect(pickBestColorSchema(hand, undefined)).toBe("blue");
  });

  it("falls back to wild cards when no number cards exist", () => {
    const wildCard = { type: "wild", wildType: "wild", value: "wild", id: "wild" } as const;

    expect(pickBestCard([wildCard], "red").id).toBe("wild");
  });

  it("selects schema cards using the same priority rules", () => {
    const hand = [
      { cardType: "color", color: "red", value: "5", id: "number" },
      { cardType: "color", color: "red", value: "skip", id: "skip" },
      { cardType: "wild", color: "", value: "wild", id: "wild" },
    ] as const;

    expect(pickBestCardSchema([0, 1, 2], hand, "red")).toBe(1);
  });
});

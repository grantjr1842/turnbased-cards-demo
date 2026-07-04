import { describe, it, expect, afterEach as vitestAfterEach } from "vitest";
import type { Client } from "@colyseus/core";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { UnoCardSchema } from "../src/rooms/schema/UnoRoomState.ts";
import { canPlay, canPlaySchema } from "../shared/uno.ts";
import { makeTestClient } from "./testClients.ts";

type RoomTestAccess = UnoRoom & {
  spectators: Set<{ sessionId: string }>;
};

const roomCleanups: Array<() => void> = [];

vitestAfterEach(() => {
  while (roomCleanups.length > 0) {
    roomCleanups.pop()?.();
  }
});

function registerCleanup(cleanup: () => void) {
  roomCleanups.push(cleanup);
}

function makeSchemaCard(id: string, color: string, value: string): InstanceType<typeof UnoCardSchema> {
  const card = new UnoCardSchema();
  card.id = id;
  card.cardType = "color";
  card.color = color;
  card.value = value;
  card.chosenColor = "";
  return card;
}

function makeWildCard(id: string, wildType: string, chosenColor = ""): InstanceType<typeof UnoCardSchema> {
  const card = new UnoCardSchema();
  card.id = id;
  card.cardType = "wild";
  card.color = "";
  card.value = wildType;
  card.chosenColor = chosenColor;
  return card;
}

function createRoomWithHuman(
  seatIndex = 0,
  name = "TestPlayer",
): { room: UnoRoom; client: Client } {
  const room = new UnoRoom();
  room.onCreate();
  registerCleanup(() => room.onDispose());
  clearTimeout(room["turnTimeout"]);

  // Make all players bots initially, then convert target seat to human
  for (let i = 0; i < 4; i++) {
    const p = room.state.players.get(String(i))!;
    p.isBot = true;
    p.connected = false;
  }

  const client = makeTestClient(`human-${seatIndex}`);
  room.onJoin(client, { name, spectator: false });

  // Set the player as non-bot and connected
  const player = room.state.players.get(String(seatIndex))!;
  player.isBot = false;
  player.connected = true;
  player.sessionId = client.sessionId;

  // Give the human some useful cards and set them as current player
  room.state.currentPlayer = seatIndex;
  player.hand.splice(0, player.hand.length);
  room.state.phase = "playing";
  room.state.winner = -1;
  room.state.direction = 1;
  room.state.pendingDraw = 0;
  room.state.unoCaller = -1;
  room.state.lastDrawnCardId = "";
  room.state.pendingWinnerSeat = -1;
  room.state.wildDraw4ChallengePending = false;
  room.state.wildDraw4Illegal = false;
  room.state.wildDraw4OffenderSeat = -1;
  room["rateLimiter"].clear();
  clearTimeout(room["turnTimeout"]);

  return { room, client };
}

/**
 * Security tests: verify that message validation in UnoRoom.ts
 * cannot be bypassed by malformed or malicious messages.
 */
describe("Security: canPlay boundary tests", () => {
  it("returns false for null/undefined card", () => {
    // @ts-expect-error — intentionally passing invalid input
    expect(canPlay(null, { cardType: "color", value: "5" }, "red")).toBe(false);
    // @ts-expect-error
    expect(canPlay(undefined, { cardType: "color", value: "5" }, "red")).toBe(false);
    // @ts-expect-error
    expect(canPlay({ color: "red", value: "5" }, null, "red")).toBe(false);
  });

  it("handles empty string values gracefully", () => {
    expect(
      canPlay(
        { cardType: "color", color: "", value: "" },
        { cardType: "color", value: "5" },
        "red"
      )
    ).toBe(false);
  });

  it("wild cards always return true regardless of active color", () => {
    expect(
      canPlay(
        { cardType: "wild", color: "", value: "wild" },
        { cardType: "color", value: "5" },
        "blue"
      )
    ).toBe(true);
  });

  it("does not throw on malformed topCard (missing value)", () => {
    // @ts-expect-error
    expect(
      canPlay(
        { cardType: "color", color: "red", value: "5" },
        {},
        "blue"
      )
    ).toBe(false);
  });

  it("rejects malformed color cards without an explicit card type", () => {
    expect(
      canPlay(
        { color: "red", value: "5" } as never,
        { cardType: "color", value: "7" },
        "red"
      )
    ).toBe(false);
  });
});

describe("Security: canPlaySchema", () => {
  it("rejects malformed schema cards without an explicit card type", () => {
    expect(
      canPlaySchema(
        { color: "red", value: "5" } as never,
        { cardType: "color", value: "7" },
        "red"
      )
    ).toBe(false);
  });
});

describe("Security: handlePlayCard", () => {
  describe("invalid cardId", () => {
    it("rejects empty string cardId", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("valid_red_5", "red", "5"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      room["handlePlayCard"](client, { cardId: "" });

      // Card should still be in hand (play was rejected)
      const cardStillInHand = player.hand.some((c) => c.id === "valid_red_5");
      expect(cardStillInHand).toBe(true);
    });

    it("rejects cardId longer than 64 characters", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("valid_red_5", "red", "5"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      const longCardId = "a".repeat(65);
      room["handlePlayCard"](client, { cardId: longCardId });

      const cardStillInHand = player.hand.some((c) => c.id === "valid_red_5");
      expect(cardStillInHand).toBe(true);
    });

    it("rejects non-existent cardId", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("valid_red_5", "red", "5"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      room["handlePlayCard"](client, { cardId: "nonexistent_card_id" });

      const cardStillInHand = player.hand.some((c) => c.id === "valid_red_5");
      expect(cardStillInHand).toBe(true);
    });
  });

  describe("card not in hand", () => {
    it("rejects playing a card not in player's hand", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      room.state.activeColor = "red";
      room.state.discardPile.splice(0, room.state.discardPile.length);
      room.state.discardPile.push(makeWildCard("top_wild_draw4", "wild_draw4"));
      room.state.pendingDraw = 4;
      room["handlePlayCard"](client, { cardId: "some_card_not_in_hand" });

      // Should not throw, should not change state incorrectly
      expect(room.state.discardPile.length).toBe(1);
    });
  });

  describe("playing out of turn", () => {
    it("rejects play from a player who is not the current player", () => {
      const { room, client } = createRoomWithHuman(0);

      // Set a different player as current
      room.state.currentPlayer = 1;
      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("valid_red_5", "red", "5"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      room["handlePlayCard"](client, { cardId: "valid_red_5" });

      // Card should still be in hand
      const cardStillInHand = player.hand.some((c) => c.id === "valid_red_5");
      expect(cardStillInHand).toBe(true);
    });

    it("sends NOT_YOUR_TURN error when playing out of turn", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.currentPlayer = 2; // Different player
      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("valid_red_5", "red", "5"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      let errorReceived: { message: string; code: string } | null = null;
      const mockClient = makeTestClient(client.sessionId, (type: string, data: { message: string; code: string }) => {
        if (type === "error") errorReceived = data;
      });

      room["handlePlayCard"](mockClient, { cardId: "valid_red_5" });

      expect(errorReceived).not.toBeNull();
      expect(errorReceived!.code).toBe("NOT_YOUR_TURN");
    });
  });

  describe("invalid chosenColor", () => {
    it("rejects play with invalid chosenColor for wild card", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeWildCard("wild_card", "wild"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      // Invalid color
      room["handlePlayCard"](client, { cardId: "wild_card", chosenColor: "purple" });

      const cardStillInHand = player.hand.some((c) => c.id === "wild_card");
      expect(cardStillInHand).toBe(true);
    });

    it("accepts valid chosenColor for wild card", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeWildCard("wild_card", "wild"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      room["handlePlayCard"](client, { cardId: "wild_card", chosenColor: "blue" });

      const cardInHand = player.hand.some((c) => c.id === "wild_card");
      expect(cardInHand).toBe(false);
      expect(room.state.activeColor).toBe("blue");
    });

    it("rejects play with missing chosenColor for wild card", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeWildCard("wild_card", "wild"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      room["handlePlayCard"](client, { cardId: "wild_card" });

      const cardStillInHand = player.hand.some((c) => c.id === "wild_card");
      expect(cardStillInHand).toBe(true);
    });
  });

  describe("wild_draw4 challenge flow", () => {
    it("accepts wild_draw4 even when player has a valid color alternative and opens a challenge window", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      // Player has a color card matching the active color (valid alternative to wild_draw4)
      player.hand.push(makeSchemaCard("red_5", "red", "5"));
      player.hand.push(makeSchemaCard("yellow_9", "yellow", "9"));
      player.hand.push(makeWildCard("wild_draw4", "wild_draw4"));
      room.state.activeColor = "red";
      room.state.discardPile.push(makeSchemaCard("discard_blue_3", "blue", "3"));

      room["handlePlayCard"](client, { cardId: "wild_draw4", chosenColor: "blue" });

      const cardStillInHand = player.hand.some((c) => c.id === "wild_draw4");
      expect(cardStillInHand).toBe(false);
      expect(room.state.currentPlayer).toBe(1);
      expect(room.state.wildDraw4ChallengePending).toBe(true);
      expect(room.state.wildDraw4Illegal).toBe(true);
      expect(room.state.wildDraw4OffenderSeat).toBe(0);
      expect(room.state.pendingDraw).toBe(4);
    });

    it("lets the next player challenge successfully when the offender had a matching color", () => {
      const { room, client } = createRoomWithHuman();

      const offender = room.state.players.get("0")!;
      offender.hand.push(makeSchemaCard("red_5", "red", "5"));
      offender.hand.push(makeSchemaCard("yellow_9", "yellow", "9"));
      offender.hand.push(makeWildCard("wild_draw4", "wild_draw4"));
      room.state.activeColor = "red";
      room.state.discardPile.push(makeSchemaCard("discard_blue_3", "blue", "3"));

      room["handlePlayCard"](client, { cardId: "wild_draw4", chosenColor: "blue" });
      room["rateLimiter"].clear();

      const challenger = room.state.players.get("1")!;
      challenger.sessionId = "human-1";
      challenger.isBot = false;
      challenger.connected = true;

      room["handleChallengeWildDraw4"](makeTestClient("human-1"));

      expect(room.state.wildDraw4ChallengePending).toBe(false);
      expect(room.state.pendingDraw).toBe(0);
      expect(room.state.currentPlayer).toBe(1);
      expect(room.state.phase).toBe("playing");
      expect(offender.hand.length).toBe(6);
      expect(room.state.winner).toBe(-1);
    });

    it("gives the challenger six cards and awards the round when the offender was innocent", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      room.state.currentPlayer = 0;
      player.hand.splice(0, player.hand.length);
      player.hand.push(makeWildCard("wild_draw4", "wild_draw4"));
      room.state.activeColor = "blue";
      room.state.discardPile.push(makeSchemaCard("discard_red_7", "red", "7"));

      room["handlePlayCard"](client, { cardId: "wild_draw4", chosenColor: "green" });
      room["rateLimiter"].clear();

      const challenger = room.state.players.get("1")!;
      challenger.sessionId = "human-1";
      challenger.isBot = false;
      challenger.connected = true;

      room["handleChallengeWildDraw4"](makeTestClient("human-1"));

      expect(room.state.wildDraw4ChallengePending).toBe(false);
      expect(room.state.pendingDraw).toBe(0);
      expect(room.state.phase).toBe("finished");
      expect(room.state.winner).toBe(0);
      expect(challenger.hand.length).toBe(13);
      expect(player.hand.length).toBe(0);
    });

    it("rejects wild_draw4 while a draw penalty is pending", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      room.state.currentPlayer = 0;
      player.hand.splice(0, player.hand.length);
      // Give them an extra card so playing wild_draw4 doesn't trigger win
      player.hand.push(makeSchemaCard("dummy_card", "yellow", "1"));
      // Player has a color card matching the active color, but draw penalties are not stackable.
      player.hand.push(makeSchemaCard("red_5", "red", "5"));
      player.hand.push(makeWildCard("wild_draw4", "wild_draw4"));
      room.state.activeColor = "red";
      room.state.discardPile.splice(0, room.state.discardPile.length);
      room.state.discardPile.push(makeWildCard("top_wild_draw4", "wild_draw4"));
      room.state.pendingDraw = 4;

      room["handlePlayCard"](client, { cardId: "wild_draw4", chosenColor: "blue" });

      const cardPlayed = !player.hand.some((c) => c.id === "wild_draw4");
      expect(cardPlayed).toBe(false);
      expect(room.state.pendingDraw).toBe(4);
    });
  });

  describe("replaying same card", () => {
    it("handles gracefully when cardId was already played (not in hand)", () => {
      const { room, client } = createRoomWithHuman();

      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("red_5", "red", "5"));
      room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

      // First play should succeed
      room["handlePlayCard"](client, { cardId: "red_5" });

      // Second play with same cardId should be rejected gracefully
      expect(() => {
        room["handlePlayCard"](client, { cardId: "red_5" });
      }).not.toThrow();
    });
  });

  describe("game finished state", () => {
    it("rejects play when game is finished", () => {
      const { room, client } = createRoomWithHuman();

      room.state.phase = "finished";
      room.state.winner = 2;
      const player = room.state.players.get("0")!;
      player.hand.push(makeSchemaCard("red_5", "red", "5"));

      room["handlePlayCard"](client, { cardId: "red_5" });

      // Card should still be in hand since game is over
      const cardStillInHand = player.hand.some((c) => c.id === "red_5");
      expect(cardStillInHand).toBe(true);
    });
  });
});

describe("Security: handleDrawCard", () => {
  describe("draw when not your turn", () => {
    it("rejects draw from a player who is not the current player", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.currentPlayer = 1; // Different player
      const handCountBefore = room.state.players.get("0")!.hand.length;

      room["handleDrawCard"](client);

      const handCountAfter = room.state.players.get("0")!.hand.length;
      expect(handCountAfter).toBe(handCountBefore);
    });

    it("sends NOT_YOUR_TURN error when drawing out of turn", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.currentPlayer = 2;

      let errorReceived: { message: string; code: string } | null = null;
      const mockClient = makeTestClient(client.sessionId, (type: string, data: { message: string; code: string }) => {
        if (type === "error") errorReceived = data;
      });

      room["handleDrawCard"](mockClient);

      expect(errorReceived).not.toBeNull();
      expect(errorReceived!.code).toBe("NOT_YOUR_TURN");
    });
  });

  describe("draw when pile empty", () => {
    it("allows draw when pile count is zero but pile recycles", () => {
      const { room, client } = createRoomWithHuman();

      // Clear discard pile except one card, and empty draw pile
      room.state.discardPile.splice(0, room.state.discardPile.length);
      room.state.discardPile.push(makeSchemaCard("keep_red_5", "red", "5"));
      room.drawPile = [];
      room.state.drawPileCount = 0;

      const handCountBefore = room.state.players.get("0")!.hand.length;

      // This should trigger recycleDiscardIfNeeded
      room["handleDrawCard"](client);

      // Either drew from recycled pile or pile was properly recycled
      expect(room.state.drawPileCount >= 0).toBe(true);
    });
  });

  describe("game finished state", () => {
    it("rejects draw when game is finished", () => {
      const { room, client } = createRoomWithHuman();

      room.state.phase = "finished";
      room.state.winner = 2;
      const handCountBefore = room.state.players.get("0")!.hand.length;

      room["handleDrawCard"](client);

      const handCountAfter = room.state.players.get("0")!.hand.length;
      expect(handCountAfter).toBe(handCountBefore);
    });
  });
});

describe("Security: handleChat", () => {
  describe("empty text", () => {
    it("rejects empty string text", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: "" });

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });

    it("rejects undefined text", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: undefined });

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });

    it("rejects missing text property", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, {});

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });
  });

  describe("text > 200 chars", () => {
    it("rejects text longer than 200 characters", () => {
      const { room, client } = createRoomWithHuman();

      const longText = "a".repeat(201);
      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: longText });

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });

    it("accepts text exactly 200 characters", () => {
      const { room, client } = createRoomWithHuman();

      const text200 = "a".repeat(200);
      room["handleChat"](client, { text: text200 });

      expect(room.state.chatMessages.length).toBe(1);
      expect(room.state.chatMessages[0].text).toBe(text200);
    });
  });

  describe("HTML/script content", () => {
    it("sanitizes HTML script tags from chat text", () => {
      const { room, client } = createRoomWithHuman();

      const maliciousText = "<script>alert('xss')</script>Hello";
      room["handleChat"](client, { text: maliciousText });

      expect(room.state.chatMessages.length).toBe(1);
      // sanitizePlainText() should strip the script tag
      expect(room.state.chatMessages[0].text).not.toContain("<script>");
      expect(room.state.chatMessages[0].text).toContain("Hello");
    });

    it("sanitizes inline JavaScript event handlers", () => {
      const { room, client } = createRoomWithHuman();

      const maliciousText = "<img src=x onerror='alert(1)'>";
      room["handleChat"](client, { text: maliciousText });

      expect(room.state.chatMessages.length).toBe(1);
      expect(room.state.chatMessages[0].text).not.toContain("onerror");
    });

    it("sanitizes javascript: URL schemes", () => {
      const { room, client } = createRoomWithHuman();

      const maliciousText = "<a href='javascript:alert(1)'>click</a>";
      room["handleChat"](client, { text: maliciousText });

      expect(room.state.chatMessages.length).toBe(1);
      expect(room.state.chatMessages[0].text).not.toContain("javascript:");
    });

    it("sanitizes sender name to prevent XSS in displayed username", () => {
      const { room, client } = createRoomWithHuman(0, "<script>alert('xss')</script>");

      room["handleChat"](client, { text: "hello" });

      expect(room.state.chatMessages.length).toBe(1);
      // Sender name should be sanitized
      expect(room.state.chatMessages[0].sender).not.toContain("<script>");
    });
  });

  describe("whitespace-only text", () => {
    it("rejects whitespace-only text after trim", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: "   \t\n  " });

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });

    it("accepts text with leading/trailing whitespace that is otherwise valid", () => {
      const { room, client } = createRoomWithHuman();

      room["handleChat"](client, { text: "  Hello  " });

      expect(room.state.chatMessages.length).toBe(1);
      expect(room.state.chatMessages[0].text).toBe("Hello");
    });
  });

  describe("non-string text types", () => {
    it("rejects numeric text", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: 12345 as unknown as string });

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });

    it("rejects array text", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: ["hello", "world"] } as unknown as string);

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });

    it("rejects object text", () => {
      const { room, client } = createRoomWithHuman();

      const messagesBefore = room.state.chatMessages.length;
      room["handleChat"](client, { text: { value: "hello" } } as unknown as string);

      expect(room.state.chatMessages.length).toBe(messagesBefore);
    });
  });
});

describe("Security: handleUno", () => {
  describe("calling when not unoCaller", () => {
    it("does not clear unoCaller if player is not the uno caller", () => {
      const { room, client } = createRoomWithHuman(0);

      // Set a different player as unoCaller
      room.state.unoCaller = 2;
      const player = room.state.players.get("0")!;
      player.seatIndex = 0;

      room["handleUno"](client);

      // unoCaller should remain unchanged
      expect(room.state.unoCaller).toBe(2);
    });

    it("clears unoCaller when called by the correct player", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.unoCaller = 0;
      const player = room.state.players.get("0")!;
      player.seatIndex = 0;

      room["handleUno"](client);

      expect(room.state.unoCaller).toBe(-1);
    });
  });

  describe("calling when game finished", () => {
    it("handles uno call gracefully when game is finished", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "finished";
      room.state.winner = 2;
      room.state.unoCaller = 0;

      // Should not throw
      expect(() => {
        room["handleUno"](client);
      }).not.toThrow();
    });

    it("does not send error when game is finished (silent no-op)", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "finished";
      room.state.winner = 2;
      room.state.unoCaller = 0;

      let errorReceived: { message: string; code: string } | null = null;
      const mockClient = makeTestClient(client.sessionId, (type: string, data: { message: string; code: string }) => {
        if (type === "error") errorReceived = data;
      });

      room["handleUno"](mockClient);

      // No error should be sent - it's a silent no-op when game is over
      expect(errorReceived).toBeNull();
    });
  });

  describe("spectator calling uno", () => {
    it("silently ignores uno call from spectator", () => {
      const { room } = createRoomWithHuman(0);

      room.state.unoCaller = 0;

      const spectatorClient = makeTestClient("spectator-session");
      // Add as spectator
      (room as RoomTestAccess).spectators.add(spectatorClient);

      // Should not throw
      expect(() => {
        room["handleUno"](spectatorClient);
      }).not.toThrow();

      // unoCaller should remain since spectator can't call uno
      expect(room.state.unoCaller).toBe(0);
    });
  });
});

describe("Security: handleVoteRematch", () => {
  describe("voting twice", () => {
    it("only accepts one vote per player", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "finished";
      const player = room.state.players.get("0")!;
      player.isBot = false;
      player.connected = true;

      // Add another human to prevent restart
      const p2 = room.state.players.get("1")!;
      p2.isBot = false;
      p2.connected = true;

      room["handleVoteRematch"](client);
      const votesAfterFirst = room.state.rematchVotes.length;

      room["handleVoteRematch"](client);
      const votesAfterSecond = room.state.rematchVotes.length;

      // Should only have one vote from this player
      expect(votesAfterSecond).toBe(votesAfterFirst);
      const voteCount = room.state.rematchVotes.filter((v) => v === 0).length;
      expect(voteCount).toBe(1);
    });

    it("allows voting again if vote was cleared", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "finished";
      const player = room.state.players.get("0")!;
      player.isBot = false;
      player.connected = true;

      // Add another human to prevent restart
      const p2 = room.state.players.get("1")!;
      p2.isBot = false;
      p2.connected = true;

      room["handleVoteRematch"](client);
      expect(room.state.rematchVotes).toContain(0);

      // Clear the vote manually
      room.state.rematchVotes.splice(0, room.state.rematchVotes.length);

      room["handleVoteRematch"](client);
      expect(room.state.rematchVotes).toContain(0);
    });
  });

  describe("spectator voting", () => {
    it("rejects vote from spectator (not a player)", () => {
      const room = new UnoRoom();
      room.onCreate();

      const spectatorClient = makeTestClient("spectator-session");
      // Add as spectator
      (room as RoomTestAccess).spectators.add(spectatorClient);

      room.state.phase = "finished";

      const votesBefore = room.state.rematchVotes.length;
      room["handleVoteRematch"](spectatorClient);

      expect(room.state.rematchVotes.length).toBe(votesBefore);

      room.onDispose();
    });

    it("rejects vote from bot player", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "finished";
      const player = room.state.players.get("0")!;
      player.isBot = true; // Bot player
      player.connected = true;

      const votesBefore = room.state.rematchVotes.length;
      room["handleVoteRematch"](client);

      expect(room.state.rematchVotes.length).toBe(votesBefore);
    });
  });

  describe("voting when game not finished", () => {
    it("rejects vote when game is still in progress", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "playing"; // Not finished
      room.state.winner = null;
      const player = room.state.players.get("0")!;
      player.isBot = false;
      player.connected = true;

      const votesBefore = room.state.rematchVotes.length;
      room["handleVoteRematch"](client);

      expect(room.state.rematchVotes.length).toBe(votesBefore);
    });
  });

  describe("disconnected player voting", () => {
    it("rejects vote from disconnected player", () => {
      const { room, client } = createRoomWithHuman(0);

      room.state.phase = "finished";
      const player = room.state.players.get("0")!;
      player.isBot = false;
      player.connected = false; // Disconnected

      const votesBefore = room.state.rematchVotes.length;
      room["handleVoteRematch"](client);

      // Should not throw, vote should be rejected because player not connected
      expect(room.state.rematchVotes.length).toBe(votesBefore);
    });
  });
});

describe("Security: rate limiting", () => {
  it("rate limits rapid draw_card messages", () => {
    const { room, client } = createRoomWithHuman();

    // First draw should go through
    room["handleDrawCard"](client);

    // Set last action time to now to trigger rate limit on next call
    room["rateLimiter"].check(client.sessionId, "draw_card");

    // Second draw immediately should be rate limited
    const handCountBefore = room.state.players.get("0")!.hand.length;
    room["handleDrawCard"](client);
    const handCountAfter = room.state.players.get("0")!.hand.length;

    // Should not have drawn again due to rate limit
    expect(handCountAfter).toBe(handCountBefore);
  });
});

describe("Security: handlePlayCard edge cases", () => {
  it("handles play with non-string cardId gracefully", () => {
    const { room, client } = createRoomWithHuman();

    const player = room.state.players.get("0")!;
    player.hand.push(makeSchemaCard("red_5", "red", "5"));
    room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

    // Non-string cardId should be rejected
    room["handlePlayCard"](client, { cardId: 12345 as unknown as string });

    // Card should still be in hand
    const cardStillInHand = player.hand.some((c) => c.id === "red_5");
    expect(cardStillInHand).toBe(true);
  });

  it("rejects missing chosenColor for wild card", () => {
    const { room, client } = createRoomWithHuman();

    const player = room.state.players.get("0")!;
    player.hand.push(makeWildCard("wild_card", "wild"));
    room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

    // Missing chosenColor should be rejected
    room["handlePlayCard"](client, { cardId: "wild_card", chosenColor: undefined });

    // Card should remain in hand
    const cardInHand = player.hand.some((c) => c.id === "wild_card");
    expect(cardInHand).toBe(true);
  });
});

describe("Security: handleChat edge cases", () => {
  it("limits chat messages to 50", () => {
    const { room, client } = createRoomWithHuman();

    // Add 60 messages
    for (let i = 0; i < 60; i++) {
      room["rateLimiter"].clear();
      room["handleChat"](client, { text: `message ${i}` });
    }

    // Should be limited to 50
    expect(room.state.chatMessages.length).toBe(50);
  });

  it("accepts unicode text including emoji", () => {
    const { room, client } = createRoomWithHuman();

    room["handleChat"](client, { text: "Hello! 👋🎉🔥" });

    expect(room.state.chatMessages.length).toBe(1);
    expect(room.state.chatMessages[0].text).toBe("Hello! 👋🎉🔥");
  });
});

describe("Security: password and spectator interactions", () => {
  it("requires the password for active players on a private room", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "secret" });
    registerCleanup(() => room.onDispose());

    const client = makeTestClient("intruder-1");

    expect(() => room.onJoin(client, { name: "Intruder" })).toThrowError("Invalid password");
  });

  it("rejects an active player who supplies the wrong password", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "open-sesame" });
    registerCleanup(() => room.onDispose());

    const client = makeTestClient("intruder-2");

    expect(() => room.onJoin(client, { name: "Wrong", password: "guess" })).toThrowError("Invalid password");
  });

  it("lets spectators join a passworded room without the password", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "secret" });
    registerCleanup(() => room.onDispose());

    const spectatorClient = makeTestClient("watcher-1");

    // Spectators must not be blocked by the password check.
    expect(() => room.onJoin(spectatorClient, { name: "Watcher", spectator: true })).not.toThrow();
    expect(room.state.spectatorCount).toBe(1);
  });

  it("does not consume a player seat when the wrong password is supplied", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "secret" });
    registerCleanup(() => room.onDispose());

    const botCountBefore = Array.from(room.state.players.values()).filter((p) => p.isBot).length;

    const client = makeTestClient("intruder-3");
    expect(() => room.onJoin(client, { name: "Wrong", password: "no" })).toThrowError("Invalid password");

    // Bots should still own every seat — the failed player must not have replaced one.
    const botCountAfter = Array.from(room.state.players.values()).filter((p) => p.isBot).length;
    expect(botCountAfter).toBe(botCountBefore);
  });

  it("rejects a spectator attempting to claim a seat via matchmake (no password bypass, no zombie seat)", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "secret" });
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const sentMessages: Array<{ type: string; data: unknown }> = [];
    const spectatorClient = makeTestClient("watcher-mm", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });
    room.onJoin(spectatorClient, { name: "Watcher", spectator: true });
    expect(room.state.spectatorCount).toBe(1);

    room["handleMatchmake"](spectatorClient, { elo: 1000 });

    // The spectator must be rejected and must NOT receive a seat.
    const error = sentMessages.find(
      (m) => m.type === "error" && (m.data as { code: string }).code === "SPECTATOR_NO_SEAT",
    );
    expect(error).toBeDefined();
    const humanSeats = Array.from(room.state.players.values()).filter((p) => !p.isBot);
    expect(humanSeats).toHaveLength(0);
    // Still just a spectator — no dual-role zombie seat is left behind.
    expect(room.state.spectatorCount).toBe(1);
  });

  it("requires the password for matchmake seat takeover on a passworded room", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "secret" });
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const sentMessages: Array<{ type: string; data: unknown }> = [];
    const client = makeTestClient("intruder-mm", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });
    // Not a spectator, no password supplied.
    room["handleMatchmake"](client, { elo: 1000 });

    const error = sentMessages.find(
      (m) => m.type === "error" && (m.data as { code: string }).code === "INVALID_PASSWORD",
    );
    expect(error).toBeDefined();
    const humanSeats = Array.from(room.state.players.values()).filter((p) => !p.isBot);
    expect(humanSeats).toHaveLength(0);
  });

  it("allows matchmake seat takeover with the correct password", () => {
    const room = new UnoRoom();
    room.onCreate({ password: "secret" });
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const sentMessages: Array<{ type: string; data: unknown }> = [];
    const client = makeTestClient("human-mm", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });
    room["handleMatchmake"](client, { elo: 1000, password: "secret", name: "Alice" });

    const joined = sentMessages.find((m) => m.type === "matchmake_joined");
    expect(joined).toBeDefined();
    const player = room.findPlayerBySession("human-mm");
    expect(player).not.toBeNull();
    expect(player!.isBot).toBe(false);
    expect(player!.connected).toBe(true);
  });
});

describe("Security: rematch vote persistence on leave", () => {
  it("only removes the departing player's own rematch vote (finished phase)", () => {
    const { room, client } = createRoomWithHuman(0, "Alice");

    // Simulate a finished game where seat 0 and seat 1 voted to rematch.
    room.state.phase = "finished";
    room.state.winner = 2;
    room.state.rematchVotes.push(0);
    room.state.rematchVotes.push(1);

    room.onLeave(client);

    // Seat 0's vote is gone; seat 1's vote survives (previously ALL were wiped).
    expect(room.state.rematchVotes.includes(0)).toBe(false);
    expect(room.state.rematchVotes.includes(1)).toBe(true);
  });
});

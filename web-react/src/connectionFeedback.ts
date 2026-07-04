// Colyseus HTTP match-making error codes (from @colyseus/shared-types)
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

// WebSocket close codes that indicate a normal/user-initiated disconnect
const NORMAL_CLOSE_CODES = new Set([1000, 1001]);

export function isNormalRoomClose(code: number | undefined | null) {
  return code != null && NORMAL_CLOSE_CODES.has(code);
}

interface RoomJoinError {
  code?: number;
  message?: unknown;
}

function getErrorCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const typed = err as RoomJoinError;
  return typeof typed.code === "number" ? typed.code : undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const typed = err as { message?: unknown };
    if (typeof typed.message === "string") return typed.message;
  }
  return String(err);
}

export function getRoomJoinErrorMessage(err: unknown) {
  const errorMessage = getErrorMessage(err);
  const lowerMessage = errorMessage.toLowerCase();
  const code = getErrorCode(err);

  // Network/fetch failures — server unreachable
  if (
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("networkerror") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("websocket") ||
    lowerMessage.includes("connection refused") ||
    lowerMessage.includes("getaddrinfo") ||
    lowerMessage.includes("err_network_changed") ||
    lowerMessage.includes("err_internet_disconnected")
  ) {
    return "Server unreachable. Make sure the game server is running.";
  }

  // Server-side onJoin errors are wrapped with APPLICATION_ERROR (526)
  // and the original message bubbles up. Match on message content first
  // because multiple failures share the same code.
  if (
    code === COLYSEUS_ERROR.APPLICATION_ERROR &&
    (lowerMessage.includes("invalid password") || lowerMessage.includes("wrong password"))
  ) {
    return "Wrong password. Please check the room password and try again.";
  }
  if (code === COLYSEUS_ERROR.APPLICATION_ERROR && lowerMessage.includes("rate limited")) {
    return "Too many join attempts. Wait a moment and try again.";
  }

  // INVALID_ROOM_ID (522) covers both "room not found" and "room is locked".
  // Only treat as "not found" when the message mentions not-found explicitly;
  // otherwise fall back to the original message so the user sees the real reason.
  if (
    code === COLYSEUS_ERROR.INVALID_ROOM_ID &&
    (lowerMessage.includes("not found") || lowerMessage.includes("disposed") || lowerMessage.includes("no such room"))
  ) {
    return "Room not found. Check the invite code and try again.";
  }
  if (code === COLYSEUS_ERROR.INVALID_ROOM_ID && lowerMessage.includes("locked")) {
    return "Room is locked. The host is restarting the table.";
  }

  // INVALID_CRITERIA (521) — no rooms match the join criteria (full / filter).
  // The server message often contains "full" or "no rooms found".
  if (
    code === COLYSEUS_ERROR.INVALID_CRITERIA &&
    (lowerMessage.includes("no rooms found") || lowerMessage.includes("criteria"))
  ) {
    return "Room is full. The table already has the maximum number of players.";
  }

  // AUTH_FAILED (525) — the room's onAuth rejected the join.
  if (code === COLYSEUS_ERROR.AUTH_FAILED) {
    return "This table rejected the join request.";
  }

  // NO_HANDLER (520) — the room type isn't registered on the server.
  // Most often means the server is running an older build or is mismatched.
  if (code === COLYSEUS_ERROR.NO_HANDLER) {
    return "Game server is missing the required table type. Try restarting the server.";
  }

  // EXPIRED (524) — usually a stale seat reservation or reconnect token.
  if (code === COLYSEUS_ERROR.EXPIRED) {
    return "Your invite expired. Refresh and try joining again.";
  }

  // INVALID_PAYLOAD (4217) — the request body was malformed.
  if (code === COLYSEUS_ERROR.INVALID_PAYLOAD) {
    return "The join request was rejected by the server. Refresh and try again.";
  }

  // Legacy fallback: keep string-based detection for older or custom servers.
  if (lowerMessage.includes("invalid password") || lowerMessage.includes("wrong password")) {
    return "Wrong password. Please check the room password and try again.";
  }
  if (
    !lowerMessage.includes("invalid") &&
    !lowerMessage.includes("not found") &&
    lowerMessage.includes("full")
  ) {
    return "Room is full. The table already has the maximum number of players.";
  }
  if (
    !lowerMessage.includes("invalid") &&
    (lowerMessage.includes("not found") || lowerMessage.includes("no such room"))
  ) {
    return "Room not found. Check the invite code and try again.";
  }

  return `Could not join the room: ${errorMessage}`;
}

export function getRoomDisconnectMessage(code: number | undefined | null) {
  if (isNormalRoomClose(code)) {
    return null;
  }
  return "Connection lost. You were returned to the lobby.";
}
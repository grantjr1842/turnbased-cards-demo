import { useCallback, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { Mode, UnoState } from "../gameTypes";
import {
  getJoinErrorMessage,
  isNormalCloseCode,
  snapshotRoomState,
  type RoomActionError,
} from "./roomSessionModel";

type ConnectRoom = () => Promise<Room<UnoState>>;

interface UseRoomSessionArgs {
  onRoomError?: (error: RoomActionError) => void;
}

export function useRoomSession({ onRoomError }: UseRoomSessionArgs = {}) {
  const [mode, setMode] = useState<Mode>("lobby");
  const [room, setRoom] = useState<Room<UnoState> | null>(null);
  const [state, setState] = useState<UnoState | null>(null);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);

  const resetSessionState = useCallback((nextDisconnected = false) => {
    setRoom(null);
    setState(null);
    setMode("lobby");
    setDisconnected(nextDisconnected);
  }, []);

  const connect = useCallback(async (connectRoom: ConnectRoom) => {
    setError("");
    setMode("joining");
    setDisconnected(false);
    try {
      const joined = await connectRoom();
      joined.onStateChange((next) => setState(snapshotRoomState(next)));
      joined.onMessage("error", (error) => {
        onRoomError?.(error as RoomActionError);
      });
      joined.onLeave((code) => {
        resetSessionState(!isNormalCloseCode(code));
      });
      joined.onError((code) => {
        setDisconnected(!isNormalCloseCode(code));
      });
      setRoom(joined);
      setState(snapshotRoomState(joined.state));
      setMode("table");
    } catch (err: unknown) {
      setError(getJoinErrorMessage(err));
      resetSessionState();
    }
  }, [onRoomError, resetSessionState]);

  const leaveRoom = useCallback(() => {
    if (mode === "table" && state?.phase === "playing") {
      const confirmLeave = window.confirm(
        "Leave the game? You will forfeit this match if you leave mid-game.",
      );
      if (!confirmLeave) return;
    }
    room?.leave();
    resetSessionState();
  }, [mode, resetSessionState, room, state?.phase]);

  return {
    connect,
    disconnected,
    error,
    leaveRoom,
    mode,
    room,
    state,
  };
}

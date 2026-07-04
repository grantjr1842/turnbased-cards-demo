import "./index.css";
import { Client, Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Lobby } from "./components/Lobby";
import { TableRoom } from "./components/TableRoom";
import {
  getRoomDisconnectMessage,
  getRoomJoinErrorMessage,
  isNormalRoomClose,
} from "./connectionFeedback";
import type { Mode, Toast, UnoState } from "./gameTypes";
import { snapshotState } from "./stateSnapshot";
import { readStorage, writeStorage } from "./storage";
import { ErrorBoundary } from "./sentry";
import "./sentry";

const configuredWsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";
const WS_URL = import.meta.env.DEV && isLocalHost ? "ws://localhost:2567" : configuredWsUrl;
const client = new Client(WS_URL);
const debugTurnScenario =
  import.meta.env.DEV && isLocalHost
    ? (new URLSearchParams(window.location.search).get("debugTurn") as "lockedHand" | "drawPenalty" | null)
    : null;

declare global {
  interface Window {
    __unoTestHooks?: {
      closeCurrentRoom: (code?: number) => void;
    };
  }
}

function App() {
  const [mode, setMode] = useState<Mode>("lobby");
  const [room, setRoom] = useState<Room<UnoState> | null>(null);
  const [state, setState] = useState<UnoState | null>(null);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const connectGeneration = useRef(0);
  const leaveRequested = useRef(false);
  const toastTimers = useRef<Set<number>>(new Set());
  // Refs mirror the latest mode/phase so leaveRoom can stay referentially
  // stable (useCallback) without reading stale values. This keeps <TableRoom>
  // memo from breaking on every App re-render (e.g. toast add/remove).
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const phaseRef = useRef(state?.phase);
  phaseRef.current = state?.phase;

  // Persisted accessibility state
  const [colorblindMode, setColorblindMode] = useState(() => {
    return readStorage("uno_colorblind") === "true";
  });

  const toggleColorblindMode = useCallback(() => {
    setColorblindMode((prev) => {
      const next = !prev;
      writeStorage("uno_colorblind", String(next));
      return next;
    });
  }, []);

  const showToast = useCallback(
    (message: string, kind: Toast["kind"] = "info", duration = 2500) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, kind }]);
      const timerId = window.setTimeout(() => {
        toastTimers.current.delete(timerId);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      toastTimers.current.add(timerId);
    },
    [],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [mode]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isLocalHost) return;
    const hooks = {
      closeCurrentRoom: (code = 4000) => {
        room?.connection.close(code, "test disconnect");
      },
    };
    window.__unoTestHooks = hooks;
    return () => {
      if (window.__unoTestHooks === hooks) {
        delete window.__unoTestHooks;
      }
    };
  }, [room]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimers.current.clear();
    };
  }, []);

  async function connect(connectRoom: Promise<Room<UnoState>>) {
    const generation = ++connectGeneration.current;
    leaveRequested.current = false;
    setError("");
    setDisconnected(false);
    setMode("joining");
    try {
      const joined = await connectRoom;
      if (generation !== connectGeneration.current) {
        void joined.leave().catch(() => undefined);
        return;
      }
      joined.onStateChange((next) => setState(snapshotState(next)));
      joined.onMessage("error", () => {
        // Silent capture to prevent Colyseus SDK from printing default console warnings
      });
      joined.onLeave((code) => {
        if (generation !== connectGeneration.current) return;
        const wasRequested = leaveRequested.current;
        leaveRequested.current = false;
        setRoom(null);
        setState(null);
        setMode("lobby");
        setDisconnected(false);

        if (!wasRequested) {
          const disconnectMessage = getRoomDisconnectMessage(code);
          if (disconnectMessage) {
            setError(disconnectMessage);
            showToast(disconnectMessage, "warning");
          }
        }
      });
      joined.onError((code) => {
        if (generation !== connectGeneration.current) return;
        setDisconnected(!isNormalRoomClose(code));
      });
      setRoom(joined);
      setState(snapshotState(joined.state));
      setError("");
      setDisconnected(false);
      setMode("table");
    } catch (err: unknown) {
      if (generation !== connectGeneration.current) return;
      setError(getRoomJoinErrorMessage(err));
      setMode("lobby");
    }
  }

  const leaveRoom = useCallback(() => {
    // Confirm mid-match departure to prevent accidental leaves
    if (modeRef.current === "table" && phaseRef.current === "playing") {
      const confirmLeave = window.confirm(
        "Leave the game? You will forfeit this match if you leave mid-game.",
      );
      if (!confirmLeave) return;
    }
    connectGeneration.current += 1;
    leaveRequested.current = true;
    void room?.leave().catch(() => undefined);
    setRoom(null);
    setState(null);
    setError("");
    setMode("lobby");
    setDisconnected(false);
  }, [room]);

  return (
    <>
      {mode === "table" ? (
        <ErrorBoundary
          fallback={({ resetError }) => (
            <main className="crash-screen">
              <section>
                <h1>Table crashed rendering</h1>
                <button onClick={resetError} type="button">
                  Return to Lobby
                </button>
              </section>
            </main>
          )}
          onReset={leaveRoom}
        >
          <TableRoom
            room={room}
            state={state}
            onLeave={leaveRoom}
            colorblindMode={colorblindMode}
            onToggleColorblind={toggleColorblindMode}
            showToast={showToast}
            disconnected={disconnected}
            debugTurnScenario={debugTurnScenario}
          />
        </ErrorBoundary>
      ) : (
        <Lobby
          busy={mode === "joining"}
          error={error}
          onQuickPlay={(options) => connect(client.create("uno", options))}
          onJoinCode={(roomId, options) => connect(client.joinById(roomId, options))}
          onWatch={(roomId, options) =>
            connect(
              client.joinById(roomId, { ...options, spectator: true }),
            )
          }
          colorblindMode={colorblindMode}
          onToggleColorblind={toggleColorblindMode}
        />
      )}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary
    fallback={
      <main className="crash-screen">
        <section>
          <h1>Something went wrong</h1>
        </section>
      </main>
    }
  >
    <App />
  </ErrorBoundary>,
);

// Register PWA service worker
if ("serviceWorker" in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (import.meta.env.DEV) {
          console.debug("[SW] registered", reg.scope);
        }
      })
      .catch((err) => console.warn("[SW] registration failed", err));
  };

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker, { once: true });
  }
}

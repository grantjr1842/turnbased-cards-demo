import { Client } from "@colyseus/sdk";
import { Component, type ReactNode, useCallback } from "react";
import { Lobby } from "./components/Lobby";
import { TableRoom } from "./components/TableRoom";
import { ToastStack } from "./components/ToastStack";
import { useColorblindPreference } from "./hooks/useColorblindPreference";
import { useRoomSession } from "./hooks/useRoomSession";
import { useScrollToTopOnModeChange } from "./hooks/useScrollToTopOnModeChange";
import { useServiceWorkerRegistration } from "./hooks/useServiceWorkerRegistration";
import { useToastQueue } from "./hooks/useToastQueue";
import { getRoomActionToast } from "./hooks/roomSessionModel";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
const client = new Client(WS_URL);

export function App() {
  const { colorblindMode, toggleColorblindMode } = useColorblindPreference();
  const { showToast, toasts } = useToastQueue();
  const handleRoomError = useCallback(
    (error: { message?: unknown; code?: unknown }) => {
      const toast = getRoomActionToast(error);
      showToast(toast.message, toast.kind);
    },
    [showToast],
  );
  const { connect, disconnected, error, leaveRoom, mode, room, state } = useRoomSession({
    onRoomError: handleRoomError,
  });
  useServiceWorkerRegistration();
  useScrollToTopOnModeChange(mode);

  return (
    <>
      {mode === "table" ? (
        <ErrorBoundary onReset={leaveRoom}>
          <TableRoom
            room={room}
            state={state}
            onLeave={leaveRoom}
            colorblindMode={colorblindMode}
            onToggleColorblind={toggleColorblindMode}
            showToast={showToast}
            disconnected={disconnected}
          />
        </ErrorBoundary>
      ) : (
        <Lobby
          busy={mode === "joining"}
          error={error}
          onQuickPlay={(options) => connect(() => client.joinOrCreate("uno", options))}
          onJoinCode={(roomId, options) => connect(() => client.joinById(roomId, options))}
          onWatch={(roomId) =>
            connect(() => client.joinById(roomId, { name: "Spectator", spectator: true }))
          }
          colorblindMode={colorblindMode}
          onToggleColorblind={toggleColorblindMode}
        />
      )}
      <ToastStack toasts={toasts} />
    </>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="crash-screen">
          <section>
            <h1>Table crashed rendering</h1>
            <p>
              {this.state.error instanceof Error
                ? this.state.error.message
                : "Unknown render error"}
            </p>
            <button onClick={this.props.onReset} type="button">
              Return to Lobby
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

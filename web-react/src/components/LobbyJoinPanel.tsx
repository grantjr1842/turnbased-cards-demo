import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { ColorblindToggleButton } from "./ColorblindToggleButton";
import { StatsDashboard } from "./StatsDashboard";
import { LobbyAvatarPicker } from "./LobbyAvatarPicker";
import type { LobbyFormState } from "../hooks/useLobbyFormState";

interface LobbyJoinPanelProps {
  busy: boolean;
  error: string;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  onQuickPlay: (options: Record<string, unknown>) => void;
  onJoinCode: (roomId: string, options: Record<string, unknown>) => void;
  onWatch: (roomId: string) => void;
  form: LobbyFormState;
}

export function LobbyJoinPanel({
  busy,
  error,
  colorblindMode,
  onToggleColorblind,
  onQuickPlay,
  onJoinCode,
  onWatch,
  form,
}: LobbyJoinPanelProps) {
  const {
    buildJoinOptions,
    difficulty,
    name,
    password,
    persistProfile,
    privateRoom,
    setDifficulty,
    setName,
    setPassword,
    setPrivateRoom,
    setRoomCode,
    trimmedRoomCode,
    hasRoomCode,
    validName,
  } = form;

  const handleStart = (action: (options: Record<string, unknown>) => void) => {
    persistProfile();
    action(buildJoinOptions());
  };

  return (
    <section className="join-panel" aria-label="Join game">
      <div className="panel-header">
        <span>Multiplayer Table</span>
        <strong>
          {busy ? (
            <span className="connecting-spinner">
              <span className="spinner-ring" /> Connecting...
            </span>
          ) : (
            "Ready"
          )}
        </strong>
      </div>

      <label className="field">
        <span>Player nickname</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your name"
          maxLength={16}
          autoFocus
        />
      </label>

      <LobbyAvatarPicker form={form} />

      <div className="field">
        <span>Match options</span>
        <div className="control-row">
          <button
            className={privateRoom ? "chip active" : "chip"}
            onClick={() => setPrivateRoom((value) => !value)}
            type="button"
          >
            Private: {privateRoom ? "On" : "Off"}
          </button>
          {(["easy", "medium", "hard"] as const).map((level) => (
            <button
              key={level}
              className={difficulty === level ? "chip active" : "chip"}
              onClick={() => setDifficulty(level)}
              type="button"
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {privateRoom && (
        <label className="field">
          <span>Room password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Optional table password"
            type="password"
            maxLength={32}
          />
        </label>
      )}

      <button
        className={`primary-btn ${busy ? "loading" : ""}`}
        disabled={!validName || busy}
        onClick={() => handleStart(onQuickPlay)}
        type="button"
      >
        {busy ? "Connecting..." : "Create Table"}
      </button>

      <div className="join-grid">
        <label className="field compact">
          <span>Invite code</span>
          <input
            value={form.roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="Room Code"
          />
        </label>
        <button
          className="secondary-btn"
          disabled={!hasRoomCode || !validName || busy}
          onClick={() => handleStart((opts) => onJoinCode(trimmedRoomCode, opts))}
          type="button"
        >
          Enter
        </button>
        <button
          className="secondary-btn"
          disabled={!hasRoomCode || busy}
          onClick={() => onWatch(trimmedRoomCode)}
          type="button"
        >
          Watch
        </button>
      </div>

      <div className="lobby-stats-panel">
        <StatsDashboard />
      </div>

      <div className="lobby-actions-row">
        <AudioSettingsPanel />
        <ColorblindToggleButton active={colorblindMode} onToggle={onToggleColorblind} variant="lobby" />
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

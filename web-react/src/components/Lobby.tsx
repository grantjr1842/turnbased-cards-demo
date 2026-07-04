import type { CSSProperties } from "react";
import { useState } from "react";
import { sfx } from "../audio/sfx";
import { AvatarIcon } from "./AvatarIcon";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { StatsDashboard } from "./StatsDashboard";
import { LobbyShell } from "./LobbyShell";
import { AVATAR_SYMBOLS, AVATAR_THEMES, ATLAS_INDEX } from "../tableConfig";
import { parsePlayerName } from "../gameHelpers";
import { readStorage, writeStorage } from "../storage";
import { VERSION } from "../version";

interface LobbyProps {
  busy: boolean;
  error: string;
  onQuickPlay: (options: Record<string, unknown>) => void;
  onJoinCode: (roomId: string, options: Record<string, unknown>) => void;
  onWatch: (roomId: string, options: Record<string, unknown>) => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
}

export function Lobby({
  busy,
  error,
  onQuickPlay,
  onJoinCode,
  onWatch,
  colorblindMode,
  onToggleColorblind,
}: LobbyProps) {
  const [name, setName] = useState(() => {
    const raw = readStorage("uno_nickname") || "";
    return parsePlayerName(raw).name;
  });
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [avatarSymbol, setAvatarSymbol] = useState(() => readStorage("uno_av_symbol") || "tiger");
  const [avatarTheme, setAvatarTheme] = useState(() => readStorage("uno_av_theme") || "rose");

  const trimmedName = name.trim();
  const validName = trimmedName.length >= 2 && trimmedName.length <= 16;

  const handleStart = (action: (options: Record<string, unknown>) => void) => {
    writeStorage("uno_av_symbol", avatarSymbol);
    writeStorage("uno_av_theme", avatarTheme);
    writeStorage("uno_nickname", trimmedName);

    const serializedName = `[av-${avatarSymbol}-${avatarTheme}]${trimmedName}`;
    action({
      name: serializedName,
      private: privateRoom,
      difficulty,
      password: password || undefined,
    });
  };

  return (
    <LobbyShell>
      <section className="brand-panel" aria-label="Wild Table preview">
        <div className="table-sculpture">
          <div className="table-rail" />
          <div className="table-felt-mini" />
          <div className="lobby-hero-hand">
            {["red", "blue", "yellow", "green", "wild"].map((color, index) => {
              const fileKey = color === "wild" ? "wild" : `${color}_5`;
              const tileIdx = ATLAS_INDEX.get(fileKey) ?? 52;
              const col = tileIdx % 10;
              const row = Math.floor(tileIdx / 10);
              return (
                <div
                  key={color}
                  className="lobby-hero-card card-sprite"
                  style={
                    {
                      "--i": index,
                      "--col": col,
                      "--row": row,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        </div>
        <div className="brand-copy" style={{ zIndex: 10 }}>
          <h1>Wild Table</h1>
          <p>A real-time card table built for fast moves, clear matches, and clean turns.</p>
        </div>
      </section>

      <section className="join-panel" aria-label="Join game">
        <div className="panel-header">
          <span>Set up your table</span>
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
          <span>Player name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your player name"
            maxLength={16}
            autoFocus
          />
        </label>

        <div className="avatar-creator-panel">
          <span>Choose avatar</span>
          <div className="avatar-creator-layout">
            <AvatarIcon symbol={avatarSymbol} theme={avatarTheme} size={64} glow />
            <div className="avatar-creator-picker-column">
              <div className="avatar-grid-picker">
                {AVATAR_SYMBOLS.map((sym) => (
                  <button
                    key={sym.id}
                    className={`avatar-picker-btn ${avatarSymbol === sym.id ? "active" : ""}`}
                    onClick={() => {
                      setAvatarSymbol(sym.id);
                      sfx.playPluck();
                    }}
                    type="button"
                    title={sym.name}
                  >
                    {sym.emoji}
                  </button>
                ))}
              </div>
              <div className="theme-grid-picker">
                {AVATAR_THEMES.map((th) => (
                  <button
                    key={th.id}
                    className={`theme-picker-btn ${avatarTheme === th.id ? "active" : ""}`}
                    style={{ "--theme-color-highlight": th.primary } as CSSProperties}
                    onClick={() => {
                      setAvatarTheme(th.id);
                      sfx.playPluck();
                    }}
                    type="button"
                  >
                    {th.name.split(" ")[1]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="field">
          <span>Table options</span>
          <div className="control-row">
            <button
              className={privateRoom ? "chip active" : "chip"}
              onClick={() => setPrivateRoom((value) => !value)}
              type="button"
            >
              Private table: {privateRoom ? "On" : "Off"}
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
            <span>Table password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Optional table passcode"
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
          {busy ? "Connecting..." : "Start table"}
        </button>

        <div className="join-grid">
          <label className="field compact">
            <span>Table code</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="Enter table code"
            />
          </label>
          <button
            className="secondary-btn"
            disabled={!roomCode.trim() || !validName || busy}
            onClick={() => handleStart((opts) => onJoinCode(roomCode.trim(), opts))}
            type="button"
          >
            Join table
          </button>
          <button
            className="secondary-btn"
            disabled={!roomCode.trim() || !validName || busy}
            onClick={() => handleStart((opts) => onWatch(roomCode.trim(), opts))}
            type="button"
          >
            Watch table
          </button>
        </div>

        <div style={{ marginTop: "8px" }}>
          <StatsDashboard />
        </div>

        <div className="lobby-actions-row">
          <AudioSettingsPanel />
          <button
            className={`accessibility-toggle-btn ${colorblindMode ? "active" : ""}`}
            onClick={onToggleColorblind}
            type="button"
          >
            ♿ Color symbols: {colorblindMode ? "On" : "Off"}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>
      <footer style={{ textAlign: "center", opacity: 0.5, fontSize: "0.75rem", padding: "8px 0" }}>
        v{VERSION}
      </footer>
    </LobbyShell>
  );
}

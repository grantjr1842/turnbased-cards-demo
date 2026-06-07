import { memo } from "react";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { ColorblindToggleButton } from "./ColorblindToggleButton";
import { PingVisualizer } from "./PingVisualizer";
import type { PlayDirection } from "../gameTypes";
import { getPlayDirectionLabels } from "../gameHelpers";

interface TableTopbarProps {
  roomCode: string;
  isMyTurn: boolean;
  currentPlayerLabel: string;
  direction: PlayDirection;
  ping: number | null;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  onShowRules: () => void;
  onLeave: () => void;
}

function TableTopbarBase({
  roomCode,
  isMyTurn,
  currentPlayerLabel,
  direction,
  ping,
  colorblindMode,
  onToggleColorblind,
  onShowRules,
  onLeave,
}: TableTopbarProps) {
  const { short: playOrderLabel, full: fullPlayOrderLabel } = getPlayDirectionLabels(direction);

  return (
    <header className="topbar">
      <div className="topbar-info">
        <div className="topbar-stat topbar-room-code-stat">
          <span>Invite code</span>
          <strong>{roomCode}</strong>
        </div>
        <div className="topbar-stat topbar-turn-status-stat">
          <span>Turn status</span>
          <strong className={isMyTurn ? "turn-status-my-turn" : "turn-status-waiting"}>
            {isMyTurn ? "Your Turn!" : currentPlayerLabel}
          </strong>
        </div>
        <div className="topbar-stat topbar-play-order-stat">
          <span>Play order</span>
          <strong title={fullPlayOrderLabel}>
            <span className="topbar-stat-label-full">{fullPlayOrderLabel}</span>
            <span className="topbar-stat-label-short">{playOrderLabel}</span>
          </strong>
        </div>
      </div>

      <div className="topbar-actions">
        <PingVisualizer ping={ping} />
        <AudioSettingsPanel />
        <ColorblindToggleButton active={colorblindMode} onToggle={onToggleColorblind} variant="topbar" />
        <button
          className="ghost-btn topbar-rules-btn"
          data-testid="topbar-rules"
          onClick={onShowRules}
          type="button"
          title="Open rules"
        >
          <span className="topbar-btn-label">Rules (?)</span>
          <span className="topbar-btn-short">Rules</span>
        </button>
        <button className="ghost-btn topbar-leave-btn" onClick={onLeave} type="button" title="Leave game">
          <span className="topbar-btn-label">Leave Game</span>
          <span className="topbar-btn-short">Leave</span>
        </button>
      </div>
    </header>
  );
}

export const TableTopbar = memo(TableTopbarBase);

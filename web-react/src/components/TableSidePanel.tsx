import { memo } from "react";
import { AvatarIcon } from "./AvatarIcon";
import type { UnoState } from "../gameTypes";
import type { MeSummary, RosterEntry } from "./tableRoomPlayers";
import { getCardCountClass } from "../gameHelpers";
import { CARD_BACK_SKINS, type CardBackSkin } from "../tableConfig";

interface TableSidePanelProps {
  me: MeSummary | null;
  topCardLabel: string;
  phase: UnoState["phase"] | undefined;
  roster: RosterEntry[];
  cardBackTheme: CardBackSkin;
  onSetCardBackTheme: (theme: CardBackSkin) => void;
}

function TableSidePanelBase({
  me,
  topCardLabel,
  phase,
  roster,
  cardBackTheme,
  onSetCardBackTheme,
}: TableSidePanelProps) {
  return (
    <aside className="side-panel">
      <div className="status-card status-card-row">
        {me && (
          <div className="avatar-wrapper-pill">
            <AvatarIcon symbol={me.symbol} theme={me.theme} size={40} glow />
          </div>
        )}
        <div className="status-card-body">
          <span>Seat Allocation</span>
          <strong>{me ? `${me.displayName} (Seat ${me.seatIndex + 1})` : "Spectator"}</strong>
          <small>{me?.spectatorCount ?? 0} Watching table</small>
        </div>
      </div>

      <div className="status-card">
        <span>Active Discard</span>
        <strong>{topCardLabel}</strong>
        <small>{phase ?? "Awaiting"}</small>
      </div>

      <div className="roster-card">
        <span>Opponent Cards</span>
        <div className="roster-list">
          {roster.length === 0 ? (
            <p className="roster-empty-copy">Awaiting players...</p>
          ) : (
            roster.map((player) => (
              <div className="roster-row roster-row-shell" key={player.sessionId}>
                <AvatarIcon symbol={player.symbol} theme={player.theme} size={28} glow={player.active} />
                <div className="roster-row-info roster-row-main">
                  <strong>{player.displayName}</strong>
                  <span>{player.isBot ? "Bot" : "Opponent"}</span>
                </div>
                <div className={`roster-card-count opponent-card-gauge ${getCardCountClass(player.cardCount)}`}>
                  {player.cardCount}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="roster-card skin-picker-card">
        <span>Card Back Skin</span>
        <div className="skin-picker-grid">
          {CARD_BACK_SKINS.map((skin) => (
            <button
              key={skin.id}
              className={`skin-picker-btn ${skin.id} ${cardBackTheme === skin.id ? "active" : ""}`}
              onClick={() => onSetCardBackTheme(skin.id)}
              type="button"
            >
              <div className={`skin-preview-thumb ${skin.id}`} />
              <span>{skin.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export const TableSidePanel = memo(TableSidePanelBase);

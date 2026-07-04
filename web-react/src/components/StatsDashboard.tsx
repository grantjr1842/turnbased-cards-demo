import { useMemo } from "react";
import { parsePlayerName } from "../gameHelpers";
import { getStats } from "../stats";

export function StatsDashboard() {
  // Stats live in localStorage and only change between matches; the Lobby
  // remounts when returning from a table, so reading once on mount is enough.
  // Memoizing avoids a localStorage + JSON.parse round-trip on every render
  // (e.g. on every keystroke in the lobby form) and makes the `history`
  // useMemo below actually effective.
  const stats = useMemo(() => getStats(), []);
  const history = useMemo(
    () =>
      (stats.history ?? []).map((entry) => ({
        entry,
        displayWinner: parsePlayerName(entry.winnerName).name,
        opponentNames: entry.opponentNames.map((name) => parsePlayerName(name).name),
      })),
    [stats.history],
  );
  if (stats.played === 0) return null;

  return (
    <div className="stats-dashboard">
      <h3>Hall of Fame Stats</h3>
      <div className="stats-grid">
        <div className="stat-badge">
          <span>Played</span>
          <strong>{stats.played}</strong>
        </div>
        <div className="stat-badge">
          <span>Wins</span>
          <strong>{stats.wins}</strong>
        </div>
        <div className="stat-badge">
          <span>Win Rate</span>
          <strong>{stats.played > 0 ? `${Math.round((stats.wins / stats.played) * 100)}%` : "0%"}</strong>
        </div>
      </div>

      {stats.history && stats.history.length > 0 && (
        <div
          className="history-section"
          style={{
            marginTop: "16px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <h4
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            Recent Matches
          </h4>
          <div
            className="history-list"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              maxHeight: "180px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {history.map(({ entry, displayWinner, opponentNames }) => (
              <div
                key={entry.id}
                className="history-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <strong
                    style={{
                      color: entry.win ? "var(--gold)" : "var(--card-red)",
                      fontSize: "12px",
                    }}
                  >
                    {entry.win ? "Victory 🏆" : "Defeat 💀"}
                  </strong>
                  <span style={{ color: "var(--text-faint)", fontSize: "10px" }}>
                    Winner: {displayWinner} • {Math.round(entry.durationSec)}s
                  </span>
                  {opponentNames.length > 0 && (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "9px",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        maxWidth: "180px",
                      }}
                    >
                      VS: {opponentNames.join(", ")}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <strong>{entry.cardsPlayed} cards</strong>
                  <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

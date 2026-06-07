import { useMemo, useSyncExternalStore } from "react";
import { getStatsSnapshot, formatMatchHistory, parseStatsSnapshot, subscribeToStatsChanges } from "../stats";

export function StatsDashboard() {
  const statsSnapshot = useSyncExternalStore(subscribeToStatsChanges, getStatsSnapshot, getStatsSnapshot);
  const stats = useMemo(() => parseStatsSnapshot(statsSnapshot), [statsSnapshot]);
  const displayHistory = useMemo(() => formatMatchHistory(stats.history ?? []), [stats.history]);

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

      {displayHistory.length > 0 && (
        <div className="history-section">
          <h4 className="history-heading">Recent Matches</h4>
          <div className="history-list">
            {displayHistory.map((entry) => (
              <div key={entry.id} className="history-row">
                <div className="history-row-body">
                  <strong className={`history-row-title ${entry.win ? "win" : "loss"}`}>
                    {entry.win ? "Victory 🏆" : "Defeat 💀"}
                  </strong>
                  <span className="history-row-meta">
                    Winner: {entry.winnerDisplayName} • {entry.durationLabel}
                  </span>
                  {entry.opponentDisplayNames.length > 0 && (
                    <span className="history-row-opponents">
                      VS: {entry.opponentDisplayNames.join(", ")}
                    </span>
                  )}
                </div>
                <div className="history-row-score">
                  <strong>{entry.cardsPlayed} cards</strong>
                  <span className="history-row-date">{entry.formattedDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

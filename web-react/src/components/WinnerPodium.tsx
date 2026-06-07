import { memo } from "react";
import type { CSSProperties } from "react";
import { AvatarIcon } from "./AvatarIcon";
import type { PlayerSchema } from "../gameTypes";
import { parsePlayerName } from "../gameHelpers";

const PODIUM_COINS = Array.from({ length: 30 }, (_, i) => ({
  id: `coin-${i}`,
  left: `${((i * 17) % 100) + 0.5}%`,
  delay: `${(i % 8) * 0.35}s`,
  duration: `${3 + (i % 5) * 0.4}s`,
  size: `${14 + (i % 8) * 2}px`,
}));

interface WinnerPodiumProps {
  rematchVotes: number[];
  connectedHumanPlayers: PlayerSchema[];
  winnerPlayer: PlayerSchema | null;
  meSeatIndex: number | undefined;
  onVoteRematch: () => void;
}

function WinnerPodiumBase({
  rematchVotes,
  connectedHumanPlayers,
  winnerPlayer,
  meSeatIndex,
  onVoteRematch,
}: WinnerPodiumProps) {
  const winAv = winnerPlayer ? parsePlayerName(winnerPlayer.name) : null;
  const voteSet = new Set(rematchVotes);

  return (
    <div className="winner-podium-overlay">
      {PODIUM_COINS.map((coin) => (
        <div
          key={coin.id}
          className="gold-coin-particle"
          style={
            {
              left: coin.left,
              animationDelay: coin.delay,
              animationDuration: coin.duration,
              fontSize: coin.size,
            } as CSSProperties
          }
        >
          🪙
        </div>
      ))}

      <div className="winner-podium-box">
        <div className="podium-pedestal">
          <div className="podium-crown">👑</div>
          <div className="championship-avatar-container">
            <svg className="championship-laurels" viewBox="0 0 100 100" width="130" height="130">
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffe066" />
                  <stop offset="50%" stopColor="#f5af19" />
                  <stop offset="100%" stopColor="#e65c00" />
                </linearGradient>
              </defs>
              <path
                d="M 38,78 C 22,68 18,45 30,25 C 22,38 24,55 36,66"
                fill="none"
                stroke="url(#goldGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M 30,25 L 34,29 L 28,31 Z" fill="url(#goldGrad)" />
              <path d="M 23,38 L 28,40 L 24,45 Z" fill="url(#goldGrad)" />
              <path d="M 22,50 L 27,51 L 24,56 Z" fill="url(#goldGrad)" />
              <path d="M 24,61 L 29,60 L 27,66 Z" fill="url(#goldGrad)" />
              <path
                d="M 62,78 C 78,68 82,45 70,25 C 78,38 76,55 64,66"
                fill="none"
                stroke="url(#goldGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M 70,25 L 66,29 L 72,31 Z" fill="url(#goldGrad)" />
              <path d="M 77,38 L 72,40 L 76,45 Z" fill="url(#goldGrad)" />
              <path d="M 78,50 L 73,51 L 76,56 Z" fill="url(#goldGrad)" />
              <path d="M 76,61 L 71,60 L 73,66 Z" fill="url(#goldGrad)" />
            </svg>
            {winAv && <AvatarIcon symbol={winAv.symbol} theme={winAv.theme} size={84} glow />}
          </div>
          <h1 className="winner-podium-title">
            {winAv?.name} Wins!
          </h1>
          <p className="winner-podium-subtitle">
            Ultimate Card Champion
          </p>
        </div>

        <div className="rematch-voters-list">
          <h3 className="rematch-votes-title">
            Rematch Votes ({rematchVotes.length} / {connectedHumanPlayers.length})
          </h3>
          {connectedHumanPlayers.map((player) => {
            const playerAv = parsePlayerName(player.name);
            const voted = voteSet.has(player.seatIndex);
            return (
              <div className="rematch-voter-row" key={player.sessionId}>
                <span>
                  {playerAv.name} {player.seatIndex === meSeatIndex ? "(You)" : ""}
                </span>
                <strong className={voted ? "ready" : "waiting"}>
                  {voted ? "READY ✅" : "WAITING... ⏳"}
                </strong>
              </div>
            );
          })}
        </div>

        <button className="primary-btn vote-rematch-btn" onClick={onVoteRematch} type="button">
          Vote Rematch
        </button>
      </div>
    </div>
  );
}

export const WinnerPodium = memo(WinnerPodiumBase);

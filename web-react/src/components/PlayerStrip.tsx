import { memo } from "react";
import type { CSSProperties } from "react";
import { AvatarIcon } from "./AvatarIcon";
import { TurnTimerRing } from "./TurnTimerRing";
import type { PlayerSchema } from "../gameTypes";
import { getCardCountClass, getPlayerCardCount, parsePlayerName } from "../gameHelpers";
import {
  getPlayerPillAnchorId,
  getPlayerStripPositionClass,
  type ActionBubble,
} from "./tableRoomModel";

interface PlayerStripProps {
  players: PlayerSchema[];
  activeSeat: number;
  turnDeadline: number | undefined;
  skippedSeatIndex: number;
  actionBubbleBySeat: ReadonlyMap<number, ActionBubble>;
  botEmotions: Record<number, string>;
  setPlayerPillRef: (seatIndex: number, element: HTMLElement | null) => void;
}

function PlayerStripBase({
  players,
  activeSeat,
  turnDeadline,
  skippedSeatIndex,
  actionBubbleBySeat,
  botEmotions,
  setPlayerPillRef,
}: PlayerStripProps) {
  return (
    <>
      {players.map((player, idx) => {
        const active = player.seatIndex === activeSeat;
        const isSkipped = player.seatIndex === skippedSeatIndex;
        const av = parsePlayerName(player.name);
        const bubble = actionBubbleBySeat.get(player.seatIndex);
        const overrideEmoji = botEmotions[player.seatIndex];
        const cardCount = getPlayerCardCount(player);
        const posClass = getPlayerStripPositionClass(idx, players.length);

        return (
          <article
            className={`player-pill ${posClass} ${active ? "active" : ""} ${player.isBot ? "is-bot" : ""} ${isSkipped ? "skipped shake" : ""}`}
            key={player.sessionId}
            id={getPlayerPillAnchorId(player.seatIndex)}
            ref={(node) => setPlayerPillRef(player.seatIndex, node)}
          >
            <div className="avatar-wrapper-pill">
              {active && (
                <svg className="orbital-active-indicator" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
                </svg>
              )}
              <AvatarIcon symbol={av.symbol} theme={av.theme} size={32} glow={active} overrideEmoji={overrideEmoji} />
              <TurnTimerRing active={active} turnDeadline={turnDeadline} />
              {isSkipped && (
                <div className="skip-overlay-badge" aria-label="Skipped Turn">
                  🚫
                </div>
              )}
            </div>
            <div className="player-pill-info">
              <span>
                {player.isBot ? "Bot Seat" : "Player Seat"} {player.seatIndex + 1}
              </span>
              <strong className="player-pill-name">{av.name}</strong>
              <small className={`opponent-card-gauge ${getCardCountClass(cardCount)}`}>
                {cardCount} Cards
              </small>

              {bubble && (
                <div className="avatar-action-bubble" style={{ "--bubble-color": bubble.themeColor } as CSSProperties}>
                  {bubble.text}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}

export const PlayerStrip = memo(PlayerStripBase);

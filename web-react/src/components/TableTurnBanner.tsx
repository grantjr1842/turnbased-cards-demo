import type { CSSProperties } from "react";
import type { TurnBanner } from "./tableRoomOverlayFlow";

interface TableTurnBannerProps {
  turnBanner: TurnBanner;
}

export function TableTurnBanner({ turnBanner }: TableTurnBannerProps) {
  return (
    <div className="turn-banner-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div
        className="turn-banner-box"
        style={
          {
            "--banner-theme-color": turnBanner.themeColor,
          } as CSSProperties
        }>
        <span className="banner-emoji">{turnBanner.emoji}</span>
        <h2>{turnBanner.name}</h2>
        <p>{turnBanner.subtitle}</p>
      </div>
    </div>
  );
}

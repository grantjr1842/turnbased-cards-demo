import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { UnoColor } from "../gameTypes";

interface TableBoardStageProps {
  activeColor: UnoColor;
  spotlightPos: string;
  activePlayerThemeColor: string;
  children: ReactNode;
}

export const TableBoardStage = forwardRef<HTMLElement, TableBoardStageProps>(function TableBoardStage(
  { activeColor, spotlightPos, activePlayerThemeColor, children },
  ref,
) {
  return (
    <section
      ref={ref}
      className={`table-board active-${activeColor} spotlight-${spotlightPos}`}
      style={
        {
          "--active-player-color": activePlayerThemeColor,
        } as CSSProperties
      }
      aria-label="Game table felt"
    >
      {children}
    </section>
  );
});

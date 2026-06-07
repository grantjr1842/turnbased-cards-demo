import { memo } from "react";
import type { CSSProperties } from "react";
import { CardAtlasView } from "./CardAtlasView";
import type { CardBackSkin } from "../tableConfig";
import type { CardFlight, BurstParticle } from "./tableRoomMotion";

interface TableRoomFloatingEffectsProps {
  particles: BurstParticle[];
  flights: CardFlight[];
  colorblindMode: boolean;
  cardBackTheme: CardBackSkin;
}

function TableRoomFloatingEffectsBase({
  particles,
  flights,
  colorblindMode,
  cardBackTheme,
}: TableRoomFloatingEffectsProps) {
  return (
    <>
      <div className="particle-canvas">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={
              {
                left: `${p.x}px`,
                top: `${p.y}px`,
                "--tx": p.tx,
                "--ty": p.ty,
                "--tr": p.tr,
              } as CSSProperties
            }
          >
            {p.emoji}
          </div>
        ))}
      </div>

      <div className="flights-overlay">
        {flights.map((f) => (
          <div
            key={f.id}
            className={`flying-card-wrapper ${f.animating ? "animating" : ""}`}
            style={
              {
                "--start-x": `${f.startX}px`,
                "--start-y": `${f.startY}px`,
                "--end-x": `${f.endX}px`,
                "--end-y": `${f.endY}px`,
                "--end-rot": `${f.rotation}deg`,
              } as CSSProperties
            }
          >
            <CardAtlasView card={f.card} isBack={f.isBack} colorblind={colorblindMode} skin={cardBackTheme} />
          </div>
        ))}
      </div>
    </>
  );
}

export const TableRoomFloatingEffects = memo(TableRoomFloatingEffectsBase);

import type { CSSProperties } from "react";
import { ATLAS_ORDER } from "../tableConfig";

export function LobbyHeroPreview() {
  return (
    <section className="brand-panel" aria-label="Wild Table preview">
      <div className="table-sculpture">
        <div className="table-rail" />
        <div className="table-felt-mini" />
        <div className="lobby-hero-hand">
          {["red", "blue", "yellow", "green", "wild"].map((color, index) => {
            const fileKey = color === "wild" ? "wild" : `${color}_5`;
            const tileIdx = ATLAS_ORDER.indexOf(fileKey);
            const col = tileIdx !== -1 ? tileIdx % 10 : 52;
            const row = tileIdx !== -1 ? Math.floor(tileIdx / 10) : 5;
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
      <div className="brand-copy lobby-brand-copy">
        <h1>Wild Table</h1>
        <p>An elegant, high-fidelity real-time card table. Seamless turns, live spectators, and smooth glassmorphic interfaces.</p>
      </div>
    </section>
  );
}

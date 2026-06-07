import { memo } from "react";
import type { CSSProperties, RefObject } from "react";
import { CardAtlasView } from "./CardAtlasView";
import { PlayDirectionRing } from "./PlayDirectionRing";
import {
  DECK_STACK_ANCHOR_ID,
  DISCARD_PILE_ANCHOR_ID,
  buildDiscardBackdropCards,
  getDiscardCardTransform,
} from "./tableRoomModel";
import type { CardBackSkin } from "../tableConfig";
import type { CardSchema, PlayDirection, UnoColor } from "../gameTypes";

interface TableRoomCenterTableProps {
  activeColor: UnoColor;
  direction: PlayDirection;
  tableReady: boolean;
  isMyTurn: boolean;
  drawCard: () => void;
  deckStackRef: RefObject<HTMLButtonElement | null>;
  deckLayerCount: number;
  deckCount: number;
  cardBackTheme: CardBackSkin;
  shouldDrawHint: boolean;
  discardPile: CardSchema[];
  discardPileRef: RefObject<HTMLDivElement | null>;
  shockwaves: { id: string; color: string }[];
  topCard: CardSchema | null;
  pendingDraw: number;
  colorblindMode: boolean;
}

function TableRoomCenterTableBase({
  activeColor,
  direction,
  tableReady,
  isMyTurn,
  drawCard,
  deckStackRef,
  deckLayerCount,
  deckCount,
  cardBackTheme,
  shouldDrawHint,
  discardPile,
  discardPileRef,
  shockwaves,
  topCard,
  pendingDraw,
  colorblindMode,
}: TableRoomCenterTableProps) {
  return (
    <div className="center-table">
      <PlayDirectionRing direction={direction} />

      {tableReady && (
        <div className={`active-color-badge color-${activeColor}`}>
          <div className="prism-shimmer" />
          <span className={`color-dot color-${activeColor}`} />
          <span>{activeColor}</span>
        </div>
      )}

      <button
        id={DECK_STACK_ANCHOR_ID}
        ref={deckStackRef}
        className={`deck-stack ${shouldDrawHint ? "guidance-pulse" : ""}`}
        disabled={!isMyTurn || !tableReady}
        onClick={drawCard}
        type="button"
        aria-label="Draw card deck"
      >
        {Array.from({ length: deckLayerCount }).map((_, i) => (
          <div key={i} className={`deck-card-layer layer-${deckLayerCount - i}`} />
        ))}
        <div className="deck-top-card">
          <CardAtlasView card={null} isBack skin={cardBackTheme} />
        </div>
        <div className="deck-count-overlay">
          <span>{deckCount}</span>
        </div>
        {shouldDrawHint && (
          <div className="draw-guidance-tooltip" role="tooltip">
            <span>Draw a card!</span>
          </div>
        )}
      </button>

      {tableReady ? (
        <div className="pile-container" id={DISCARD_PILE_ANCHOR_ID} ref={discardPileRef}>
          {shockwaves.map((sw) => (
            <div key={sw.id} className={`discard-shockwave color-${sw.color}`} />
          ))}
          {buildDiscardBackdropCards(discardPile).map((histCard) => (
            <div
              key={histCard.id}
              className="discard-card"
              style={
                {
                  transform: histCard.transform,
                  opacity: histCard.opacity,
                } as CSSProperties
              }
            >
              <CardAtlasView card={histCard.card} colorblind={colorblindMode} />
            </div>
          ))}
          <div
            className="discard-card"
            style={
              {
                transform: getDiscardCardTransform(discardPile.length - 1),
              } as CSSProperties
            }
          >
            <CardAtlasView card={topCard} colorblind={colorblindMode} />
          </div>
        </div>
      ) : (
        <div className="table-empty-state">
          <span>Syncing Table</span>
          <strong>Dealing Cards...</strong>
          <small>Awaiting server synchronization deal.</small>
        </div>
      )}

      {pendingDraw > 0 && (
        <div
          className="pending-draw-badge"
          role="status"
          aria-live="polite"
          aria-label={`Draw penalty pending: plus ${pendingDraw}`}
          title={`Draw penalty pending: plus ${pendingDraw}`}
        >
          +{pendingDraw}
        </div>
      )}
    </div>
  );
}

export const TableRoomCenterTable = memo(TableRoomCenterTableBase);

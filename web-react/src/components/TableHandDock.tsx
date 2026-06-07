import { forwardRef, memo } from "react";
import type { CSSProperties, RefObject } from "react";
import { HandCardItem } from "./HandCardItem";
import type { GuidanceState } from "./tableRoomHand";
import type { CardSchema, UnoColor } from "../gameTypes";
import { getActionCalloutLabel, type ActionCallout } from "./tableRoomHand";
import { HAND_DOCK_ANCHOR_ID, type ActionBubble } from "./tableRoomModel";

interface HandDockProps {
  isMyTurn: boolean;
  emptyHandLabel: string;
  showUnoButton: boolean;
  onCallUno: () => void;
  actionCallout: ActionCallout;
  guidanceText: string;
  sortBy: "none" | "color" | "value";
  setSortBy: (value: "none" | "color" | "value") => void;
  actionBubbleLocal: ActionBubble | undefined;
  hand: CardSchema[];
  playableCardIds: ReadonlySet<string>;
  handCount: number;
  handMid: number;
  dynamicFanAngle: number;
  dynamicFanOffset: number;
  dynamicMarginValue: string;
  selectedCardId: string | null;
  setSelectedCardId: (cardId: string | null) => void;
  playCard: (card: CardSchema, color?: UnoColor) => void;
  onUnplayableTap: (card: CardSchema) => void;
  scrollHand: (direction: "left" | "right") => void;
  handScrollRef: RefObject<HTMLDivElement | null>;
  colorblindMode: boolean;
  guidanceStatus: GuidanceState["guidanceStatus"];
}

const TableHandDockBase = forwardRef<HTMLElement, HandDockProps>(function TableHandDock(
  {
    isMyTurn,
    emptyHandLabel,
    showUnoButton,
    actionCallout,
    guidanceText,
    guidanceStatus,
    sortBy,
    setSortBy,
    actionBubbleLocal,
    hand,
    playableCardIds,
    handCount,
    handMid,
    dynamicFanAngle,
    dynamicFanOffset,
    dynamicMarginValue,
    selectedCardId,
    setSelectedCardId,
    playCard,
    onUnplayableTap,
    scrollHand,
    handScrollRef,
    colorblindMode,
    onCallUno,
  },
  ref,
) {
  return (
    <section
      id={HAND_DOCK_ANCHOR_ID}
      ref={ref}
      className={`hand-dock ${isMyTurn ? "my-turn" : ""}`}
      aria-label="Your hand cards dock"
    >
      {actionCallout && (
        <div
          className={`turn-action-callout ${actionCallout.kind}`}
          data-action-kind={actionCallout.kind}
          role="status"
        >
          <span>{getActionCalloutLabel(actionCallout)}</span>
          <strong>{actionCallout.title}</strong>
          <small>{actionCallout.text}</small>
        </div>
      )}

      <div className="hand-header hand-header-layout">
        <div className="hand-header-copy">
          <span>{isMyTurn ? "YOUR TURN" : "YOUR HAND"}</span>
          <strong className={`hand-guidance-text ${guidanceStatus}`}>{guidanceText}</strong>
        </div>

        {actionBubbleLocal && (
          <div className="avatar-action-bubble local" style={{ "--bubble-color": actionBubbleLocal.themeColor } as CSSProperties}>
            {actionBubbleLocal.text}
          </div>
        )}

        <div className="hand-header-actions">
          <div className="sort-row">
            <button
              className={`sort-btn ${sortBy === "none" ? "active" : ""}`}
              onClick={() => setSortBy("none")}
              type="button"
              aria-label="Sort hand by default"
              title="Sort hand by default"
            >
              <span className="sort-btn-label">Default</span>
              <span className="sort-btn-short">Def</span>
            </button>
            <button
              className={`sort-btn ${sortBy === "color" ? "active" : ""}`}
              onClick={() => setSortBy("color")}
              type="button"
              aria-label="Sort hand by color"
              title="Sort hand by color"
            >
              <span className="sort-btn-label">Color</span>
              <span className="sort-btn-short">Col</span>
            </button>
            <button
              className={`sort-btn ${sortBy === "value" ? "active" : ""}`}
              onClick={() => setSortBy("value")}
              type="button"
              aria-label="Sort hand by rank"
              title="Sort hand by rank"
            >
              <span className="sort-btn-label">Rank</span>
              <span className="sort-btn-short">Rnk</span>
            </button>
          </div>

          {showUnoButton && (
            <button
              className="uno-btn"
              onClick={onCallUno}
              type="button"
            >
              UNO!
            </button>
          )}
        </div>
      </div>

      <div className="hand-scroll-frame">
        {handCount > 5 && (
          <button className="scroll-indicator-btn left" onClick={() => scrollHand("left")} type="button">
            ◀
          </button>
        )}
        <div className="hand-scroll-wrapper" ref={handScrollRef}>
          {handCount === 0 ? (
            <p className="empty-hand">{emptyHandLabel}</p>
          ) : (
            hand.map((card, idx) => {
              const playable = isMyTurn && playableCardIds.has(card.id);
              const isSelected = card.id === selectedCardId;
              return (
                <HandCardItem
                  key={card.id}
                  card={card}
                  idx={idx}
                  handMid={handMid}
                  dynamicFanAngle={dynamicFanAngle}
                  dynamicFanOffset={dynamicFanOffset}
                  playable={playable}
                  isSelected={isSelected}
                  colorblindMode={colorblindMode}
                  dynamicMarginValue={dynamicMarginValue}
                  setSelectedCardId={setSelectedCardId}
                  playCard={playCard}
                  onUnplayableTap={onUnplayableTap}
                />
              );
            })
          )}
        </div>
        {handCount > 5 && (
          <button className="scroll-indicator-btn right" onClick={() => scrollHand("right")} type="button">
            ▶
          </button>
        )}
      </div>
    </section>
  );
});

export const TableHandDock = memo(TableHandDockBase);

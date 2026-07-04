import type { CSSProperties, RefObject } from "react";
import { HandCardItem } from "./HandCardItem";
import type { CardSchema, UnoColor, UnoState } from "../gameTypes";
import { cardLabel, isPlayable } from "../gameHelpers";
import { sfx } from "../audio/sfx";
import { isHandInteractive, type ActionCallout, type TurnCoachState } from "./tableRoomControllerLogic";
import { TableTurnCoach } from "./TableTurnCoach";

interface HandDockProps {
  room: { send: (type: string, payload?: unknown) => void } | null;
  state: UnoState | null;
  meSeatIndex: number | undefined;
  isMyTurn: boolean;
  actionCallout: ActionCallout;
  turnCoach: TurnCoachState;
  guidanceText: string;
  guidanceStatus: string;
  sortBy: "none" | "color" | "value";
  setSortBy: (value: "none" | "color" | "value") => void;
  actionBubbleLocal: { text: string; themeColor: string } | undefined;
  hand: CardSchema[];
  handCount: number;
  playableCardCount: number;
  selectedCard: CardSchema | null;
  handMid: number;
  dynamicFanAngle: number;
  dynamicFanOffset: number;
  dynamicMarginValue: string;
  selectedCardIdx: number;
  setSelectedCardIdx: (idx: number) => void;
  playCard: (card: CardSchema, color?: UnoColor) => void;
  onUnplayableTap: (card: CardSchema) => void;
  scrollHand: (direction: "left" | "right") => void;
  onShowRules: () => void;
  onClearSelection: () => void;
  handScrollRef: RefObject<HTMLDivElement | null>;
  colorblindMode: boolean;
}

export function TableHandDock({
  room,
  state,
  meSeatIndex,
  isMyTurn,
  actionCallout,
  turnCoach,
  guidanceText,
  guidanceStatus,
  sortBy,
  setSortBy,
  actionBubbleLocal,
  hand,
  handCount,
  playableCardCount,
  selectedCard,
  handMid,
  dynamicFanAngle,
  dynamicFanOffset,
  dynamicMarginValue,
  selectedCardIdx,
  setSelectedCardIdx,
  playCard,
  onUnplayableTap,
  scrollHand,
  onShowRules,
  onClearSelection,
  handScrollRef,
  colorblindMode,
}: HandDockProps) {
  return (
    <section
      id="hand-dock"
      className={`hand-dock ${isMyTurn ? "my-turn" : ""}`}
      aria-label="Your hand cards dock"
    >
      <TableTurnCoach
        coach={turnCoach}
        isMyTurn={isMyTurn}
        playableCardCount={playableCardCount}
        handCount={handCount}
        onDrawCard={() => room?.send("draw_card")}
        onPlaySelected={() => {
          if (selectedCard) {
            playCard(selectedCard);
          }
        }}
        onCallUno={() => {
          sfx.playUno();
          room?.send("uno");
        }}
        onFocusRules={onShowRules}
        onClearSelection={onClearSelection}
        selectedCardLabel={selectedCard ? cardLabel(selectedCard) : null}
      />

      {actionCallout && (
        <div
          className={`turn-action-callout ${actionCallout.kind}`}
          data-action-kind={actionCallout.kind}
          role="status"
        >
          <span>{actionCallout.kind === "uno" ? "Action required" : "Draw penalty active"}</span>
          <strong>{actionCallout.title}</strong>
          <small>{actionCallout.text}</small>
        </div>
      )}

      <div className="hand-header hand-header-layout">
        <div className="hand-header-copy">
          <span>{isMyTurn ? "YOUR MOVE" : "YOUR HAND"}</span>
          <strong className={`hand-guidance-text ${guidanceStatus}`}>{guidanceText}</strong>
          <div className="hand-metric-row" aria-label="Turn summary">
            <span className="hand-metric-pill">{handCount} cards</span>
            <span className="hand-metric-pill">
              {isMyTurn ? `${playableCardCount} legal play${playableCardCount === 1 ? "" : "s"}` : "Watching table"}
            </span>
            {isMyTurn && (
              <span className="hand-metric-pill subtle">
                {playableCardCount > 0 ? "Tap a card to preview" : "Tap the deck to reset"}
              </span>
            )}
          </div>
        </div>

        {actionBubbleLocal && (
          <div className="avatar-action-bubble local" style={{ "--bubble-color": actionBubbleLocal.themeColor } as CSSProperties}>
            {actionBubbleLocal.text}
          </div>
        )}

        <div className="hand-header-actions">
          <div className="sort-row">
            <button className={`sort-btn ${sortBy === "none" ? "active" : ""}`} onClick={() => setSortBy("none")} type="button">
              Default
            </button>
            <button className={`sort-btn ${sortBy === "color" ? "active" : ""}`} onClick={() => setSortBy("color")} type="button">
              Color
            </button>
            <button className={`sort-btn ${sortBy === "value" ? "active" : ""}`} onClick={() => setSortBy("value")} type="button">
              Rank
            </button>
          </div>

          {state?.unoCaller === meSeatIndex && (
            <button
              className="uno-btn"
              onClick={() => {
                sfx.playUno();
                room?.send("uno");
              }}
              type="button"
            >
              UNO!
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        {handCount > 5 && (
          <button className="scroll-indicator-btn left" onClick={() => scrollHand("left")} type="button">
            ◀
          </button>
        )}
        <div className="hand-scroll-wrapper" ref={handScrollRef}>
          {handCount === 0 ? (
            <p className="empty-hand">{state ? "Dealing initial cards..." : "Spectating Table"}</p>
          ) : (
            hand.map((card, idx) => {
              const playable = isMyTurn && isPlayable(card, state);
              const isSelected = idx === selectedCardIdx;
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
                  canInteract={isHandInteractive(isMyTurn)}
                  colorblindMode={colorblindMode}
                  dynamicMarginValue={dynamicMarginValue}
                  setSelectedCardIdx={setSelectedCardIdx}
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
}

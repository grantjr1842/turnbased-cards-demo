import type { RefObject } from "react";
import { CardAtlasView } from "./CardAtlasView";
import { RULE_CARD_EXAMPLES } from "./tableRoomModel";

interface TableRulesDrawerProps {
  colorblindMode: boolean;
  rulesDialogRef: RefObject<HTMLDivElement | null>;
  onReplayGuide: () => void;
  onCloseRules: () => void;
}

export function TableRulesDrawer({
  colorblindMode,
  rulesDialogRef,
  onReplayGuide,
  onCloseRules,
}: TableRulesDrawerProps) {
  return (
    <>
      <div className="drawer-overlay" onClick={onCloseRules} />
      <div
        className="drawer-content"
        ref={rulesDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-drawer-title"
        tabIndex={-1}
      >
        <div className="drawer-header">
          <h2 id="rules-drawer-title">Rules & shortcuts</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="ghost-btn" data-testid="rules-replay-guide" onClick={onReplayGuide} type="button">
              Replay guide
            </button>
            <button className="ghost-btn" data-testid="rules-close" onClick={onCloseRules} type="button">
              Close
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <section>
            <h3 style={{ color: "var(--gold)", marginBottom: "8px" }}>Keyboard shortcuts</h3>
            <ul
              style={{
                listStyle: "none",
                paddingLeft: 0,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
              }}
            >
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>◀</kbd>
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>▶</kbd>{" "}
                Move between cards
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Space</kbd>
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Enter</kbd>{" "}
                Play selected card
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>D</kbd>{" "}
                Draw from the deck
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>U</kbd>{" "}
                Call UNO
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>C</kbd>{" "}
                Focus chat input
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>R</kbd>{" "}
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Y</kbd>{" "}
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>G</kbd>{" "}
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>B</kbd>{" "}
                Choose wild color
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Esc</kbd>{" "}
                Cancel wild color selection
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>?</kbd>{" "}
                Toggle rules
              </li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: "var(--gold)", marginBottom: "8px" }}>UNO rules</h3>
            <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-muted)" }}>
              Match the top discard card by color or rank. When you have exactly one card left in
              hand, you must click the <strong>UNO!</strong> button (or press <kbd>U</kbd>)
              before your next move. Failing to do so triggers a{" "}
              <strong>2-card draw penalty</strong>.
            </p>
            <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-muted)", marginTop: "8px" }}>
              <strong>Draw Penalties:</strong> Draw-2 and Wild Draw-4 cards force the next player
              to draw the stated number of cards and lose their turn. Wild Draw-4 can be
              challenged if the player had a matching color in hand.
            </p>
          </section>

          <section>
            <h3 style={{ color: "var(--gold)", marginBottom: "8px" }}>Action card guide</h3>
            <p className="rule-guide-intro">
              Number cards match by color or number. These illustrated cards change the move:
            </p>
            <ul className="rule-card-grid">
              {RULE_CARD_EXAMPLES.map(({ card, title, text }) => (
                <li key={card.id}>
                  <div className="rule-card-preview" aria-hidden="true">
                    <CardAtlasView card={card} colorblind={colorblindMode} />
                  </div>
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

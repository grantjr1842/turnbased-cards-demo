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
          <h2 id="rules-drawer-title">Rules & Shortcuts</h2>
          <div className="drawer-actions">
            <button className="ghost-btn" data-testid="rules-replay-guide" onClick={onReplayGuide} type="button">
              Replay guide
            </button>
            <button className="ghost-btn" data-testid="rules-close" onClick={onCloseRules} type="button">
              Close
            </button>
          </div>
        </div>
        <div className="drawer-stack">
          <section>
            <h3 className="drawer-section-title">Keyboard Shortcuts</h3>
            <ul className="shortcut-list">
              <li>
                <kbd className="shortcut-kbd">◀</kbd>
                /{" "}
                <kbd className="shortcut-kbd">▶</kbd>{" "}
                Select Cards
              </li>
              <li>
                <kbd className="shortcut-kbd">Space</kbd>
                /{" "}
                <kbd className="shortcut-kbd">Enter</kbd>{" "}
                Play Selected Card
              </li>
              <li>
                <kbd className="shortcut-kbd">D</kbd>{" "}
                Draw Card from deck
              </li>
              <li>
                <kbd className="shortcut-kbd">U</kbd>{" "}
                Call UNO!
              </li>
              <li>
                <kbd className="shortcut-kbd">C</kbd>{" "}
                Open & Focus Chat input
              </li>
              <li>
                <kbd className="shortcut-kbd">R</kbd>{" "}
                /{" "}
                <kbd className="shortcut-kbd">Y</kbd>{" "}
                /{" "}
                <kbd className="shortcut-kbd">G</kbd>{" "}
                /{" "}
                <kbd className="shortcut-kbd">B</kbd>{" "}
                Select Wild Color (Red/Yellow/Green/Blue)
              </li>
              <li>
                <kbd className="shortcut-kbd">Esc</kbd>{" "}
                Cancel Wild Color selection
              </li>
              <li>
                <kbd className="shortcut-kbd">?</kbd>{" "}
                Open/Close Rules Drawer
              </li>
            </ul>
          </section>

          <section>
            <h3 className="drawer-section-title">Wild Table UNO Rules</h3>
            <p className="drawer-copy">
              Match the top card of the discard pile by color or rank. When you have exactly one
              card left in hand, you MUST click the <strong>UNO!</strong> button (or press{" "}
              <kbd>U</kbd>) before playing your second-to-last card. Failing to do so triggers a{" "}
              <strong>2-card draw penalty</strong>!
            </p>
            <p className="drawer-copy drawer-copy-spaced">
              <strong>Draw Stacking:</strong> Draw-2 and Wild Draw-4 cards accumulate pending
              draw values. Draw stack triggers must be drawn unless stacked further with another
              matching draw card.
            </p>
          </section>

          <section>
            <h3 className="drawer-section-title">Action Card Guide</h3>
            <p className="rule-guide-intro">
              Number cards match by color or number. These illustrated cards change the turn:
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

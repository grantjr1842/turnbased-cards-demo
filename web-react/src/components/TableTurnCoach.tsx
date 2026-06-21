import type { ReactNode } from "react";
import type { TurnCoachState } from "./tableRoomControllerLogic";

interface TableTurnCoachProps {
  coach: TurnCoachState;
  isMyTurn: boolean;
  playableCardCount: number;
  handCount: number;
  onDrawCard: () => void;
  onPlaySelected: () => void;
  onCallUno: () => void;
  onFocusRules: () => void;
  onClearSelection: () => void;
  selectedCardLabel: string | null;
}

function getAccentLabel(accent: TurnCoachState["accent"]) {
  if (accent === "urgent") return "urgent";
  if (accent === "warning") return "warning";
  if (accent === "play") return "play";
  return "calm";
}

function CoachButton({
  children,
  kind,
  onClick,
}: {
  children: ReactNode;
  kind: "primary" | "ghost";
  onClick: () => void;
}) {
  return (
    <button
      className={kind === "primary" ? "coach-action-btn primary" : "coach-action-btn ghost"}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function TableTurnCoach({
  coach,
  isMyTurn,
  playableCardCount,
  handCount,
  onDrawCard,
  onPlaySelected,
  onCallUno,
  onFocusRules,
  onClearSelection,
  selectedCardLabel,
}: TableTurnCoachProps) {
  const accent = getAccentLabel(coach.accent);
  const canDrawFallback = isMyTurn && coach.primaryAction !== "draw" && coach.primaryAction !== "uno";
  const legalPlayLabel = `${playableCardCount} legal play${playableCardCount === 1 ? "" : "s"}`;
  return (
    <section className={`table-coach ${accent}`} aria-live="polite">
      <div className="table-coach-hero">
        <div className="table-coach-copy">
          <span className="table-coach-eyebrow">{coach.eyebrow}</span>
          <strong>{coach.title}</strong>
          <small>{coach.subtitle}</small>
        </div>

        <div className="table-coach-badges">
          <span className="table-coach-badge accent">{coach.colorHint}</span>
          <span className="table-coach-badge subtle">{isMyTurn ? legalPlayLabel : `${handCount} cards in hand`}</span>
          {selectedCardLabel && (
            <span className="table-coach-badge selected">Selected: {selectedCardLabel}</span>
          )}
        </div>
      </div>

      <div className="table-coach-grid">
        <ol className="table-coach-steps">
          {coach.steps.map((step, idx) => (
            <li key={step.title} className={step.state}>
              <b aria-hidden="true">{step.state === "done" ? "✓" : step.state === "active" ? "•" : String(idx + 1)}</b>
              <span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="table-coach-actions">
          <div className="table-coach-rules" role="status">
            <span>{coach.primaryHint}</span>
          </div>
          <div className="table-coach-button-row">
            {isMyTurn && coach.primaryAction === "play" && (
              <CoachButton kind="primary" onClick={onPlaySelected}>
                {coach.primaryLabel ?? "Play selected"}
              </CoachButton>
            )}
            {isMyTurn && coach.primaryAction === "draw" && (
              <CoachButton kind="primary" onClick={onDrawCard}>
                {coach.primaryLabel ?? "Draw card"}
              </CoachButton>
            )}
            {isMyTurn && coach.primaryAction === "uno" && (
              <CoachButton kind="primary" onClick={onCallUno}>
                {coach.primaryLabel ?? "UNO!"}
              </CoachButton>
            )}
            {canDrawFallback && (
              <CoachButton kind="ghost" onClick={onDrawCard}>
                Draw card
              </CoachButton>
            )}
            {isMyTurn && coach.primaryAction !== "uno" && (
              <CoachButton kind="ghost" onClick={onFocusRules}>
                Rules
              </CoachButton>
            )}
            {selectedCardLabel && isMyTurn && (
              <CoachButton kind="ghost" onClick={onClearSelection}>
                Clear selection
              </CoachButton>
            )}
          </div>
          {selectedCardLabel && isMyTurn && coach.primaryAction !== "uno" && (
            <small className="table-coach-selection">Selected: {selectedCardLabel}</small>
          )}
        </div>
      </div>
    </section>
  );
}

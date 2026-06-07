interface ColorblindToggleButtonProps {
  active: boolean;
  onToggle: () => void;
  variant: "lobby" | "topbar";
}

export function ColorblindToggleButton({ active, onToggle, variant }: ColorblindToggleButtonProps) {
  const isLobbyVariant = variant === "lobby";
  const buttonClassName = isLobbyVariant
    ? `accessibility-toggle-btn ${active ? "active" : ""}`
    : `ghost-btn topbar-toggle-btn ${active ? "active-acc" : ""}`;
  const title = isLobbyVariant
    ? `Colorblind Mode: ${active ? "On" : "Off"}`
    : "Toggle colorblind accessibility symbols";

  return (
    <button
      className={buttonClassName}
      onClick={onToggle}
      type="button"
      aria-pressed={active}
      aria-label={`Colorblind Mode: ${active ? "On" : "Off"}`}
      title={title}
    >
      {isLobbyVariant ? (
        <>
          <span className="accessibility-toggle-label-full">♿ Colorblind Mode</span>
          <span className="accessibility-toggle-label-short">♿ CB</span>
          <span className="accessibility-toggle-state">{active ? "On" : "Off"}</span>
        </>
      ) : (
        <>
          <span className="topbar-btn-label">♿ {active ? "CB: On" : "CB: Off"}</span>
          <span className="topbar-btn-short">CB</span>
        </>
      )}
    </button>
  );
}

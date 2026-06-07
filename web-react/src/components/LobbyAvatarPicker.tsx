import type { CSSProperties } from "react";
import { sfx } from "../audio/sfx";
import { AvatarIcon } from "./AvatarIcon";
import { AVATAR_SYMBOLS, AVATAR_THEMES } from "../tableConfig";
import type { LobbyFormState } from "../hooks/useLobbyFormState";

interface LobbyAvatarPickerProps {
  form: Pick<
    LobbyFormState,
    "avatarSymbol" | "avatarTheme" | "setAvatarSymbol" | "setAvatarTheme"
  >;
}

export function LobbyAvatarPicker({ form }: LobbyAvatarPickerProps) {
  const { avatarSymbol, avatarTheme, setAvatarSymbol, setAvatarTheme } = form;

  return (
    <div className="avatar-creator-panel">
      <span>Customize Avatar</span>
      <div className="avatar-creator-layout">
        <AvatarIcon symbol={avatarSymbol} theme={avatarTheme} size={64} glow />
        <div className="avatar-creator-picker-column">
          <div className="avatar-grid-picker">
            {AVATAR_SYMBOLS.map((sym) => (
              <button
                key={sym.id}
                className={`avatar-picker-btn ${avatarSymbol === sym.id ? "active" : ""}`}
                onClick={() => {
                  setAvatarSymbol(sym.id);
                  sfx.playPluck();
                }}
                type="button"
                title={sym.name}
              >
                {sym.emoji}
              </button>
            ))}
          </div>
          <div className="theme-grid-picker">
            {AVATAR_THEMES.map((th) => (
              <button
                key={th.id}
                className={`theme-picker-btn ${avatarTheme === th.id ? "active" : ""}`}
                style={{ "--theme-color-highlight": th.primary } as CSSProperties}
                onClick={() => {
                  setAvatarTheme(th.id);
                  sfx.playPluck();
                }}
                type="button"
              >
                {th.name.split(" ")[1]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

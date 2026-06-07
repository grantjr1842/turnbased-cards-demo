import { useLobbyFormState } from "../hooks/useLobbyFormState";
import { LobbyShell } from "./LobbyShell";
import { LobbyHeroPreview } from "./LobbyHeroPreview";
import { LobbyJoinPanel } from "./LobbyJoinPanel";

interface LobbyProps {
  busy: boolean;
  error: string;
  onQuickPlay: (options: Record<string, unknown>) => void;
  onJoinCode: (roomId: string, options: Record<string, unknown>) => void;
  onWatch: (roomId: string) => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
}

export function Lobby({
  busy,
  error,
  onQuickPlay,
  onJoinCode,
  onWatch,
  colorblindMode,
  onToggleColorblind,
}: LobbyProps) {
  const form = useLobbyFormState();

  return (
    <LobbyShell>
      <LobbyHeroPreview />

      <LobbyJoinPanel
        busy={busy}
        error={error}
        colorblindMode={colorblindMode}
        onToggleColorblind={onToggleColorblind}
        onQuickPlay={onQuickPlay}
        onJoinCode={onJoinCode}
        onWatch={onWatch}
        form={form}
      />
    </LobbyShell>
  );
}

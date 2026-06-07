import { TableShell } from "./TableShell";
import { TableTopbar } from "./TableTopbar";
import { TableRoomBoard } from "./TableRoomBoard";
import { TableRoomOverlays } from "./TableRoomOverlays";
import { TableRoomLowerChrome } from "./TableRoomLowerChrome";
import type { TableRoomController } from "./useTableRoomController";

interface TableRoomViewProps {
  controller: TableRoomController;
  onLeave: () => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  disconnected: boolean;
}

export function TableRoomView({
  controller,
  onLeave,
  colorblindMode,
  onToggleColorblind,
  disconnected,
}: TableRoomViewProps) {
  const { topbar, board, overlays, lowerChrome, hasOneCardWarning } = controller;

  return (
    <TableShell>
      {hasOneCardWarning && <div className="uno-hazard-siren" />}
      {disconnected && (
        <div className="disconnection-banner" role="alert" aria-live="assertive">
          <span>Connection lost — reconnecting...</span>
        </div>
      )}
      <TableTopbar {...topbar} colorblindMode={colorblindMode} onToggleColorblind={onToggleColorblind} onLeave={onLeave} />

      <TableRoomBoard {...board} colorblindMode={colorblindMode} />

      <TableRoomOverlays {...overlays} colorblindMode={colorblindMode} />

      <TableRoomLowerChrome
        handDockRef={lowerChrome.handDockRef}
        winnerPodium={lowerChrome.winnerPodium}
        sidePanel={lowerChrome.sidePanel}
        handDock={lowerChrome.handDock}
        chatPanel={lowerChrome.chatPanel}
        floatingEffects={lowerChrome.floatingEffects}
        colorblindMode={colorblindMode}
      />
    </TableShell>
  );
}

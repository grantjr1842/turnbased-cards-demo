import { memo } from "react";
import { TableHandDock } from "./TableHandDock";
import { TableRoomChatPanel } from "./TableRoomChatPanel";
import { TableRoomFloatingEffects } from "./TableRoomFloatingEffects";
import { TableSidePanel } from "./TableSidePanel";
import { WinnerPodium } from "./WinnerPodium";
import type { TableRoomController } from "./useTableRoomController";

interface TableRoomLowerChromeProps {
  handDockRef: TableRoomController["lowerChrome"]["handDockRef"];
  winnerPodium: TableRoomController["lowerChrome"]["winnerPodium"];
  sidePanel: TableRoomController["lowerChrome"]["sidePanel"];
  handDock: TableRoomController["lowerChrome"]["handDock"];
  chatPanel: TableRoomController["lowerChrome"]["chatPanel"];
  floatingEffects: TableRoomController["lowerChrome"]["floatingEffects"];
  colorblindMode: boolean;
}

function TableRoomLowerChromeBase({
  handDockRef,
  winnerPodium,
  sidePanel,
  handDock,
  chatPanel,
  floatingEffects,
  colorblindMode,
}: TableRoomLowerChromeProps) {
  return (
    <>
      {winnerPodium.winnerPlayer && <WinnerPodium {...winnerPodium} />}

      <TableSidePanel {...sidePanel} />

      <TableHandDock {...handDock} colorblindMode={colorblindMode} ref={handDockRef} />

      <TableRoomChatPanel {...chatPanel} />

      <TableRoomFloatingEffects {...floatingEffects} colorblindMode={colorblindMode} />
    </>
  );
}

export const TableRoomLowerChrome = memo(TableRoomLowerChromeBase);

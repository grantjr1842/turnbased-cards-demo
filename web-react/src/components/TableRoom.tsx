import { TableRoomView } from "./TableRoomView";
import {
  useTableRoomController,
  type TableRoomControllerProps,
} from "./useTableRoomController";

interface TableRoomProps {
  room: TableRoomControllerProps["room"];
  state: TableRoomControllerProps["state"];
  showToast: TableRoomControllerProps["showToast"];
  onLeave: () => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  disconnected: boolean;
}

export function TableRoom(props: TableRoomProps) {
  const { room, state, onLeave, colorblindMode, onToggleColorblind, disconnected, showToast } =
    props;
  const controller = useTableRoomController({
    room,
    state,
    showToast,
  });

  return (
    <TableRoomView
      controller={controller}
      onLeave={onLeave}
      colorblindMode={colorblindMode}
      onToggleColorblind={onToggleColorblind}
      disconnected={disconnected}
    />
  );
}

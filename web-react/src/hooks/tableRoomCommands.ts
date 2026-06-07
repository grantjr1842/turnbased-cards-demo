import type { Room } from "@colyseus/sdk";
import type { UnoColor, UnoState } from "../gameTypes";

export type TableRoomCommandMap = {
  play_card: { cardId: string; chosenColor?: UnoColor };
  draw_card: undefined;
  vote_rematch: undefined;
  chat: { text: string };
  ping: undefined;
  uno: undefined;
};

export type TableRoomCommandName = keyof TableRoomCommandMap;

export type TableRoomSendArgs<T extends TableRoomCommandName> = TableRoomCommandMap[T] extends undefined
  ? []
  : [TableRoomCommandMap[T]];

export function sendTableRoomCommand<T extends TableRoomCommandName>(
  room: Room<UnoState> | null,
  type: T,
  ...args: TableRoomSendArgs<T>
) {
  if (!room) return false;
  try {
    if (args.length === 0) {
      room.send(type);
    } else {
      room.send(type, args[0]);
    }
    return true;
  } catch {
    return false;
  }
}

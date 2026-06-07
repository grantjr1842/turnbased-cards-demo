import { useCallback } from "react";
import type { Room } from "@colyseus/sdk";
import { CARD_BACK_SKINS_BY_ID, type CardBackSkin } from "../tableConfig.ts";
import type { CardSchema, Toast, UnoColor, UnoState } from "../gameTypes";
import { sendTableRoomCommand, type TableRoomCommandName, type TableRoomSendArgs } from "./tableRoomCommands";
import { getRoomCommandFailureToast } from "./roomSessionModel";

interface UseTableRoomCommandsArgs {
  room: Room<UnoState> | null;
  wildFor: CardSchema | null;
  isMyTurn: boolean;
  tableReady: boolean;
  meSeatIndex: number | null | undefined;
  unoCaller: number | null | undefined;
  setWildFor: (card: CardSchema | null) => void;
  setSelectedCardId: (cardId: string | null) => void;
  setChatText: (text: string) => void;
  setCardBackTheme: (theme: CardBackSkin) => void;
  showToast: (message: string, kind?: Toast["kind"]) => void;
}

export interface TableRoomCommands {
  playCard: (card: CardSchema, color?: UnoColor) => void;
  drawCard: () => void;
  voteRematch: () => void;
  submitChat: (message: string) => void;
  handleSetCardBackTheme: (theme: CardBackSkin) => void;
  handleCallUno: () => void;
  closeWild: () => void;
  selectWildColor: (color: UnoColor) => void;
}

export function useTableRoomCommands({
  room,
  wildFor,
  isMyTurn,
  tableReady,
  meSeatIndex,
  unoCaller,
  setWildFor,
  setSelectedCardId,
  setChatText,
  setCardBackTheme,
  showToast,
}: UseTableRoomCommandsArgs): TableRoomCommands {
  const sendRoom = useCallback(
    <T extends TableRoomCommandName>(type: T, ...args: TableRoomSendArgs<T>) => {
      return sendTableRoomCommand(room, type, ...args);
    },
    [room],
  );
  const showSendFailureToast = useCallback(() => {
    const toast = getRoomCommandFailureToast();
    showToast(toast.message, toast.kind);
  }, [showToast]);

  const sendRoomOrWarn = useCallback(
    <T extends TableRoomCommandName>(type: T, ...args: TableRoomSendArgs<T>) => {
      if (sendRoom(type, ...args)) return true;
      showSendFailureToast();
      return false;
    },
    [sendRoom, showSendFailureToast],
  );

  const playCard = useCallback(
    (card: CardSchema, color?: UnoColor) => {
      if (card.cardType === "wild" && !color) {
        setWildFor(card);
        return;
      }
      if (!sendRoomOrWarn("play_card", { cardId: card.id, chosenColor: color })) return;
      setWildFor(null);
      setSelectedCardId(null);
    },
    [sendRoomOrWarn, setSelectedCardId, setWildFor],
  );

  const drawCard = useCallback(() => {
    if (!isMyTurn || !tableReady) return;
    sendRoomOrWarn("draw_card");
  }, [isMyTurn, sendRoomOrWarn, tableReady]);

  const voteRematch = useCallback(() => {
    sendRoomOrWarn("vote_rematch");
  }, [sendRoomOrWarn]);

  const submitChat = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      if (!sendRoomOrWarn("chat", { text: trimmed })) return;
      setChatText("");
    },
    [sendRoomOrWarn, setChatText],
  );

  const handleSetCardBackTheme = useCallback(
    (theme: CardBackSkin) => {
      setCardBackTheme(theme);
      showToast(CARD_BACK_SKINS_BY_ID[theme].toast, "success");
    },
    [setCardBackTheme, showToast],
  );

  const handleCallUno = useCallback(() => {
    if (unoCaller !== meSeatIndex) return;
    if (sendRoomOrWarn("uno")) {
      showToast("UNO called successfully!", "success");
    }
  }, [meSeatIndex, sendRoomOrWarn, showToast, unoCaller]);

  const closeWild = useCallback(() => {
    setWildFor(null);
  }, [setWildFor]);

  const selectWildColor = useCallback(
    (color: UnoColor) => {
      if (wildFor) playCard(wildFor, color);
    },
    [playCard, wildFor],
  );

  return {
    playCard,
    drawCard,
    voteRematch,
    submitChat,
    handleSetCardBackTheme,
    handleCallUno,
    closeWild,
    selectWildColor,
  };
}

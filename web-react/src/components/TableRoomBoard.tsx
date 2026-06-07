import { memo } from "react";
import type { RefObject } from "react";
import { AmbientStardust } from "./AmbientStardust";
import { TableBoardStage } from "./TableBoardStage";
import { PlayerStrip } from "./PlayerStrip";
import { TableRoomCenterTable } from "./TableRoomCenterTable";
import type { CardBackSkin } from "../tableConfig";
import type { ActionBubble } from "./tableRoomModel";
import type { CardSchema, PlayDirection, PlayerSchema, UnoColor } from "../gameTypes";

interface TableRoomBoardProps {
  activeColor: UnoColor;
  direction: PlayDirection;
  activePlayerThemeColor: string;
  spotlightPos: string;
  boardRef: RefObject<HTMLElement | null>;
  colorblindMode: boolean;
  opponentPlayers: PlayerSchema[];
  activeSeat: number;
  turnDeadline?: number;
  skippedSeatIndex: number;
  actionBubbleBySeat: ReadonlyMap<number, ActionBubble>;
  botEmotions: Record<string, string>;
  setPlayerPillRef: (seatIndex: number, element: HTMLElement | null) => void;
  tableReady: boolean;
  isMyTurn: boolean;
  drawCard: () => void;
  deckStackRef: RefObject<HTMLButtonElement | null>;
  deckLayerCount: number;
  deckCount: number;
  cardBackTheme: CardBackSkin;
  shouldDrawHint: boolean;
  discardPile: CardSchema[];
  discardPileRef: RefObject<HTMLDivElement | null>;
  shockwaves: { id: string; color: string }[];
  topCard: CardSchema | null;
  pendingDraw: number;
}

function TableRoomBoardBase({
  activeColor,
  direction,
  activePlayerThemeColor,
  spotlightPos,
  boardRef,
  colorblindMode,
  opponentPlayers,
  activeSeat,
  turnDeadline,
  skippedSeatIndex,
  actionBubbleBySeat,
  botEmotions,
  setPlayerPillRef,
  tableReady,
  isMyTurn,
  drawCard,
  deckStackRef,
  deckLayerCount,
  deckCount,
  cardBackTheme,
  shouldDrawHint,
  discardPile,
  discardPileRef,
  shockwaves,
  topCard,
  pendingDraw,
}: TableRoomBoardProps) {
  return (
    <TableBoardStage
      ref={boardRef}
      activeColor={activeColor}
      spotlightPos={spotlightPos}
      activePlayerThemeColor={activePlayerThemeColor}
    >
      <div className="table-felt-wave-overlay" />
      <AmbientStardust />
      <div className="player-band">
        <PlayerStrip
          players={opponentPlayers}
          activeSeat={activeSeat}
          turnDeadline={turnDeadline}
          skippedSeatIndex={skippedSeatIndex}
          actionBubbleBySeat={actionBubbleBySeat}
          botEmotions={botEmotions}
          setPlayerPillRef={setPlayerPillRef}
        />
      </div>
      <TableRoomCenterTable
        activeColor={activeColor}
        direction={direction}
        tableReady={tableReady}
        isMyTurn={isMyTurn}
        drawCard={drawCard}
        deckStackRef={deckStackRef}
        deckLayerCount={deckLayerCount}
        deckCount={deckCount}
        cardBackTheme={cardBackTheme}
        shouldDrawHint={shouldDrawHint}
        discardPile={discardPile}
        discardPileRef={discardPileRef}
        shockwaves={shockwaves}
        topCard={topCard}
        pendingDraw={pendingDraw}
        colorblindMode={colorblindMode}
      />
    </TableBoardStage>
  );
}

export const TableRoomBoard = memo(TableRoomBoardBase);

import type { CardSchema, PlayerSchema } from "../gameTypes.ts";
import { cardLabel, getPlayerCardCount, parsePlayerName } from "../gameHelpers.ts";
import { AVATAR_THEMES_BY_ID } from "../tableConfig.ts";
import { HAND_DOCK_ANCHOR_ID, getPlayerPillAnchorId, type TableRoomAnchorId } from "./tableRoomModel.ts";

export interface DiscardPlayPresentation {
  drawParticleCount: number;
  isWild: boolean;
  cardAlert:
    | {
        variant: "banner";
        tone: "warning" | "success";
        text: string;
      }
    | null;
  bubbleText: string;
  bubbleThemeColor: string;
  startElId: TableRoomAnchorId;
  botEmotion: string;
  shouldReverseSweep: boolean;
}

export interface DrawDiffPresentation {
  seatIndex: number;
  drawDiff: number;
  targetElId: TableRoomAnchorId;
  isBot: boolean;
  fireBurstCount: number;
}

export function buildDiscardPlayPresentation(params: {
  top: CardSchema;
  playedPlayer: PlayerSchema;
  roomSessionId: string | null;
}): DiscardPlayPresentation {
  const { top, playedPlayer, roomSessionId } = params;
  const av = parsePlayerName(playedPlayer.name);
  const themeInfo = AVATAR_THEMES_BY_ID.get(av.theme);
  const isWild = top.cardType === "wild";
  const isActionCard = isWild || top.value === "skip" || top.value === "reverse" || top.value === "draw2";

  return {
    drawParticleCount: isWild ? 35 : 15,
    isWild,
    cardAlert:
      top.cardType === "color"
        ? top.value === "skip"
          ? { variant: "banner", tone: "warning" as const, text: "SKIP!" }
          : top.value === "reverse"
            ? { variant: "banner", tone: "warning" as const, text: "REVERSE!" }
            : top.value === "draw2"
              ? { variant: "banner", tone: "warning" as const, text: "+2 DRAW!" }
              : null
        : isWild
          ? top.value === "wild_draw4"
            ? { variant: "banner", tone: "warning" as const, text: "+4 DRAW!" }
            : { variant: "banner", tone: "success" as const, text: "WILD PLAY!" }
          : null,
    bubbleText: isWild ? (top.value === "wild_draw4" ? "Wild +4" : "Wild") : cardLabel(top),
    bubbleThemeColor: themeInfo ? themeInfo.primary : "var(--gold)",
    startElId: playedPlayer.sessionId === roomSessionId ? HAND_DOCK_ANCHOR_ID : getPlayerPillAnchorId(playedPlayer.seatIndex),
    botEmotion: playedPlayer.isBot ? (isActionCard ? (top.value === "wild_draw4" ? "😈" : "😎") : "😀") : "",
    shouldReverseSweep: top.cardType === "color" && top.value === "reverse",
  };
}

export function buildDrawDiffPresentations(params: {
  players: PlayerSchema[];
  prevHandCounts: Record<number, number>;
  roomSessionId: string | null;
}): DrawDiffPresentation[] {
  const { players, prevHandCounts, roomSessionId } = params;
  const presentations: DrawDiffPresentation[] = [];

  for (const player of players) {
    const prevHandCount = prevHandCounts[player.seatIndex] ?? 0;
    const newHandCount = getPlayerCardCount(player);
    if (newHandCount <= prevHandCount) continue;

    presentations.push({
      seatIndex: player.seatIndex,
      drawDiff: newHandCount - prevHandCount,
      targetElId: player.sessionId === roomSessionId ? HAND_DOCK_ANCHOR_ID : getPlayerPillAnchorId(player.seatIndex),
      isBot: player.isBot,
      fireBurstCount: newHandCount - prevHandCount >= 2 ? 15 : 0,
    });
  }

  return presentations;
}

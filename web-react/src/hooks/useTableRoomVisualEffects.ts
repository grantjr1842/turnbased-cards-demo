import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  DECK_STACK_ANCHOR_ID,
  DISCARD_PILE_ANCHOR_ID,
  HAND_DOCK_ANCHOR_ID,
  PLAYER_PILL_ANCHOR_PREFIX,
  type TableRoomAnchorId,
} from "../components/tableRoomModel";
import {
  buildBotEmotionState,
  buildVisibleBotEmotionState,
} from "../components/tableRoomPlayers";
import {
  buildCardFlight,
  buildFlightTrailParticle,
  buildRadialBurstParticles,
  getEasedFlightPoint,
  type BurstParticle,
  type CardFlight,
} from "../components/tableRoomMotion";
import type { CardSchema, PlayerSchema } from "../gameTypes";

const FLIGHT_TRAIL_SPARKLES = ["✨", "🌟", "💫", "⭐"] as const;
const WILD_PARTICLE_EMOJIS = ["🟥", "🟦", "🟩", "🟨", "✨", "💥", "🌈", "⭐"] as const;
const NORMAL_PARTICLE_EMOJIS = ["✨", "🔥", "🎉", "🌟", "💥", "🃏"] as const;

interface UseTableRoomVisualEffectsArgs {
  players: PlayerSchema[];
  playersBySeat: Map<number, PlayerSchema>;
  scheduleTimeout: (callback: () => void, delay: number) => number;
  scheduleInterval: (callback: () => void, delay: number) => number;
  scheduleAnimationFrame: (callback: FrameRequestCallback) => number;
  clearTimeout: (id: number) => void;
  clearInterval: (id: number) => void;
  handDockRef: RefObject<HTMLElement | null>;
  deckStackRef: RefObject<HTMLButtonElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLElement | null>;
}

export interface TableRoomVisualEffects {
  botEmotions: Record<string, string>;
  particles: BurstParticle[];
  flights: CardFlight[];
  setPlayerPillRef: (seatIndex: number, element: HTMLElement | null) => void;
  getBoardParticleOrigin: (offsetY?: number) => { x: number; y: number };
  triggerFlight: (
    card: CardSchema | null,
    isBack: boolean,
    startElId: TableRoomAnchorId,
    endElId: TableRoomAnchorId,
  ) => void;
  triggerBotEmotion: (seatIndex: number, emoji: string, duration?: number) => void;
  triggerParticles: (x: number, y: number, count?: number, isWild?: boolean) => void;
}

export function useTableRoomVisualEffects({
  players,
  playersBySeat,
  scheduleTimeout,
  scheduleInterval,
  scheduleAnimationFrame,
  clearTimeout,
  clearInterval,
  handDockRef,
  deckStackRef,
  discardPileRef,
  boardRef,
}: UseTableRoomVisualEffectsArgs): TableRoomVisualEffects {
  const [particles, setParticles] = useState<BurstParticle[]>([]);
  const [flights, setFlights] = useState<CardFlight[]>([]);
  const [botEmotionOverrides, setBotEmotionOverrides] = useState<Record<string, string>>({});
  const playerPillRefs = useRef<Record<number, HTMLElement | null>>({});
  const botEmotionTimeouts = useRef<Record<string, number>>({});
  const visualArtifactSeq = useRef(0);

  const clearBotEmotionTimeout = useCallback(
    (sessionId: string) => {
      const timeoutId = botEmotionTimeouts.current[sessionId];
      if (timeoutId == null) return;
      clearTimeout(timeoutId);
      delete botEmotionTimeouts.current[sessionId];
    },
    [clearTimeout],
  );

  const resolveAnchor = useCallback(
    (anchorId: TableRoomAnchorId) => {
      if (anchorId === HAND_DOCK_ANCHOR_ID) return handDockRef.current;
      if (anchorId === DECK_STACK_ANCHOR_ID) return deckStackRef.current;
      if (anchorId === DISCARD_PILE_ANCHOR_ID) return discardPileRef.current;
      if (anchorId.startsWith(PLAYER_PILL_ANCHOR_PREFIX)) {
        const seatIndex = Number(anchorId.slice(PLAYER_PILL_ANCHOR_PREFIX.length));
        if (Number.isFinite(seatIndex)) {
          return playerPillRefs.current[seatIndex] ?? null;
        }
      }
      return null;
    },
    [deckStackRef, discardPileRef, handDockRef],
  );

  const setPlayerPillRef = useCallback((seatIndex: number, element: HTMLElement | null) => {
    playerPillRefs.current[seatIndex] = element;
  }, []);

  const triggerFlight = useCallback(
    (
      card: CardSchema | null,
      isBack: boolean,
      startElId: TableRoomAnchorId,
      endElId: TableRoomAnchorId,
    ) => {
      const startEl = resolveAnchor(startElId);
      const endEl = resolveAnchor(endElId);
      if (!startEl || !endEl) return;

      const startRect = startEl.getBoundingClientRect();
      const endRect = endEl.getBoundingClientRect();

      const startX = startRect.left + startRect.width / 2;
      const startY = startRect.top + startRect.height / 2;
      const endX = endRect.left + endRect.width / 2;
      const endY = endRect.top + endRect.height / 2;

      const newFlight = buildCardFlight({
        card,
        isBack,
        startX,
        startY,
        endX,
        endY,
        batchId: String(visualArtifactSeq.current++),
      });
      const flightId = newFlight.id;

      setFlights((prev) => [...prev, newFlight]);

      const flightDuration = 600;
      const startTime = Date.now();
      const trailInterval = scheduleInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= flightDuration) {
          clearInterval(trailInterval);
          return;
        }
        const t = elapsed / flightDuration;
        const { x: currX, y: currY } = getEasedFlightPoint({
          startX,
          startY,
          endX,
          endY,
          progress: t,
        });

        const sparkId = `trail-${visualArtifactSeq.current++}`;

        setParticles((prev) => [
          ...prev,
          buildFlightTrailParticle({
            x: currX,
            y: currY,
            id: sparkId,
            emojis: FLIGHT_TRAIL_SPARKLES,
          }),
        ]);

        scheduleTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== sparkId));
        }, 550);
      }, 45);
      scheduleAnimationFrame(() => {
        scheduleTimeout(() => {
          setFlights((prev) => prev.map((f) => (f.id === flightId ? { ...f, animating: true } : f)));
        }, 20);
      });

      scheduleTimeout(() => {
        setFlights((prev) => prev.filter((f) => f.id !== flightId));
      }, 650);
    },
    [clearInterval, resolveAnchor, scheduleAnimationFrame, scheduleInterval, scheduleTimeout],
  );

  const triggerBotEmotion = useCallback(
    (seatIndex: number, emoji: string, duration = 2000) => {
      const playerSessionId = playersBySeat.get(seatIndex)?.sessionId ?? `seat-${seatIndex}`;
      clearBotEmotionTimeout(playerSessionId);
      setBotEmotionOverrides((prev) => {
        if (prev[playerSessionId] === emoji) return prev;
        return { ...prev, [playerSessionId]: emoji };
      });
      botEmotionTimeouts.current[playerSessionId] = scheduleTimeout(() => {
        setBotEmotionOverrides((prev) => {
          if (prev[playerSessionId] !== emoji) return prev;
          const next = { ...prev };
          delete next[playerSessionId];
          return next;
        });
        delete botEmotionTimeouts.current[playerSessionId];
      }, duration);
    },
    [clearBotEmotionTimeout, playersBySeat, scheduleTimeout],
  );

  useEffect(() => {
    const activeBotSessionIds = new Set(players.filter((player) => player.isBot).map((player) => player.sessionId));
    setBotEmotionOverrides((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [sessionId, emoji] of Object.entries(prev)) {
        if (activeBotSessionIds.has(sessionId)) {
          next[sessionId] = emoji;
        } else {
          changed = true;
          clearBotEmotionTimeout(sessionId);
        }
      }
      return changed ? next : prev;
    });
  }, [clearBotEmotionTimeout, players]);

  useEffect(() => {
    return () => {
      for (const timeoutId of Object.values(botEmotionTimeouts.current)) {
        clearTimeout(timeoutId);
      }
      botEmotionTimeouts.current = {};
    };
  }, [clearTimeout]);

  const getBoardParticleOrigin = useCallback(
    (offsetY = 0) => {
      const boardEl = boardRef.current;
      if (!boardEl) {
        return {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2 + offsetY,
        };
      }

      const rect = boardEl.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2 + offsetY,
      };
    },
    [boardRef],
  );

  const triggerParticles = useCallback(
    (x: number, y: number, count = 20, isWild = false) => {
      const emojis = isWild ? WILD_PARTICLE_EMOJIS : NORMAL_PARTICLE_EMOJIS;
      const newParticles = buildRadialBurstParticles({
        x,
        y,
        count,
        emojis,
        idPrefix: "particle",
        isWild,
        batchId: String(visualArtifactSeq.current++),
      });
      const newParticleIds = new Set(newParticles.map((p) => p.id));
      setParticles((prev) => [...prev, ...newParticles]);
      scheduleTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticleIds.has(p.id)));
      }, 1200);
    },
    [scheduleTimeout],
  );

  const baseBotEmotions = buildBotEmotionState(players);
  const botEmotions = buildVisibleBotEmotionState({
    players,
    baseBotEmotions,
    overrides: botEmotionOverrides,
  });

  return {
    botEmotions,
    particles,
    flights,
    setPlayerPillRef,
    getBoardParticleOrigin,
    triggerFlight,
    triggerBotEmotion,
    triggerParticles,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { TurnBanner } from "./tableRoomOverlayFlow";
import { useAmbientSoundscape } from "../hooks/useAmbientSoundscape";
import { useCardAlertAutoDismiss } from "../hooks/useCardAlertAutoDismiss";
import { useChatAutoScroll } from "../hooks/useChatAutoScroll";
import { useTurnAlertSound } from "../hooks/useTurnAlertSound";
import { useTimerRegistry } from "../hooks/useTimerRegistry";
import { useTurnHeartbeat } from "../hooks/useTurnHeartbeat";
import { cardLabel, statePlayers } from "../gameHelpers";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { useCardBackSkinPreference } from "../hooks/useCardBackSkinPreference";
import { useSelectedCardAutoCenter } from "../hooks/useSelectedCardAutoCenter";
import { useTableKeyboardShortcuts } from "../hooks/useTableKeyboardShortcuts";
import { useTableRoomCommands } from "../hooks/useTableRoomCommands";
import { sendTableRoomCommand } from "../hooks/tableRoomCommands";
import { useTableRoomStateTransitions } from "../hooks/useTableRoomStateTransitions";
import { useTableRoomVisualEffects } from "../hooks/useTableRoomVisualEffects";
import { useTutorialGuideState } from "../hooks/useTutorialGuideState";
import { buildHandInteractionState } from "./tableRoomHand";
import { buildRecentChatMessageState, getHandLayout } from "./tableRoomModel";
import {
  buildMeSummary,
  buildTableRoomPlayerState,
  buildTableRoomTurnState,
  buildRosterEntries,
} from "./tableRoomPlayers";
import { sortHand } from "./tableRoomSorting";
import type { CardSchema, Toast, UnoState } from "../gameTypes";
import type { CardAlert } from "./TableCardAlert";
import type { ActionBubble } from "./tableRoomModel";
import { buildTableRoomSceneState } from "./tableRoomSceneState";

export interface TableRoomControllerProps {
  room: Room<UnoState> | null;
  state: UnoState | null;
  showToast: (message: string, kind?: Toast["kind"]) => void;
}

export type TableRoomController = ReturnType<typeof useTableRoomController>;

export function useTableRoomController(props: TableRoomControllerProps) {
  const { room, state, showToast } = props;
  const players = statePlayers(state);
  const {
    playersBySeat,
    me,
    opponentPlayers,
    connectedHumanPlayers,
    opponentSeatIndexBySeat,
    hasOneCardWarning,
  } = buildTableRoomPlayerState(players, room?.sessionId ?? null);

  const [sortBy, setSortBy] = useState<"none" | "color" | "value">("color");
  // Player hands are live schema arrays, so sort directly instead of memoizing
  // against a potentially stable reference that can mutate in place.
  const hand = sortHand(me?.hand ?? [], sortBy);

  const [wildFor, setWildFor] = useState<CardSchema | null>(null);
  const [chatText, setChatText] = useState("");
  const meSummary = buildMeSummary(me, state?.spectatorCount ?? 0);
  const rosterEntries = buildRosterEntries(opponentPlayers, state?.currentPlayer);
  const { chatMessageViews, latestChatMessageId } = buildRecentChatMessageState(state?.chatMessages ?? []);
  const turnState = buildTableRoomTurnState({
    state,
    playersBySeat,
    me,
    opponentSeatIndexBySeat,
    opponentPlayersCount: opponentPlayers.length,
  });
  const { isMyTurn } = turnState;

  const sceneState = buildTableRoomSceneState({
    room,
    state,
    currentPlayerLabel: turnState.currentPlayerLabel,
    activePlayerThemeColor: turnState.activePlayerThemeColor,
    isMyTurn,
    spotlightPos: turnState.spotlightPos,
  });
  const { tableReady } = sceneState;

  const [ping, setPing] = useState<number | null>(null);
  const [cardAlert, setCardAlert] = useState<CardAlert | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [actionBubbles, setActionBubbles] = useState<ActionBubble[]>([]);
  const [turnBanner, setTurnBanner] = useState<TurnBanner | null>(null);
  const [skippedSeatIndex, setSkippedSeatIndex] = useState<number>(-1);
  const [showReverseSweep, setShowReverseSweep] = useState<boolean>(false);
  const [shockwaves, setShockwaves] = useState<{ id: string; color: string }[]>([]);
  const { cardBackTheme, setCardBackTheme } = useCardBackSkinPreference();
  const {
    showRules,
    openRules,
    closeRules,
    tutorialStep,
    isLastTutorialStep,
    tutorial,
    advanceTutorial,
    closeTutorial,
    replayGuide,
  } = useTutorialGuideState({
    wildFor,
    cardAlert,
    turnBanner,
    showReverseSweep,
  });
  const actionBubbleBySeat = useMemo(
    () => new Map(actionBubbles.map((bubble) => [bubble.seatIndex, bubble] as const)),
    [actionBubbles],
  );
  const localActionBubble = actionBubbleBySeat.get(me?.seatIndex ?? -1);
  const handInteraction = buildHandInteractionState({
    hand,
    selectedCardId,
    state,
    meSeatIndex: me?.seatIndex,
    isMyTurn,
    tableReady,
  });
  const {
    selectedCardIdx,
    selectedCardPlayable,
    playableCardIds,
    pendingDraw,
    shouldDrawHint,
    guidanceText,
    guidanceStatus,
    actionCallout,
  } = handInteraction;
  const timers = useTimerRegistry();
  const scheduleTimeout = timers.scheduleTimeout;
  const scheduleInterval = timers.scheduleInterval;
  const scheduleAnimationFrame = timers.scheduleAnimationFrame;
  const clearTimeout = timers.clearTimeout;
  const clearInterval = timers.clearInterval;
  const prevCurrentPlayer = useRef<number>(-1);

  const handScrollRef = useRef<HTMLDivElement | null>(null);
  const handDockRef = useRef<HTMLElement | null>(null);
  const deckStackRef = useRef<HTMLButtonElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const rulesDialogRef = useRef<HTMLDivElement | null>(null);
  const wildDialogRef = useRef<HTMLDivElement | null>(null);
  const tutorialDialogRef = useRef<HTMLElement | null>(null);
  const matchStartTime = useRef<number | null>(null);
  const lastDiscardCount = useRef(0);
  const lastHandCount = useRef(0);
  const lastWinner = useRef(-1);
  const lastUno = useRef(-1);
  const lastPending = useRef(0);
  const localPlayerCardsPlayed = useRef(0);
  useSelectedCardAutoCenter({
    selectedCardIdx,
    handScrollRef,
  });

  useDialogFocus(showRules, rulesDialogRef);
  useDialogFocus(Boolean(wildFor), wildDialogRef);
  useDialogFocus(tutorialStep >= 0, tutorialDialogRef);

  useEffect(() => {
    if (selectedCardId && selectedCardIdx === -1) {
      setSelectedCardId(null);
    }
  }, [selectedCardId, selectedCardIdx, setSelectedCardId]);

  const {
    botEmotions,
    particles,
    flights,
    setPlayerPillRef,
    getBoardParticleOrigin,
    triggerFlight,
    triggerBotEmotion,
    triggerParticles,
  } = useTableRoomVisualEffects({
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
  });

  const {
    playCard,
    drawCard,
    voteRematch,
    submitChat,
    handleSetCardBackTheme,
    handleCallUno,
    closeWild,
    selectWildColor,
  } = useTableRoomCommands({
    room,
    wildFor,
    isMyTurn,
    tableReady,
    meSeatIndex: me?.seatIndex,
    unoCaller: state?.unoCaller,
    setWildFor,
    setSelectedCardId,
    setChatText,
    setCardBackTheme,
    showToast,
  });

  const handleUnplayableTap = useCallback(
    (card: CardSchema) => {
      showToast(`Cannot play ${cardLabel(card)} — doesn't match the discard pile.`, "warning");
    },
    [showToast],
  );

  useEffect(() => {
    if (!room) return;
    let lastPingTime = 0;
    const handlePong = () => {
      setPing(Date.now() - lastPingTime);
    };

    const cleanupPong = room.onMessage("pong", handlePong);
    const interval = scheduleInterval(() => {
      lastPingTime = Date.now();
      sendTableRoomCommand(room, "ping");
    }, 3000);

    lastPingTime = Date.now();
    sendTableRoomCommand(room, "ping");

    return () => {
      clearInterval(interval);
      cleanupPong();
    };
  }, [room, scheduleInterval, clearInterval]);

  useTableRoomStateTransitions({
    state,
    players,
    opponentPlayers,
    playersBySeat,
    me,
    room,
    scheduleTimeout,
    clearTimeout,
    triggerFlight,
    triggerBotEmotion,
    triggerParticles,
    getBoardParticleOrigin,
    setCardAlert,
    setActionBubbles,
    setTurnBanner,
    setSkippedSeatIndex,
    setShowReverseSweep,
    setShockwaves,
    localPlayerCardsPlayedRef: localPlayerCardsPlayed,
    prevCurrentPlayerRef: prevCurrentPlayer,
    lastDiscardCountRef: lastDiscardCount,
    lastUnoRef: lastUno,
    lastPendingRef: lastPending,
    lastWinnerRef: lastWinner,
    lastHandCountRef: lastHandCount,
    matchStartTimeRef: matchStartTime,
    boardRef,
  });

  useEffect(() => {
    setSelectedCardId(null);
  }, [state?.currentPlayer, state?.phase]);

  useCardAlertAutoDismiss({
    cardAlert,
    scheduleTimeout,
    clearTimeout,
    setCardAlert,
  });

  useTurnAlertSound(isMyTurn);
  useChatAutoScroll({
    chatLogRef,
    latestChatMessageId,
  });
  useAmbientSoundscape(cardBackTheme);
  useTurnHeartbeat({
    isMyTurn,
    turnDeadline: state?.turnDeadline,
    scheduleInterval,
    clearInterval,
  });

  useEffect(() => {
    if (state?.phase === "playing" && matchStartTime.current === null) {
      matchStartTime.current = Date.now();
    } else if (state?.phase !== "playing") {
      matchStartTime.current = null;
    }
  }, [state?.phase]);

  useTableKeyboardShortcuts({
    hand,
    selectedCardIdx,
    setSelectedCardId,
    isMyTurn,
    tableReady,
    showRules,
    openRules,
    closeRules,
    wildFor,
    setWildFor,
    tutorialStep,
    closeTutorial,
    playCard,
    drawCard,
    callUno: handleCallUno,
    selectedCardPlayable,
    chatInputRef,
  });

  const scrollHand = (direction: "left" | "right") => {
    if (!handScrollRef.current) return;
    const amount = 200 * (direction === "left" ? -1 : 1);
    handScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handCount = hand.length;
  const { handMid, dynamicFanAngle, dynamicFanOffset, dynamicMarginValue } = getHandLayout(handCount);

  const winnerPlayer =
    state?.winner == null || state.winner === -1 ? null : playersBySeat.get(state.winner) ?? null;
  const emptyHandLabel = state ? "Dealing initial cards..." : "Spectating Table";
  const showUnoButton = state?.unoCaller === me?.seatIndex;
  const rematchVotes = state?.rematchVotes ?? [];
  const topbar = useMemo(
    () => ({
      roomCode: sceneState.roomCode,
      isMyTurn: sceneState.isMyTurn,
      currentPlayerLabel: sceneState.currentPlayerLabel,
      direction: sceneState.direction,
      ping,
      onShowRules: openRules,
    }),
    [openRules, ping, sceneState.currentPlayerLabel, sceneState.direction, sceneState.isMyTurn, sceneState.roomCode],
  );
  const board = useMemo(
    () => ({
      activeColor: sceneState.activeColor,
      direction: sceneState.direction,
      activePlayerThemeColor: sceneState.activePlayerThemeColor,
      spotlightPos: sceneState.spotlightPos,
      boardRef,
      opponentPlayers,
      activeSeat: sceneState.activeSeat,
      turnDeadline: sceneState.turnDeadline,
      skippedSeatIndex,
      actionBubbleBySeat,
      botEmotions,
      setPlayerPillRef,
      tableReady: sceneState.tableReady,
      isMyTurn: sceneState.isMyTurn,
      drawCard,
      deckStackRef,
      deckLayerCount: sceneState.deckLayerCount,
      deckCount: sceneState.deckCount,
      cardBackTheme,
      shouldDrawHint,
      discardPile: sceneState.discardPile,
      discardPileRef,
      shockwaves,
      topCard: sceneState.topCard,
      pendingDraw,
    }),
    [
      actionBubbleBySeat,
      boardRef,
      botEmotions,
      cardBackTheme,
      deckStackRef,
      drawCard,
      opponentPlayers,
      pendingDraw,
      sceneState.activeColor,
      sceneState.activePlayerThemeColor,
      sceneState.activeSeat,
      sceneState.direction,
      sceneState.discardPile,
      sceneState.isMyTurn,
      sceneState.spotlightPos,
      sceneState.tableReady,
      sceneState.topCard,
      sceneState.turnDeadline,
      sceneState.deckCount,
      sceneState.deckLayerCount,
      setPlayerPillRef,
      shouldDrawHint,
      shockwaves,
      skippedSeatIndex,
      discardPileRef,
    ],
  );
  const overlays = useMemo(
    () => ({
      cardAlert,
      showRules,
      onCloseRules: closeRules,
      onReplayGuide: replayGuide,
      rulesDialogRef,
      tutorial,
      tutorialStep,
      isLastTutorialStep,
      onCloseTutorial: closeTutorial,
      onAdvanceTutorial: advanceTutorial,
      tutorialDialogRef,
      turnBanner,
      showReverseSweep,
      direction: sceneState.direction,
      wildFor,
      onCloseWild: closeWild,
      onSelectWildColor: selectWildColor,
      wildDialogRef,
    }),
    [
      advanceTutorial,
      cardAlert,
      closeRules,
      closeTutorial,
      closeWild,
      replayGuide,
      rulesDialogRef,
      sceneState.direction,
      selectWildColor,
      showReverseSweep,
      showRules,
      tutorial,
      tutorialDialogRef,
      tutorialStep,
      turnBanner,
      wildDialogRef,
      wildFor,
      isLastTutorialStep,
    ],
  );
  const winnerPodium = useMemo(
    () => ({
      rematchVotes,
      connectedHumanPlayers,
      winnerPlayer,
      meSeatIndex: me?.seatIndex,
      onVoteRematch: voteRematch,
    }),
    [connectedHumanPlayers, me?.seatIndex, rematchVotes, voteRematch, winnerPlayer],
  );
  const sidePanel = useMemo(
    () => ({
      me: meSummary,
      topCardLabel: sceneState.topCardLabel,
      phase: sceneState.phase,
      roster: rosterEntries,
      cardBackTheme,
      onSetCardBackTheme: handleSetCardBackTheme,
    }),
    [cardBackTheme, handleSetCardBackTheme, meSummary, rosterEntries, sceneState.phase, sceneState.topCardLabel],
  );
  const handDock = useMemo(
    () => ({
      isMyTurn,
      emptyHandLabel,
      showUnoButton,
      onCallUno: handleCallUno,
      actionCallout,
      guidanceText,
      guidanceStatus,
      sortBy,
      setSortBy,
      actionBubbleLocal: localActionBubble,
      hand,
      playableCardIds,
      handCount,
      handMid,
      dynamicFanAngle,
      dynamicFanOffset,
      dynamicMarginValue,
      selectedCardId,
      setSelectedCardId,
      playCard,
      onUnplayableTap: handleUnplayableTap,
      scrollHand,
      handScrollRef,
    }),
    [
      actionCallout,
      dynamicFanAngle,
      dynamicFanOffset,
      dynamicMarginValue,
      emptyHandLabel,
      hand,
      handCount,
      handMid,
      handScrollRef,
      handleCallUno,
      handleUnplayableTap,
      guidanceStatus,
      guidanceText,
      isMyTurn,
      localActionBubble,
      playableCardIds,
      playCard,
      scrollHand,
      selectedCardId,
      setSelectedCardId,
      setSortBy,
      showUnoButton,
      sortBy,
    ],
  );
  const chatPanel = useMemo(
    () => ({
      chatMessageViews,
      chatLogRef,
      chatInputRef,
      chatText,
      setChatText,
      onSubmitChat: submitChat,
    }),
    [chatInputRef, chatLogRef, chatMessageViews, chatText, setChatText, submitChat],
  );
  const floatingEffects = useMemo(
    () => ({
      particles,
      flights,
      cardBackTheme,
    }),
    [cardBackTheme, flights, particles],
  );
  const lowerChrome = useMemo(
    () => ({
      handDockRef,
      winnerPodium,
      sidePanel,
      handDock,
      chatPanel,
      floatingEffects,
    }),
    [chatPanel, floatingEffects, handDock, handDockRef, sidePanel, winnerPodium],
  );
  return {
    hasOneCardWarning,
    topbar,
    board,
    overlays,
    lowerChrome,
  };
}

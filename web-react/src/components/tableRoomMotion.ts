import type { CardSchema } from "../gameTypes";

export interface BurstParticle {
  id: string;
  x: number;
  y: number;
  emoji: string;
  tx: string;
  ty: string;
  tr: string;
}

export interface CardFlight {
  id: string;
  card: CardSchema | null;
  isBack: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rotation: number;
  animating: boolean;
}

export interface FlightPoint {
  x: number;
  y: number;
}

export const DRAW_FIRE_PARTICLE_EMOJIS = ["🔥", "💥", "⚡", "😈"] as const;

function pickRandomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomSignedOffset(range: number) {
  return (Math.random() - 0.5) * range;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function buildBurstParticles(params: {
  x: number;
  y: number;
  count: number;
  emojis: readonly string[];
  idPrefix: string;
  batchId: string;
}): BurstParticle[] {
  const { x, y, count, emojis, idPrefix, batchId } = params;
  const particles: BurstParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    particles.push({
      id: `${idPrefix}-${batchId}-${i}`,
      x,
      y,
      emoji: pickRandomItem(emojis),
      tx: `${randomSignedOffset(120)}px`,
      ty: `${randomSignedOffset(120)}px`,
      tr: `${randomSignedOffset(360)}deg`,
    });
  }
  return particles;
}

export function buildCardFlight(params: {
  card: CardSchema | null;
  isBack: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  batchId: string;
}) {
  const { card, isBack, startX, startY, endX, endY, batchId } = params;
  return {
    id: `flight-${batchId}`,
    card,
    isBack,
    startX,
    startY,
    endX,
    endY,
    rotation: randomSignedOffset(90),
    animating: false,
  };
}

export function buildFlightTrailParticle(params: {
  x: number;
  y: number;
  id: string;
  emojis: readonly string[];
}): BurstParticle {
  const { x, y, id, emojis } = params;
  return {
    id,
    x,
    y,
    emoji: pickRandomItem(emojis),
    tx: `${randomSignedOffset(20)}px`,
    ty: `${randomSignedOffset(20)}px`,
    tr: `${randomSignedOffset(180)}deg`,
  };
}

export function getEasedFlightPoint(params: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
}): FlightPoint {
  const { startX, startY, endX, endY, progress } = params;
  const easeT = 1 - Math.pow(1 - progress, 3);
  return {
    x: startX + (endX - startX) * easeT,
    y: startY + (endY - startY) * easeT,
  };
}

export function buildRadialBurstParticles(params: {
  x: number;
  y: number;
  count: number;
  emojis: readonly string[];
  idPrefix: string;
  isWild: boolean;
  batchId: string;
}): BurstParticle[] {
  const { x, y, count, emojis, idPrefix, isWild, batchId } = params;
  const particles: BurstParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = isWild ? randomBetween(80, 240) : randomBetween(60, 180);
    particles.push({
      id: `${idPrefix}-${batchId}-${i}`,
      x,
      y,
      emoji: pickRandomItem(emojis),
      tx: `${Math.cos(angle) * distance}px`,
      ty: `${Math.sin(angle) * distance}px`,
      tr: `${randomSignedOffset(360)}deg`,
    });
  }
  return particles;
}

import type { CardSchema } from "../gameTypes.ts";

export type SortMode = "none" | "color" | "value";

const COLOR_ORDER: Record<string, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
};

const VALUE_ORDER: Record<string, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  skip: 10,
  reverse: 11,
  draw2: 12,
  wild: 13,
  wild_draw4: 14,
};

function getColorSortValue(color: string) {
  return COLOR_ORDER[color] ?? Number.MAX_SAFE_INTEGER;
}

function getValueSortValue(value: string) {
  return VALUE_ORDER[value] ?? Number.MAX_SAFE_INTEGER;
}

export function sortHand(hand: CardSchema[], sortBy: SortMode) {
  const rawHand = [...hand];
  if (sortBy === "color") {
    return rawHand.sort((a, b) => {
      if (a.cardType === "wild" && b.cardType !== "wild") return 1;
      if (b.cardType === "wild" && a.cardType !== "wild") return -1;
      const colorDiff = getColorSortValue(a.color) - getColorSortValue(b.color);
      if (colorDiff !== 0) return colorDiff;
      const valueDiff = getValueSortValue(a.value) - getValueSortValue(b.value);
      if (valueDiff !== 0) return valueDiff;
      return a.id.localeCompare(b.id);
    });
  }
  if (sortBy === "value") {
    return rawHand.sort((a, b) => {
      const valueDiff = getValueSortValue(a.value) - getValueSortValue(b.value);
      if (valueDiff !== 0) return valueDiff;
      const colorDiff = getColorSortValue(a.color) - getColorSortValue(b.color);
      if (colorDiff !== 0) return colorDiff;
      return a.id.localeCompare(b.id);
    });
  }
  return rawHand;
}

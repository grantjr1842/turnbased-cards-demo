export {
  AVATAR_SYMBOLS,
  AVATAR_SYMBOLS_BY_ID,
  AVATAR_THEMES,
  AVATAR_THEMES_BY_ID,
} from "@repo/shared/avatar";

export const CARD_BACK_SKINS = [
  {
    id: "classic",
    label: "Classic",
    toast: "Card back skin changed to Classic Crimson",
  },
  {
    id: "cyber",
    label: "Cyber",
    toast: "Card back skin changed to Cyber Gold",
  },
  {
    id: "cosmic",
    label: "Cosmic",
    toast: "Card back skin changed to Cosmic Nebula",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  toast: string;
}>;

export type CardBackSkin = (typeof CARD_BACK_SKINS)[number]["id"];

export const CARD_BACK_SKINS_BY_ID = Object.fromEntries(
  CARD_BACK_SKINS.map((skin) => [skin.id, skin]),
) as Record<CardBackSkin, (typeof CARD_BACK_SKINS)[number]>;

export function isCardBackSkin(value: string): value is CardBackSkin {
  return CARD_BACK_SKINS.some((skin) => skin.id === value);
}

export function normalizeCardBackSkin(value: string | null): CardBackSkin {
  return value && isCardBackSkin(value) ? value : "classic";
}

export const ATLAS_ORDER = [
  "red_0",
  "red_1",
  "red_2",
  "red_3",
  "red_4",
  "red_5",
  "red_6",
  "red_7",
  "red_8",
  "red_9",
  "red_skip",
  "red_reverse",
  "red_draw2",
  "blue_0",
  "blue_1",
  "blue_2",
  "blue_3",
  "blue_4",
  "blue_5",
  "blue_6",
  "blue_7",
  "blue_8",
  "blue_9",
  "blue_skip",
  "blue_reverse",
  "blue_draw2",
  "green_0",
  "green_1",
  "green_2",
  "green_3",
  "green_4",
  "green_5",
  "green_6",
  "green_7",
  "green_8",
  "green_9",
  "green_skip",
  "green_reverse",
  "green_draw2",
  "yellow_0",
  "yellow_1",
  "yellow_2",
  "yellow_3",
  "yellow_4",
  "yellow_5",
  "yellow_6",
  "yellow_7",
  "yellow_8",
  "yellow_9",
  "yellow_skip",
  "yellow_reverse",
  "yellow_draw2",
  "wild",
  "wild_draw4",
  "back",
];

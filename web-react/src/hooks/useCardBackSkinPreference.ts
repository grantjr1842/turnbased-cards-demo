import { useCallback, useState } from "react";
import { readStorageItem, writeStorageItem } from "../storage";
import { normalizeCardBackSkin, type CardBackSkin } from "../tableConfig";

export function useCardBackSkinPreference() {
  const [cardBackTheme, setCardBackThemeState] = useState<CardBackSkin>(() => {
    return normalizeCardBackSkin(readStorageItem("uno_card_back_skin"));
  });

  const setCardBackTheme = useCallback((theme: CardBackSkin) => {
    writeStorageItem("uno_card_back_skin", theme);
    setCardBackThemeState(theme);
  }, []);

  return {
    cardBackTheme,
    setCardBackTheme,
  };
}

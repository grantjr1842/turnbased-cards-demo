import { useEffect } from "react";
import { sfx } from "../audio/sfx";
import type { CardBackSkin } from "../tableConfig";

export function useAmbientSoundscape(cardBackTheme: CardBackSkin) {
  useEffect(() => {
    let unlocked = false;

    const handleUnlock = () => {
      if (unlocked) return;
      sfx.startAmbientSoundscape(cardBackTheme);
      unlocked = true;
      document.removeEventListener("click", handleUnlock);
      document.removeEventListener("touchstart", handleUnlock);
    };

    document.addEventListener("click", handleUnlock);
    document.addEventListener("touchstart", handleUnlock);

    return () => {
      document.removeEventListener("click", handleUnlock);
      document.removeEventListener("touchstart", handleUnlock);
    };
  }, []);

  useEffect(() => {
    sfx.startAmbientSoundscape(cardBackTheme);
  }, [cardBackTheme]);
}

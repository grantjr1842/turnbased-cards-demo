import { useLayoutEffect } from "react";
import type { Mode } from "../gameTypes";

export function useScrollToTopOnModeChange(mode: Mode) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [mode]);
}

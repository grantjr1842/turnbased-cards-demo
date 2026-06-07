import { useCallback, useState } from "react";
import { readStorageItem, writeStorageItem } from "../storage";

export function useColorblindPreference() {
  const [colorblindMode, setColorblindMode] = useState(() => {
    return readStorageItem("uno_colorblind") === "true";
  });

  const toggleColorblindMode = useCallback(() => {
    setColorblindMode((prev) => {
      const next = !prev;
      writeStorageItem("uno_colorblind", String(next));
      return next;
    });
  }, []);

  return {
    colorblindMode,
    toggleColorblindMode,
  };
}

import { useEffect, type RefObject } from "react";

export function useSelectedCardAutoCenter(params: {
  selectedCardIdx: number;
  handScrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { selectedCardIdx, handScrollRef } = params;

  useEffect(() => {
    if (selectedCardIdx < 0 || !handScrollRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      const container = handScrollRef.current;
      if (!container) return;

      const target = container.children.item(selectedCardIdx) as HTMLElement | null;
      if (!target) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const isVisible =
        targetRect.left >= containerRect.left && targetRect.right <= containerRect.right;
      if (isVisible) {
        return;
      }

      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [handScrollRef, selectedCardIdx]);
}

import type { PlayDirection } from "../gameTypes";
import { isCounterClockwise } from "../gameHelpers";

interface TableReverseSweepProps {
  showReverseSweep: boolean;
  direction: PlayDirection;
}

export function TableReverseSweep({ showReverseSweep, direction }: TableReverseSweepProps) {
  if (!showReverseSweep) return null;
  return (
    <div
      className={`reverse-sweep-overlay ${isCounterClockwise(direction) ? "ccw" : "cw"}`}
      aria-hidden="true"
    />
  );
}

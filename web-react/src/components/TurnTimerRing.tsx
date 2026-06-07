import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

interface TurnTimerRingProps {
  active: boolean;
  turnDeadline: number | undefined;
}

export function TurnTimerRing({ active, turnDeadline }: TurnTimerRingProps) {
  const [pct, setPct] = useState(100);
  const [critical, setCritical] = useState(false);
  const pctRef = useRef(100);
  const criticalRef = useRef(false);

  useEffect(() => {
    if (!active || !turnDeadline) {
      pctRef.current = 0;
      setPct(0);
      if (criticalRef.current) {
        criticalRef.current = false;
        setCritical(false);
      }
      return;
    }

    const start = Date.now();
    const total = Math.max(1000, turnDeadline - start);

    let frame: number;
    const update = () => {
      const now = Date.now();
      const remaining = turnDeadline - now;
      const nextPct = Math.max(0, Math.min(100, Math.ceil((remaining / total) * 100)));
      if (pctRef.current !== nextPct) {
        pctRef.current = nextPct;
        setPct(nextPct);
      }
      const nextCritical = remaining < 2500;
      if (criticalRef.current !== nextCritical) {
        criticalRef.current = nextCritical;
        setCritical(nextCritical);
      }

      if (remaining > 0) {
        frame = requestAnimationFrame(update);
      }
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active, turnDeadline]);

  if (!active) return null;

  const strokeWidth = 3;
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg
      className={`turn-timer-svg ${critical ? "critical" : ""}`}
      width="52"
      height="52"
      viewBox="0 0 52 52"
    >
      <circle
        cx="26"
        cy="26"
        r={radius}
        className="turn-timer-track"
        fill="none"
        stroke="rgba(255, 255, 255, 0.05)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx="26"
        cy="26"
        r={radius}
        className="turn-timer-progress"
        fill="none"
        stroke={critical ? "var(--card-red)" : "var(--gold)"}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.2s ease" } as CSSProperties}
      />
    </svg>
  );
}

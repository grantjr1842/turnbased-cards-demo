import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

interface TurnTimerRingProps {
  active: boolean;
  turnDeadline: number | undefined;
}

const RADIUS = 22;
const CIRC = 2 * Math.PI * RADIUS;

export function TurnTimerRing({ active, turnDeadline }: TurnTimerRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!active || !turnDeadline) {
      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = `${CIRC}`;
        circleRef.current.style.stroke = "var(--gold)";
      }
      if (svgRef.current) svgRef.current.classList.remove("critical");
      return;
    }

    const start = Date.now();
    const total = Math.max(1000, turnDeadline - start);

    let frame: number;
    const update = () => {
      const now = Date.now();
      const remaining = turnDeadline - now;
      const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
      const isCritical = remaining < 2500;

      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = `${CIRC - (pct / 100) * CIRC}`;
        circleRef.current.style.stroke = isCritical ? "var(--card-red)" : "var(--gold)";
      }
      if (svgRef.current) {
        svgRef.current.classList.toggle("critical", isCritical);
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

  return (
    <svg
      ref={svgRef}
      className="turn-timer-svg"
      width="52"
      height="52"
      viewBox="0 0 52 52"
    >
      <circle
        cx="26"
        cy="26"
        r={RADIUS}
        className="turn-timer-track"
        fill="none"
        stroke="rgba(255, 255, 255, 0.05)"
        strokeWidth={strokeWidth}
      />
      <circle
        ref={circleRef}
        cx="26"
        cy="26"
        r={RADIUS}
        className="turn-timer-progress"
        fill="none"
        stroke="var(--gold)"
        strokeWidth={strokeWidth}
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC}
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.2s ease" } as CSSProperties}
      />
    </svg>
  );
}

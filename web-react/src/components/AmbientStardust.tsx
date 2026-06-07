import type { CSSProperties } from "react";

interface StardustParticle {
  id: string;
  left: string;
  delay: string;
  duration: string;
  size: string;
  color: string;
}

const STARDUST_PARTICLES: StardustParticle[] = Array.from({ length: 18 }, (_, index) => {
  const isViolet = index % 3 !== 1;
  const color = isViolet ? "hsla(280, 75%, 65%, 0.15)" : "hsla(46, 95%, 65%, 0.12)";
  return {
    id: `stardust-${index}`,
    left: `${((index * 17) % 92) + 4}%`,
    delay: `${-(index % 9) * 1.35}s`,
    duration: `${8 + (index % 6) * 1.25}s`,
    size: `${2 + (index % 4) * 0.75}px`,
    color,
  };
});

export function AmbientStardust() {
  return (
    <div className="ambient-stardust-container">
      {STARDUST_PARTICLES.map((d) => (
        <div
          key={d.id}
          className="stardust-particle"
          style={
            {
              left: d.left,
              animationDelay: d.delay,
              animationDuration: d.duration,
              width: d.size,
              height: d.size,
              background: d.color,
              boxShadow: `0 0 10px ${d.color}`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

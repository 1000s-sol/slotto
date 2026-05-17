"use client";

import { useMemo } from "react";

const PARTICLE_COUNT = 48;

type Particle = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  color: string;
  size: number;
  drift: string;
};

const COLORS = [
  "#f5c542",
  "#7c3aed",
  "#22d3ee",
  "#f472b6",
  "#34d399",
  "#fb923c",
];

export function LotteryCelebration() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
      id,
      left: `${(id * 17) % 100}%`,
      delay: `${(id % 12) * 0.18}s`,
      duration: `${2.4 + (id % 5) * 0.35}s`,
      color: COLORS[id % COLORS.length]!,
      size: 6 + (id % 4) * 2,
      drift: `${-40 + (id % 9) * 10}px`,
    }));
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="lottery-confetti-particle absolute top-0 rounded-sm opacity-90"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 0.55,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            ["--confetti-drift" as string]: p.drift,
          }}
        />
      ))}
      <span className="lottery-firework lottery-firework-a" />
      <span className="lottery-firework lottery-firework-b" />
    </div>
  );
}

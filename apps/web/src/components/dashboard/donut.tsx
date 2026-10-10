"use client";

import { motion } from "motion/react";
import { NoData } from "./no-data";

export function Donut({
  running,
  degraded,
}: {
  running: number;
  degraded: number;
}) {
  const total = running + degraded;
  if (!total) return <NoData />;

  const cx = 100;
  const cy = 90;
  const R = 60;
  const circ = 2 * Math.PI * R;
  const segs = [
    { n: running, c: "#3fb950", l: "Running" },
    { n: degraded, c: "#d29922", l: "Degraded" },
  ];

  let off = 0;
  return (
    <motion.svg
      width={200}
      height={210}
      viewBox="0 0 200 210"
      role="img"
      aria-label="Service health donut chart"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0, 1] }}
    >
      {segs.map((s) => {
        if (!s.n) return null;
        const frac = s.n / total;
        const ln = frac * circ;
        const dashOffset = -off;
        off += ln;
        return (
          <motion.circle
            key={s.l}
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={s.c}
            strokeWidth={14}
            strokeDasharray={`${ln} ${circ - ln}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.1, 0, 1] }}
            strokeLinecap="round"
          />
        );
      })}
      {/* Center total number */}
      <motion.text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="currentColor"
        className="fill-foreground"
        fontSize={26}
        fontWeight={700}
        fontFamily="system-ui,sans-serif"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        {total}
      </motion.text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fill="#8b949e"
        fontSize={10}
        fontFamily="system-ui,sans-serif"
      >
        services
      </text>
      {segs
        .filter((s) => s.n)
        .map((s, i) => (
          <motion.g
            key={s.l}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.8 + i * 0.15 }}
          >
            <motion.circle
              cx={16}
              cy={165 + i * 16}
              r={4}
              fill={s.c}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 2,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
            <text
              x={26}
              y={168 + i * 16}
              fill="#8b949e"
              fontSize={10}
              fontFamily="system-ui,sans-serif"
            >
              {s.l}: {s.n}
            </text>
          </motion.g>
        ))}
    </motion.svg>
  );
}

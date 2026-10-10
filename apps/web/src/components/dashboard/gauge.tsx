"use client";

import { motion } from "motion/react";
import { NoData } from "./no-data";

const W = 220;
const H = 100;
const BW = 200;
const BH = 14;
const BX = (W - BW) / 2;
const BY = 30;

export function Gauge({
  pct,
  color,
  label,
  unit,
}: {
  pct: number | null;
  color: string;
  label: string;
  unit: string;
}) {
  if (pct === null || pct <= 0) return <NoData />;
  const fw = BW * Math.min(pct / 100, 1);

  return (
    <motion.svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label}: ${pct.toFixed(1)}${unit}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0, 1] }}
    >
      {/* Track */}
      <rect x={BX} y={BY} width={BW} height={BH} rx={7} ry={7} fill="#1c2333" />

      {/* Filled bar */}
      {fw > 0 && (
        <motion.rect
          x={BX}
          y={BY}
          width={fw}
          height={BH}
          rx={7}
          ry={7}
          fill={color}
          opacity={0.85}
          initial={{ scaleX: 0, transformOrigin: "left" }}
          animate={{ scaleX: 1, transformOrigin: "left" }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0, 1] }}
        />
      )}

      {/* Label */}
      <motion.text
        x={W / 2}
        y={14}
        textAnchor="middle"
        fontFamily="system-ui,sans-serif"
        fontSize={11}
        fontWeight={600}
        fill={color}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        {label}
      </motion.text>

      {/* Value */}
      <motion.text
        x={W / 2}
        y={BY + BH + 24}
        textAnchor="middle"
        fontFamily="system-ui,sans-serif"
        fontSize={14}
        fontWeight={700}
        fill="#e6edf3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        {pct.toFixed(1)}
        {unit}
      </motion.text>
    </motion.svg>
  );
}

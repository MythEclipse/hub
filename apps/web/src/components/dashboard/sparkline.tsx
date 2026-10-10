"use client";

import { motion } from "motion/react";
import { NoData } from "./no-data";

const W = 300;
const H = 160;
const PL = 45;
const PT = 20;
const PR = 10;
const PB = 25;
const VW = W - PL - PR;
const VH = H - PT - PB;

function gridLines(maxV: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const y = PT + (VH * i) / 4;
    const val = maxV * (1 - i / 4);
    return (
      <g key={`grid-${y}`}>
        <line
          x1={PL}
          y1={y}
          x2={PL + VW}
          y2={y}
          stroke="#21262d"
          strokeWidth={1}
        />
        <text
          x={PL - 6}
          y={y + 3}
          textAnchor="end"
          fill="#6e7681"
          fontSize={9}
          fontFamily="system-ui,sans-serif"
        >
          {val.toFixed(0)}
        </text>
      </g>
    );
  });
}

function xAxisLabels(length: number) {
  if (length <= 5) return null;
  return Array.from({ length: 5 }, (_, i) => {
    const idx = Math.floor(((i + 1) * (length - 1)) / 5);
    const x = PL + (VW * idx) / (length - 1);
    return (
      <text
        key={`xlabel-${x}`}
        x={x}
        y={PT + VH + 16}
        textAnchor="middle"
        fill="#6e7681"
        fontSize={9}
        fontFamily="system-ui,sans-serif"
      >
        {idx + 1}
      </text>
    );
  });
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return <NoData />;

  const maxV = Math.max(...data.map(Math.abs), 1);
  // A single sample has no span to divide by, so 0/0 would put NaN in the
  // path. Pin the lone point to the left edge; a range query can legitimately
  // collapse to one bucket.
  const span = data.length - 1;
  const xAt = (i: number) => PL + (VW * i) / span;

  const pts = data
    .map(
      (v, i) => `${xAt(i).toFixed(1)},${(PT + VH * (1 - v / maxV)).toFixed(1)}`,
    )
    .join(" ");

  const area = `M${PL},${PT + VH} L${pts} L${PL + VW},${PT + VH} Z`;
  const lv = data[data.length - 1];
  const ly = PT + VH * (1 - lv / maxV);
  const d = `M${pts}`;

  return (
    <motion.svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Sparkline chart"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {gridLines(maxV)}

      {/* Area fill */}
      <motion.path
        d={area}
        fill={color}
        opacity={0.15}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      />

      {/* Animated line path */}
      {data.length > 1 && (
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0, 1] }}
        />
      )}

      {/* Endpoint dot */}
      <motion.circle
        cx={PL + VW}
        cy={ly}
        r={3}
        fill={color}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 1.0 }}
      />

      {/* Endpoint value label */}
      <motion.text
        x={PL + VW}
        y={ly - 10}
        textAnchor="end"
        fill={color}
        fontSize={11}
        fontWeight={600}
        fontFamily="system-ui,sans-serif"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 1.1 }}
      >
        {lv.toFixed(1)}
      </motion.text>

      {xAxisLabels(data.length)}
    </motion.svg>
  );
}

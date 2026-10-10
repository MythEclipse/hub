"use client";

import { motion } from "motion/react";

export function NoData() {
  return (
    <motion.svg
      width={200}
      height={100}
      viewBox="0 0 200 100"
      role="img"
      aria-label="No data available"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.text
        x={100}
        y={50}
        textAnchor="middle"
        fill="#6e7681"
        fontSize={12}
        fontFamily="system-ui,sans-serif"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        No data
      </motion.text>
    </motion.svg>
  );
}

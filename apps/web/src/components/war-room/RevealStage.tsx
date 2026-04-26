"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const STAGGER_MS = 600;

/**
 * Wraps a result section in a fade-up reveal animation, with an `order`-driven
 * stagger so the FatigueGraph appears first, then the ranking, then the rest.
 *
 * Mount this only when the user has crossed into the 'revealing' / 'complete' phase.
 */
export function RevealStage({
  order = 0,
  children,
  className,
}: {
  order?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: (order * STAGGER_MS) / 1000, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

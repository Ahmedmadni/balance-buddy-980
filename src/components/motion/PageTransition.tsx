import { motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Intentionally not wrapped in <AnimatePresence mode="wait">: that mode plays
// the outgoing page's exit animation to completion before mounting the next
// page, so the old route stays fully visible (and interactive) for the whole
// exit duration on every navigation. Keying a plain motion.div on the
// pathname swaps children immediately and only animates the new page in.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] as any }}
    >
      {children}
    </motion.div>
  );
}

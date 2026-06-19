import { animate, useInView, useMotionValue, useTransform } from "framer-motion";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
};

export function Counter({ value, format, duration = 1.2, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => (format ? format(v) : Math.round(v).toLocaleString("ar")));

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] as any });
    return () => controls.stop();
  }, [inView, value, duration, mv]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}

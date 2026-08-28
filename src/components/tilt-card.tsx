"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { useRef, type ReactNode } from "react";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  intensity?: number;
  floatDelay?: number;
};

export function TiltCard({
  children,
  className = "",
  intensity = 12,
  floatDelay = 0,
}: TiltCardProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(y, { stiffness: 180, damping: 18 });
  const ry = useSpring(x, { stiffness: 180, damping: 18 });
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glare = useMotionTemplate`radial-gradient(480px circle at ${glareX}% ${glareY}%, rgba(45,212,191,0.28), transparent 45%)`;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    x.set((px - 0.5) * intensity);
    y.set((0.5 - py) * intensity);
    glareX.set(px * 100);
    glareY.set(py * 100);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
    glareX.set(50);
    glareY.set(50);
  }

  return (
    <motion.div
      ref={ref}
      className={`tilt-card ${className}`}
      style={{
        rotateX: reduceMotion ? 0 : rx,
        rotateY: reduceMotion ? 0 : ry,
        transformStyle: "preserve-3d",
      }}
      animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
      transition={{
        y: {
          duration: 4.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay,
        },
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="tilt-card-face" style={{ transform: "translateZ(28px)" }}>
        {children}
      </div>
      <motion.div className="tilt-card-glare" style={{ background: glare }} aria-hidden />
    </motion.div>
  );
}

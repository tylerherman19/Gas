"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const FORMATTERS = {
  price: (n: number) => `$${n.toFixed(3)}`,
  cents: (n: number) => `${n.toFixed(1)}¢`,
  dollars2: (n: number) => `$${n.toFixed(2)}`,
  int: (n: number) => `${Math.round(n)}`,
} as const;

type Format = keyof typeof FORMATTERS;

/**
 * A number that rolls up into place like a counter settling: starts at zero
 * the first time it scrolls on screen, eases out to the posted figure on the
 * slowest rung of the ladder. Server-renders the final value so the page is
 * correct before hydration and without JS.
 */
export default function CountUp({
  value,
  format = "price",
  duration = 700,
  delay = 0,
  className = "",
  style,
}: {
  value: number;
  format?: Format;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(() => FORMATTERS[format](value));
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = FORMATTERS[format];

    // Reduced motion: the media query in globals.css keeps the number visible
    // and final; there is simply no roll to run.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setStarted(true);
        const t0 = performance.now() + delay;
        const tick = (now: number) => {
          const t = Math.min(Math.max((now - t0) / duration, 0), 1);
          // ease-out cubic: quick start, soft landing, matching --ease.
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(fmt(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, format, duration, delay]);

  return (
    <span
      ref={ref}
      className={`count-up${started ? " counting" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {shown}
    </span>
  );
}

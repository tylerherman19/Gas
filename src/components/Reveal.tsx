"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Scroll reveal on the shared motion system: 8px rise, soft landing, one
 * optional delay. Fires once and stays put. Everything below the fold waits
 * for the scroll; anything already on screen goes immediately, which doubles
 * as the load-in sequence for the top of the page.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        io.disconnect();
      },
      // Trip just before the element fully arrives so the rise reads as
      // meeting the scroll rather than chasing it.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal${inView ? " reveal-in" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--m-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

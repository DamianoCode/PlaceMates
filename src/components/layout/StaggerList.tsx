"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from "react";
import type { CSSProperties, ElementType, ReactElement } from "react";

// Only the first screenful cascades; later items appear instantly.
const CAP = 8;

/**
 * One-shot staggered fade-up entrance for a list (ranking, plans, places).
 * The cascade plays only when the list mounts at the top of the page — a
 * fresh tab navigation — and never replays on:
 *   - filter changes (search-param navigation re-renders the server
 *     component but doesn't remount this client component, so `phase`
 *     stays "static"), or
 *   - back-navigation to a restored mid-list scroll (the rAF check sees
 *     scrollY > 0 and skips straight to "static").
 *
 * Clones each direct child to stamp the entrance style. The decision is
 * deferred one frame so it runs after Next has applied scroll restoration.
 */
export function StaggerList({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<"pending" | "animate" | "static">(
    "pending",
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPhase(window.scrollY < 8 ? "animate" : "static");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (phase !== "animate") return;
    // Close the window so a later filter change / scroll-to-top doesn't
    // replay the cascade.
    const t = setTimeout(() => setPhase("static"), 800);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <Tag className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child) || i >= CAP || phase === "static") {
          return child;
        }
        const el = child as ReactElement<{ style?: CSSProperties }>;
        const entrance: CSSProperties =
          phase === "pending"
            ? { opacity: 0 }
            : { animation: `pm-fade-up 240ms ease-out ${i * 40}ms both` };
        return cloneElement(el, {
          style: { ...el.props.style, ...entrance },
        });
      })}
    </Tag>
  );
}

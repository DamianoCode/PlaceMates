"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

const FADE = 24; // px width of each edge fade

function maskFor(left: boolean, right: boolean): string {
  if (left && right) {
    return `linear-gradient(to right, transparent, black ${FADE}px, black calc(100% - ${FADE}px), transparent)`;
  }
  if (right) {
    return `linear-gradient(to right, black calc(100% - ${FADE}px), transparent)`;
  }
  if (left) {
    return `linear-gradient(to right, transparent, black ${FADE}px)`;
  }
  return "none";
}

/**
 * Horizontal scroll container (filter pill rows, chips) with scroll-aware
 * edge fades. A side fades only when content is actually hidden in that
 * direction: nothing at rest when everything fits, right-only at the
 * start of an overflowing row, left-only once scrolled to the end. This
 * avoids a static mask clipping the first/active pill when there's
 * nothing to scroll. Renders a <nav>; forwards aria-label, className, etc.
 */
export function ScrollRow({
  className,
  children,
  style,
  ...rest
}: ComponentProps<"nav">) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // 1px slack absorbs sub-pixel rounding so the fade fully clears at
      // the exact start/end instead of lingering by a fraction.
      setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Catches viewport resizes (pills reflow) so overflow state stays
    // accurate without a scroll event.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const mask = maskFor(edges.left, edges.right);
  return (
    <nav
      ref={ref}
      className={className}
      style={{ ...style, WebkitMaskImage: mask, maskImage: mask }}
      {...rest}
    >
      {children}
    </nav>
  );
}

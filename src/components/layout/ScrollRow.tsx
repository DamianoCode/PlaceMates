"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

/**
 * Horizontal scroll container (filter pill rows, chips) with scroll-aware
 * edge fades. A side fades only when content is actually hidden in that
 * direction: nothing at rest when everything fits, right-only at the
 * start of an overflowing row, left-only once scrolled to the end.
 *
 * The fade is two gradient overlays whose opacity transitions — not a CSS
 * mask. A mask can't tween between "none" and a gradient, so it would pop
 * in/out; opacity animates smoothly. Renders a <nav> inside a relative
 * wrapper; forwards aria-label, className, etc. to the <nav>.
 */
export function ScrollRow({
  className,
  children,
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

  return (
    <div className="relative">
      <nav ref={ref} className={className} {...rest}>
        {children}
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent transition-opacity duration-200 ease-out"
        style={{ opacity: edges.left ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent transition-opacity duration-200 ease-out"
        style={{ opacity: edges.right ? 1 : 0 }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { PlaceCard } from "@/components/places/PlaceCard";
import type { PlaceCard as PlaceCardData } from "@/domain/places/list-with-stats";

/**
 * Virtualised list of place cards. Uses the window as the scroll
 * container so the page keeps its natural body-scroll behaviour
 * (good for mobile + native pull-to-refresh + browser scroll
 * restoration). Only the visible cards (plus a small overscan
 * buffer) are mounted in the DOM at any time, so a list of 1000+
 * places stays as snappy as a list of 10 on mid-range Android.
 *
 * Estimate height: 96 px matches a card with photo (h-20 image +
 * p-3 padding ≈ 92 px) plus the 8 px gap. Real heights are measured
 * after first paint via `measureElement`, so any deviation (long
 * names that wrap, missing photo, etc.) corrects itself within a
 * frame.
 */
// How many of the first cards get the staggered entrance. Capped so the
// cascade stays short (8 × 40ms ≈ 320ms) and so only the cards actually
// visible on first paint animate.
const STAGGER_CAP = 8;

export function PlacesVirtualList({ cards }: { cards: PlaceCardData[] }) {
  const listRef = useRef<HTMLUListElement | null>(null);
  // Window virtualizer needs the list's offset from the page top to
  // know where its content starts. We measure it on mount and after
  // the layout settles. SSR-safe — defaults to 0 until we hit client.
  const [offset, setOffset] = useState(0);

  // One-shot entrance stagger. Virtualised rows mount/unmount on scroll,
  // so animating per-mount would re-fire on every scroll — a flashing
  // mess. Instead we run the stagger only during a short window after
  // first paint; after it closes, scroll-revealed rows just appear. This
  // gives the "cards cascade in when I open the tab" feel without the
  // anti-pattern.
  const [staggerOn, setStaggerOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setStaggerOn(false), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const update = () => {
      if (listRef.current) {
        setOffset(listRef.current.getBoundingClientRect().top + window.scrollY);
      }
    };
    update();
    // Recalc on resize — header/filter rows may reflow at different
    // viewport widths.
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: cards.length,
    estimateSize: () => 96,
    overscan: 4,
    scrollMargin: offset,
  });

  const virtualItems = virtualizer.getVirtualItems();
  // Only run the entrance stagger when the list mounts at the very top.
  // On back-navigation Next restores the scroll position mid-list, so the
  // first rendered row won't be index 0 — we skip the cascade and the
  // list just appears, instead of animating the (now off-screen) first 8
  // while the visible rows sit static. The brief first-paint race (top
  // rendered before scroll restore jumps) is hidden by the RouteTransition
  // view fade still ramping opacity from 0.
  const atTop = virtualItems.length > 0 && virtualItems[0].index === 0;

  return (
    <ul
      ref={listRef}
      // Total scroll height drives the body; absolute children sit
      // inside this relative parent at their measured offsets.
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: "relative",
      }}
    >
      {virtualItems.map((row) => {
        const card = cards[row.index];
        const animate = staggerOn && atTop && row.index < STAGGER_CAP;
        return (
          <li
            key={card.id}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              paddingBottom: "0.5rem",
            }}
          >
            {/* Entrance animation lives on an inner wrapper, not the <li>:
             *  the <li> owns the virtualiser's positioning transform, and
             *  pm-fade-up animates transform too — animating both on the
             *  same element would make the card jump to the wrong spot. */}
            <div
              style={
                animate
                  ? {
                      animation: `pm-fade-up 240ms ease-out ${row.index * 40}ms both`,
                    }
                  : undefined
              }
            >
              <PlaceCard place={card} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

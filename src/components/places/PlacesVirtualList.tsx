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

  // Entrance cascade for the first screenful of cards. Three phases:
  //   pending  – first-batch rows held at opacity 0 (pre-decision)
  //   animate  – cascade plays (only when we open the list at the top)
  //   static   – no animation; rows just show
  //
  // The decision is deferred one frame (rAF) so it runs AFTER Next has
  // applied scroll restoration. That's the crux: on back-navigation Next
  // restores a mid-list scroll, but it does so in an effect that runs
  // *after* this component's first render — reading scroll synchronously
  // would wrongly see the top and animate. By waiting a frame we read the
  // settled position and only cascade when genuinely at the top (first
  // load / fresh tab open). Holding first-batch rows at opacity 0 until
  // the decision means flipping to animate/static never flickers; those
  // rows are off-screen anyway when the scroll was restored mid-list.
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
    // Close the window so scrolling back to the top later doesn't replay.
    const t = setTimeout(() => setPhase("static"), 800);
    return () => clearTimeout(t);
  }, [phase]);

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
        // Only the first screenful participates in the entrance; rows past
        // the cap (and anything scrolled in later) always render normally.
        const inFirstBatch = row.index < STAGGER_CAP;
        const entrance =
          inFirstBatch && phase === "pending"
            ? { opacity: 0 }
            : inFirstBatch && phase === "animate"
              ? {
                  animation: `pm-fade-up 240ms ease-out ${row.index * 40}ms both`,
                }
              : undefined;
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
            <div style={entrance}>
              <PlaceCard place={card} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

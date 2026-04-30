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
export function PlacesVirtualList({ cards }: { cards: PlaceCardData[] }) {
  const listRef = useRef<HTMLUListElement | null>(null);
  // Window virtualizer needs the list's offset from the page top to
  // know where its content starts. We measure it on mount and after
  // the layout settles. SSR-safe — defaults to 0 until we hit client.
  const [offset, setOffset] = useState(0);

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
      {virtualizer.getVirtualItems().map((row) => {
        const card = cards[row.index];
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
            <PlaceCard place={card} />
          </li>
        );
      })}
    </ul>
  );
}

import type { CSSProperties } from "react";
import { StaggerList } from "@/components/layout/StaggerList";
import { PlaceCard } from "@/components/places/PlaceCard";
import type { PlaceCard as PlaceCardData } from "@/domain/places/list-with-stats";

/**
 * Plain (non-virtualized) places list.
 *
 * `content-visibility: auto` skips layout + paint for off-screen cards, so
 * even a few hundred stay cheap without a window virtualizer. Crucially,
 * every card stays in the DOM at its real height — so native scroll
 * restoration on back-navigation is exact. The old `useWindowVirtualizer`
 * reset its measured sizes on remount (back to a 96 px estimate) and
 * re-measured the restored viewport, which made the cards visibly jump.
 *
 * The first screenful gets the shared staggered fade-up entrance;
 * `StaggerList` skips the cascade on back-nav / mid-list mounts (scrollY
 * guard) so it never replays after you've scrolled.
 */
const CARD_CV_STYLE = {
  contentVisibility: "auto",
  // ≈ a card's rendered height (h-20 thumb + p-3) — keeps the scrollbar and
  // restored offset accurate before a card has been painted once.
  containIntrinsicSize: "auto 96px",
} as CSSProperties;

export function PlacesList({ cards }: { cards: PlaceCardData[] }) {
  return (
    <StaggerList as="ul" className="space-y-2">
      {cards.map((card) => (
        <li key={card.id} style={CARD_CV_STYLE}>
          <PlaceCard place={card} />
        </li>
      ))}
    </StaggerList>
  );
}

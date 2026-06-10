import Link from "next/link";
import { Star } from "lucide-react";
import type { RankedPlace } from "@/domain/ranking/service";
import { CategoryIcon } from "@/components/map/category-icons";
import { StarRating } from "@/components/places/StarRating";

/**
 * Ranking list entry. Echoes PlaceCard layout — icon tile + name stack —
 * but leads with a rank badge and drops the wishlist/favorite chips
 * (ranking is cross-group context, per-user flags don't make sense here).
 */
export function RankedPlaceCard({
  place,
  rank,
}: {
  place: RankedPlace;
  rank: number;
}) {
  return (
    <Link
      href={`/ranking/${place.canonicalId}`}
      className="group flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition duration-150 hover:bg-accent/40 active:scale-[0.985] active:bg-accent/50"
    >
      <div className="flex flex-col items-center justify-center">
        <span className="font-display text-2xl tabular-nums leading-none text-primary">
          #{rank}
        </span>
      </div>
      <div
        aria-hidden
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
      >
        <CategoryIcon
          slug={place.categoryHint}
          size={24}
          strokeWidth={1.5}
          className="text-primary/70"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="truncate font-display text-base leading-tight">
          {place.name}
        </p>
        <div className="flex items-center gap-1.5 text-sm">
          <Star size={14} className="fill-amber-400 stroke-amber-500" />
          <span className="font-medium tabular-nums">
            {place.avg.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({place.count} {place.count === 1 ? "ocena" : "ocen"})
          </span>
        </div>
        <StarRating value={place.avg} size={12} />
      </div>
    </Link>
  );
}

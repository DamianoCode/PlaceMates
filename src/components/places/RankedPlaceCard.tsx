import Link from "next/link";
import { Star } from "lucide-react";
import type { RankedPlace } from "@/domain/ranking/service";
import { plural } from "@/lib/plural";
import { CardThumb } from "@/components/places/CardThumb";
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
      className="group flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition duration-150 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985] active:bg-accent/50"
    >
      <div className="flex flex-col items-center justify-center">
        <span className="font-display text-2xl tabular-nums leading-none text-primary">
          #{rank}
        </span>
      </div>
      <CardThumb photoUrl={place.photoUrl} categorySlug={place.categoryHint} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="truncate font-display text-lg leading-tight">
          {place.name}
        </p>
        <div className="flex items-center gap-1.5 text-sm">
          <Star size={14} className="fill-amber-400 stroke-amber-500" />
          <span className="font-medium tabular-nums">
            {place.avg.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({place.count} {plural(place.count, ["ocena", "oceny", "ocen"])})
          </span>
        </div>
        <StarRating value={place.avg} size={12} />
      </div>
    </Link>
  );
}

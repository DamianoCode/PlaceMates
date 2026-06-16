import Link from "next/link";
import { Star } from "lucide-react";
import type { RankedPlace } from "@/domain/ranking/service";
import { plural } from "@/lib/plural";
import { CategoryIcon } from "@/components/map/category-icons";
import { RankedPlaceCard } from "@/components/places/RankedPlaceCard";

/**
 * The year's podium. #1 is a full-bleed photo hero (its cover shot as the
 * backdrop, text floated over a gradient scrim); #2 and #3 fall back to the
 * standard ranking cards. When the winner has no photo we render a warm
 * gradient panel with the category glyph instead of a flat tile.
 */
export function YearTopPlaces({ places }: { places: RankedPlace[] }) {
  if (places.length === 0) return null;
  const [first, ...rest] = places;

  return (
    <div className="space-y-2.5">
      <Link
        href={`/ranking/${first.canonicalId}`}
        className="group relative block aspect-[5/4] overflow-hidden rounded-3xl border sm:aspect-[16/10]"
      >
        {first.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={first.photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-muted"
          >
            <CategoryIcon
              slug={first.categoryHint}
              size={96}
              strokeWidth={1}
              className="text-primary/40"
            />
          </div>
        )}

        {/* Scrim so the text stays legible over any photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        <div className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 font-display text-xl font-semibold text-amber-950 shadow-lg">
          1
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
            Miejsce roku
          </p>
          <p className="mt-1 font-display text-3xl leading-tight drop-shadow-sm">
            {first.name}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm">
            <Star size={15} className="fill-amber-400 stroke-amber-400" />
            <span className="font-semibold tabular-nums">
              {first.avg.toFixed(2)}
            </span>
            <span className="text-white/70">
              · {first.count} {plural(first.count, ["ocena", "oceny", "ocen"])}
            </span>
          </div>
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="space-y-2">
          {rest.map((place, i) => (
            <li key={place.canonicalId}>
              <RankedPlaceCard place={place} rank={i + 2} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

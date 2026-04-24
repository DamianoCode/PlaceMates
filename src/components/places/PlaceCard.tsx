import Link from "next/link";
import { Bookmark, Heart, Star } from "lucide-react";
import type { PlaceCard as PlaceCardData } from "@/domain/places/list-with-stats";
import { CategoryIcon } from "@/components/map/category-icons";

export function PlaceCard({ place }: { place: PlaceCardData }) {
  return (
    <Link
      href={`/places/${place.id}`}
      className="group flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition-colors hover:bg-accent/40"
    >
      {place.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.photoUrl}
          alt=""
          loading="lazy"
          className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
        >
          <CategoryIcon
            slug={place.categorySlug}
            size={28}
            strokeWidth={1.5}
            className="text-primary/70"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display truncate text-lg leading-tight">
              {place.name}
            </h3>
            {place.isFavorite && (
              <Heart
                size={14}
                className="flex-shrink-0 fill-rose-500 stroke-rose-500"
                aria-label="Ulubione"
              />
            )}
            {place.isWishlisted && (
              <Bookmark
                size={14}
                className="flex-shrink-0 fill-primary stroke-primary"
                aria-label="Do odwiedzenia"
              />
            )}
          </div>
          <p className="truncate text-xs italic text-muted-foreground">
            {place.categoryName}
          </p>
          {place.address && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">
              {place.address}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1.5">
          {place.overall !== null ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <Star size={14} className="fill-amber-400 stroke-amber-500" />
              <span className="font-medium tabular-nums">
                {place.overall.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({place.ratingCount})
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">brak ocen</span>
          )}
        </div>
      </div>
    </Link>
  );
}

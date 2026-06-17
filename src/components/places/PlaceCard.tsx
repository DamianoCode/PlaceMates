import Link from "next/link";
import { Bookmark, Heart, Star, Users } from "lucide-react";
import type { PlaceCard as PlaceCardData } from "@/domain/places/list-with-stats";
import { CardThumb } from "@/components/places/CardThumb";

export function PlaceCard({ place }: { place: PlaceCardData }) {
  return (
    <Link
      href={`/places/${place.id}`}
      className="group flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition duration-150 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985] active:bg-accent/50"
    >
      <CardThumb
        photoUrl={place.photoUrl}
        categorySlug={place.categorySlug}
        vtName={`place-photo-${place.id}`}
      />

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
            {place.isGroupWishlisted && (
              <span
                title={
                  place.groupWishlistedIn.length > 0
                    ? `Grupowo do odwiedzenia: ${place.groupWishlistedIn
                        .map((g) => g.name)
                        .join(", ")}`
                    : "Grupowo do odwiedzenia"
                }
                className="inline-flex flex-shrink-0"
              >
                <Users
                  size={14}
                  className="fill-primary/20 stroke-primary"
                  aria-label={
                    place.groupWishlistedIn.length > 0
                      ? `Grupowo do odwiedzenia: ${place.groupWishlistedIn
                          .map((g) => g.name)
                          .join(", ")}`
                      : "Grupowo do odwiedzenia"
                  }
                />
              </span>
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
          {/* Multi-group attribution — only renders when the canonical
           *  has siblings in another of the user's groups. The chip
           *  signals "this card collapses N places", so the user
           *  knows why ratings/count look richer than a fresh add. */}
          {place.availableInGroups.length >= 2 && (
            <p className="mt-0.5 line-clamp-1 inline-flex items-center gap-1 text-[11px] text-primary/80">
              <Users size={11} className="flex-shrink-0" />
              <span className="truncate">
                W:{" "}
                {place.availableInGroups.map((g) => g.name).join(" · ")}
              </span>
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

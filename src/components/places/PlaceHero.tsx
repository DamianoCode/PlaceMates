"use client";

import { CategoryIcon } from "@/components/map/category-icons";
import { PhotoHero } from "./PhotoHero";

type Photo = { id: string; url: string };

/**
 * Place-flavoured hero — delegates to `<PhotoHero>` and supplies a
 * category-matched lucide icon for the empty state. Same icon set as
 * the map markers, so an unphotographed restaurant's hero and its pin
 * on the map both render UtensilsCrossed, keeping the visual language
 * tight.
 */
export function PlaceHero({
  photos,
  categorySlug,
}: {
  photos: Photo[];
  categorySlug: string | null;
}) {
  return (
    <PhotoHero
      photos={photos}
      fallback={
        <CategoryIcon
          slug={categorySlug}
          size={72}
          strokeWidth={1.25}
          className="text-primary/60"
        />
      }
    />
  );
}

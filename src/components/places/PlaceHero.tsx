"use client";

import { CategoryIcon } from "@/components/map/category-icons";

type Photo = { id: string; url: string };

/**
 * Hero block above the place detail.
 *  - 0 photos: full-width warm gradient with a large category icon.
 *  - 1 photo: the cover stretches full-width with a cinematic cap.
 *  - 2+ photos: cover stays full-width; the remaining photos render as
 *    a scrolling thumbnail strip beneath it.
 *
 * Uses the same lucide icon set as the map markers — so a restaurant's
 * empty-state hero and its pin on the map both render UtensilsCrossed,
 * keeping the app's visual language tight.
 */
export function PlaceHero({
  photos,
  categorySlug,
}: {
  photos: Photo[];
  categorySlug: string | null;
}) {
  // aspect-[16/9] + max-height prevents the hero from ballooning to
  // absurd heights on wide desktop viewports. On narrow screens the
  // aspect ratio drives; once width * 9/16 would exceed the cap the
  // element becomes a cinematic wide panorama and object-cover trims
  // the top/bottom of the image.
  const heroClasses =
    "aspect-[16/9] max-h-[min(50vh,420px)] w-full rounded-2xl object-cover";

  if (photos.length === 0) {
    return (
      <div
        aria-hidden
        className={`${heroClasses} flex items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-muted`}
      >
        <CategoryIcon
          slug={categorySlug}
          size={72}
          strokeWidth={1.25}
          className="text-primary/60"
        />
      </div>
    );
  }

  const [cover, ...rest] = photos;

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.url} alt="" loading="lazy" className={heroClasses} />
      {rest.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {rest.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.url}
              alt=""
              loading="lazy"
              className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

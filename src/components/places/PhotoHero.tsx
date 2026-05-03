"use client";

import type { ReactNode } from "react";
import { PhotoView } from "react-photo-view";

type Photo = { id: string; url: string };

/**
 * Hero block for a detail page (place / item).
 *  - 0 photos: full-width warm gradient with a caller-provided icon.
 *  - 1 photo: the cover stretches full-width with a cinematic cap.
 *  - 2+ photos: cover stays full-width; the rest scroll as thumbnails.
 *
 * Every photo is wrapped in a `<PhotoView>` so taps open the shared
 * lightbox provided by `<PhotoGallery>` higher up the tree. Sibling
 * `<PhotoView>` elements (including the grid tiles below the hero)
 * register into the same swipe carousel — once open, the user can
 * flick through every photo without dismissing first.
 */
export function PhotoHero({
  photos,
  fallback,
}: {
  photos: Photo[];
  /** Rendered centred in the empty-state gradient when photos is empty. */
  fallback: ReactNode;
}) {
  // aspect-[16/9] + max-height prevents the hero from ballooning on
  // wide desktop viewports. On narrow screens the aspect ratio drives;
  // once width * 9/16 would exceed the cap the element becomes a
  // cinematic wide panorama and object-cover trims the top/bottom.
  const heroClasses =
    "aspect-[16/9] max-h-[min(50vh,420px)] w-full rounded-2xl object-cover cursor-zoom-in";

  if (photos.length === 0) {
    return (
      <div
        aria-hidden
        className="flex aspect-[16/9] max-h-[min(50vh,420px)] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
      >
        {fallback}
      </div>
    );
  }

  const [cover, ...rest] = photos;

  return (
    <div className="space-y-2">
      <PhotoView src={cover.url}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.url} alt="" loading="lazy" className={heroClasses} />
      </PhotoView>
      {rest.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {rest.map((p) => (
            <PhotoView key={p.id} src={p.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                loading="lazy"
                className="h-20 w-20 flex-shrink-0 cursor-zoom-in rounded-xl object-cover"
              />
            </PhotoView>
          ))}
        </div>
      )}
    </div>
  );
}

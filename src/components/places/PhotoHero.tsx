"use client";

import type { ReactNode } from "react";
import { usePhotoOpener } from "./PhotoGallery";

type Photo = { id: string; url: string };

/**
 * Hero block for a detail page (place / item).
 *  - 0 photos: full-width warm gradient with a caller-provided icon.
 *  - 1 photo: the cover stretches full-width with a cinematic cap.
 *  - 2+ photos: cover stays full-width; the rest scroll as thumbnails.
 *
 * Every clickable image calls `openAt(photoId)` from `<PhotoGallery>`
 * context — the carousel is owned upstream as the single source of
 * truth so registrations don't double-count when grid tiles also
 * become clickable.
 */
export function PhotoHero({
  photos,
  fallback,
}: {
  photos: Photo[];
  /** Rendered centred in the empty-state gradient when photos is empty. */
  fallback: ReactNode;
}) {
  const { openAt } = usePhotoOpener();

  // aspect-[16/9] + max-height prevents the hero from ballooning on
  // wide desktop viewports. On narrow screens the aspect ratio drives;
  // once width * 9/16 would exceed the cap the element becomes a
  // cinematic wide panorama and object-cover trims the top/bottom.
  // Applied to the <button> wrapping the cover so it's keyboard-focusable;
  // object-cover lives on the inner <img>.
  const heroClasses =
    "block aspect-[16/9] max-h-[min(50vh,420px)] w-full cursor-zoom-in overflow-hidden rounded-2xl";

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
      <button
        type="button"
        onClick={() => openAt(cover.id)}
        aria-label="Otwórz zdjęcie"
        className={heroClasses}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </button>
      {rest.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {rest.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openAt(p.id)}
              aria-label="Otwórz zdjęcie"
              className="h-20 w-20 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

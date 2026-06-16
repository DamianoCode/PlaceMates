import type { YearPhoto } from "@/domain/year-review/service";

/**
 * Masonry collage of the year's photos. CSS multi-column layout lets each
 * image keep its natural aspect ratio, so the wall reads organic rather
 * than a rigid grid. Each tile reserves its intrinsic aspect ratio up
 * front, so streaming images don't reflow the columns (no layout shift).
 * Decorative (aria-hidden) — purely atmosphere. Server-rendered.
 */
export function YearGallery({ photos }: { photos: YearPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div aria-hidden className="columns-2 gap-2.5 sm:columns-3 [&>*]:mb-2.5">
      {photos.map((photo, i) => (
        <div
          key={`${photo.url}-${i}`}
          className="overflow-hidden rounded-2xl border border-border/50 break-inside-avoid bg-muted"
          style={
            photo.width > 0 && photo.height > 0
              ? { aspectRatio: `${photo.width} / ${photo.height}` }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.04]"
          />
        </div>
      ))}
    </div>
  );
}

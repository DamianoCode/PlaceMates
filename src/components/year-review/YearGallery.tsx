/**
 * Masonry collage of the year's photos. CSS multi-column layout lets each
 * image keep its natural aspect ratio, so the wall reads organic rather
 * than a rigid grid. Decorative (aria-hidden) — purely atmosphere. Server-
 * rendered; a subtle zoom-on-hover adds life without JS.
 */
export function YearGallery({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;
  return (
    <div
      aria-hidden
      className="columns-2 gap-2.5 sm:columns-3 [&>*]:mb-2.5"
    >
      {photos.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="overflow-hidden rounded-2xl border border-border/50 break-inside-avoid"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.04]"
          />
        </div>
      ))}
    </div>
  );
}

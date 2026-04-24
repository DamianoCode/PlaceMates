"use client";

type Photo = { id: string; url: string };

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  "ice-cream": "🍨",
  bakery: "🥐",
  viewpoint: "🏔️",
  attraction: "✨",
  park: "🌳",
  beach: "🏖️",
  bar: "🍻",
  accommodation: "🛏️",
  shop: "🛍️",
  other: "📍",
};

/**
 * Hero block above the place detail.
 *  - 0 photos: full-width gradient with the category emoji.
 *  - 1 photo: the cover stretches full-width at a fixed aspect.
 *  - 2+ photos: cover stays full-width; the remaining photos render as
 *    a scrolling thumbnail strip beneath it.
 *
 * Photos arrive ordered cover-first from the server (see
 * listPhotosForPlace) so we trust the array order.
 */
export function PlaceHero({
  photos,
  categorySlug,
}: {
  photos: Photo[];
  categorySlug: string | null;
}) {
  if (photos.length === 0) {
    const emoji = categorySlug ? CATEGORY_EMOJI[categorySlug] ?? "📍" : "📍";
    return (
      <div
        aria-hidden
        className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted text-6xl"
      >
        {emoji}
      </div>
    );
  }

  const [cover, ...rest] = photos;

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt=""
        loading="lazy"
        className="aspect-[16/9] w-full rounded-2xl object-cover"
      />
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

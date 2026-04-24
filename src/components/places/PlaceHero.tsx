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
 *  - 1 photo: the cover stretches full-width with a cinematic cap.
 *  - 2+ photos: cover stays full-width; the remaining photos render as
 *    a scrolling thumbnail strip beneath it.
 *
 * aspect-[16/9] + max-height prevents the hero from ballooning to
 * absurd heights on wide desktop viewports. On narrow screens the
 * aspect ratio drives; once width * 9/16 would exceed the cap the
 * element becomes a cinematic wide panorama and object-cover trims
 * the top/bottom of the image.
 */
export function PlaceHero({
  photos,
  categorySlug,
}: {
  photos: Photo[];
  categorySlug: string | null;
}) {
  const heroClasses =
    "aspect-[16/9] max-h-[min(50vh,420px)] w-full rounded-2xl object-cover";

  if (photos.length === 0) {
    const emoji = categorySlug ? CATEGORY_EMOJI[categorySlug] ?? "📍" : "📍";
    return (
      <div
        aria-hidden
        className={`${heroClasses} flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-muted text-6xl`}
      >
        {emoji}
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

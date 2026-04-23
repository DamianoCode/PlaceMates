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
        className="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted text-6xl"
      >
        {emoji}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {photos.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={p.url}
          alt=""
          loading="lazy"
          className="h-40 w-60 flex-shrink-0 rounded-xl object-cover first:ml-0"
        />
      ))}
    </div>
  );
}

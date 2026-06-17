"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/map/category-icons";

/**
 * Shared thumbnail for list cards (places + ranking). A gradient tile
 * with the category icon is the placeholder/fallback; when a photo
 * exists it fades in over the top once decoded — no abrupt pop as lazy
 * images arrive on a phone. Centralising it here keeps a place looking
 * identical in /places and /ranking. Decorative (aria-hidden) — the
 * card's name carries the meaning.
 */
export function CardThumb({
  photoUrl,
  categorySlug,
  className,
  vtName,
}: {
  photoUrl: string | null;
  categorySlug: string | null;
  className?: string;
  /** When set, names this thumbnail for a shared-element morph into the
   *  detail hero (matching `view-transition-name` on both ends). */
  vtName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A cached image can finish loading before React attaches onLoad, so
  // it would never fire and the photo would stay invisible. Check
  // `complete` on mount to cover that case (naturalWidth guards against
  // a broken image reporting complete).
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div
      aria-hidden
      style={vtName ? { viewTransitionName: vtName } : undefined}
      className={cn(
        "relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted",
        className,
      )}
    >
      <CategoryIcon
        slug={categorySlug}
        size={28}
        strokeWidth={1.5}
        className="text-primary/70"
      />
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}

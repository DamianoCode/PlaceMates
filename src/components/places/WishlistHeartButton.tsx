"use client";

import { useActionState, useOptimistic } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toggleWishlistAction,
  type ToggleState,
} from "@/app/(app)/places/[id]/wishlist-actions";

/**
 * Icon-only wishlist toggle ("chcę odwiedzić"). Bookmark semantics —
 * kept distinct from favorites (heart). Lives in PageHeader trailing slot.
 */
export function WishlistHeartButton({
  placeId,
  initial,
}: {
  placeId: string;
  initial: boolean;
}) {
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    toggleWishlistAction,
    null,
  );
  const [optimistic, setOptimistic] = useOptimistic(
    state && "onWishlist" in state ? state.onWishlist : initial,
    (_prev: boolean, next: boolean) => next,
  );

  return (
    <form
      action={(fd) => {
        setOptimistic(!optimistic);
        return action(fd);
      }}
    >
      <input type="hidden" name="placeId" value={placeId} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={optimistic}
        aria-label={optimistic ? "Usuń z listy do odwiedzenia" : "Dodaj do listy do odwiedzenia"}
        title={optimistic ? "Do odwiedzenia" : "Dodaj do odwiedzenia"}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-all",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          optimistic
            ? "text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Bookmark
          size={20}
          strokeWidth={optimistic ? 2 : 1.75}
          fill={optimistic ? "currentColor" : "none"}
        />
      </button>
    </form>
  );
}

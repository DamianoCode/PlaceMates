"use client";

import { useOptimistic } from "react";
import { useActionState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toggleWishlistAction,
  type ToggleState,
} from "@/app/(app)/places/[id]/wishlist-actions";

/**
 * Icon-only wishlist toggle, designed to live in PageHeader's trailing
 * slot. The heart fills + glows when active, stays quiet when not.
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
        aria-label={optimistic ? "Usuń z wishlisty" : "Dodaj do wishlisty"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-all",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          optimistic
            ? "text-primary drop-shadow-[0_0_8px_oklch(0.58_0.14_42/0.35)]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Heart
          size={20}
          strokeWidth={optimistic ? 2 : 1.75}
          fill={optimistic ? "currentColor" : "none"}
          className="transition-transform data-[active=true]:scale-110"
          data-active={optimistic}
        />
      </button>
    </form>
  );
}

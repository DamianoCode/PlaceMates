"use client";

import { useActionState, useOptimistic } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toggleGroupWishlistAction,
  type ToggleGroupWishlistState,
} from "@/app/(app)/places/[id]/group-wishlist-actions";

/**
 * Icon-only toggle for the GROUP wishlist ("cała grupa chce
 * odwiedzić"). Distinct from `WishlistHeartButton` (private to one
 * user) — the two flags coexist so a place can be on either, both,
 * or neither.
 *
 * Visual: Users icon (group connotation) + primary fill when active.
 * Sits next to FavoriteHeartButton + WishlistHeartButton in the
 * PageHeader trailing slot.
 */
export function GroupWishlistButton({
  placeId,
  initial,
}: {
  placeId: string;
  initial: boolean;
}) {
  const [state, action, pending] = useActionState<
    ToggleGroupWishlistState,
    FormData
  >(toggleGroupWishlistAction, null);
  const [optimistic, setOptimistic] = useOptimistic(
    state && "onGroupWishlist" in state ? state.onGroupWishlist : initial,
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
        aria-label={
          optimistic
            ? "Usuń z grupowej listy do odwiedzenia"
            : "Dodaj do grupowej listy do odwiedzenia"
        }
        title={
          optimistic ? "Grupowo do odwiedzenia" : "Dodaj grupowo do odwiedzenia"
        }
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-all",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          optimistic
            ? "text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Users
          size={20}
          strokeWidth={optimistic ? 2.25 : 1.75}
          fill={optimistic ? "currentColor" : "none"}
        />
      </button>
    </form>
  );
}

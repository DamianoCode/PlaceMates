"use client";

import { useActionState, useOptimistic } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toggleFavoriteAction,
  type ToggleState,
} from "@/app/(app)/places/[id]/favorite-actions";

/**
 * Icon-only favorite toggle ("ulubione"). Heart semantics — kept distinct
 * from wishlist (bookmark). Lives in PageHeader trailing slot.
 */
export function FavoriteHeartButton({
  placeId,
  initial,
}: {
  placeId: string;
  initial: boolean;
}) {
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    toggleFavoriteAction,
    null,
  );
  const [optimistic, setOptimistic] = useOptimistic(
    state && "isFavorite" in state ? state.isFavorite : initial,
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
        aria-label={optimistic ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        title={optimistic ? "Ulubione" : "Dodaj do ulubionych"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-all",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          optimistic
            ? "text-rose-500 drop-shadow-[0_0_8px_oklch(0.65_0.2_15/0.35)]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Heart
          size={20}
          strokeWidth={optimistic ? 2 : 1.75}
          fill={optimistic ? "currentColor" : "none"}
        />
      </button>
    </form>
  );
}

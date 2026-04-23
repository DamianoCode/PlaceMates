"use client";

import { useActionState, useOptimistic } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toggleWishlistAction,
  type ToggleState,
} from "@/app/(app)/places/[id]/wishlist-actions";

export function WishlistToggle({
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
  // Optimistic flip so the heart fills instantly on tap.
  const [optimistic, setOptimistic] = useOptimistic(
    state && "onWishlist" in state ? state.onWishlist : initial,
    (_prev: boolean, next: boolean) => next,
  );

  const error = state && "error" in state ? state.error : null;

  return (
    <form
      action={(fd) => {
        setOptimistic(!optimistic);
        return action(fd);
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="placeId" value={placeId} />
      <Button
        type="submit"
        variant={optimistic ? "default" : "outline"}
        disabled={pending}
        aria-pressed={optimistic}
      >
        <Heart
          size={16}
          className="mr-2"
          fill={optimistic ? "currentColor" : "none"}
        />
        {optimistic ? "Na wishliście" : "Dodaj do wishlist"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </form>
  );
}

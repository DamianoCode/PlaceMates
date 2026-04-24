"use client";

import { useActionState, useOptimistic } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setCoverPhotoAction,
  type SetCoverState,
} from "@/app/(app)/places/[id]/actions";

/**
 * Star-shaped toggle overlaid on each photo tile. Filled = this is the
 * wizytówka. Tapping sets it (idempotent if already cover). We don't
 * expose an "un-cover" gesture — the cover flips when another photo is
 * promoted, which keeps the invariant of ≤ 1 cover per place trivially
 * obvious from UI.
 */
export function CoverToggle({
  photoId,
  isCover,
}: {
  photoId: string;
  isCover: boolean;
}) {
  const [state, action, pending] = useActionState<SetCoverState, FormData>(
    setCoverPhotoAction,
    null,
  );
  const [optimistic, setOptimistic] = useOptimistic(
    state && "ok" in state && state.ok ? true : isCover,
    (_prev: boolean, next: boolean) => next,
  );

  return (
    <form
      action={(fd) => {
        if (optimistic) return; // no-op when already cover
        setOptimistic(true);
        return action(fd);
      }}
      className="absolute top-1.5 right-1.5"
    >
      <input type="hidden" name="photoId" value={photoId} />
      <button
        type="submit"
        disabled={pending || optimistic}
        aria-label={optimistic ? "Zdjęcie główne" : "Ustaw jako wizytówkę"}
        title={optimistic ? "Wizytówka" : "Ustaw jako wizytówkę"}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all",
          optimistic
            ? "bg-primary text-primary-foreground shadow-md"
            : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground",
        )}
      >
        <Star
          size={14}
          strokeWidth={2}
          fill={optimistic ? "currentColor" : "none"}
        />
      </button>
    </form>
  );
}

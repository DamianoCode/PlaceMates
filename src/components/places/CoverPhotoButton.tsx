"use client";

import { useActionState, useOptimistic } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Set-cover state shape every cover-toggle server action settles to.
 * Both place and item cover actions conform; lets us share this
 * button without TypeScript generics gymnastics.
 */
export type CoverState = { error: string } | { ok: true } | null;

export type CoverAction = (
  state: CoverState,
  formData: FormData,
) => Promise<CoverState>;

/**
 * Floating star button used by `<PhotoTile>` (places) and
 * `<ItemPhotoTile>` (items) to promote a photo to the cover slot.
 * Optimistic — the star fills as soon as the user clicks, before
 * the server action settles, so the gesture feels instant.
 */
export function CoverPhotoButton({
  photoId,
  isCover,
  action,
}: {
  photoId: string;
  isCover: boolean;
  action: CoverAction;
}) {
  const [state, dispatch, pending] = useActionState<CoverState, FormData>(
    action,
    null,
  );
  const [optimistic, setOptimistic] = useOptimistic(
    state && "ok" in state && state.ok ? true : isCover,
    (_prev: boolean, next: boolean) => next,
  );

  return (
    <form
      action={(fd) => {
        if (optimistic) return;
        setOptimistic(true);
        return dispatch(fd);
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

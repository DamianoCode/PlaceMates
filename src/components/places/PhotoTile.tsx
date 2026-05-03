"use client";

import { useActionState, useOptimistic } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setCoverPhotoAction,
  deletePhotoAction,
  type SetCoverState,
} from "@/app/(app)/places/[id]/actions";
import { DeletePhotoButton } from "./DeletePhotoButton";

/**
 * Single photo tile in the place detail grid.
 *  - Star toggle promotes this photo to cover (visible to all group members).
 *  - Trash button (shared `<DeletePhotoButton>`) deletes the photo,
 *    uploader-only.
 */
export function PhotoTile({
  photoId,
  url,
  isCover,
  canDelete,
}: {
  photoId: string;
  url: string;
  isCover: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <CoverButton photoId={photoId} isCover={isCover} />
      {canDelete && (
        <DeletePhotoButton photoId={photoId} action={deletePhotoAction} />
      )}
    </div>
  );
}

function CoverButton({ photoId, isCover }: { photoId: string; isCover: boolean }) {
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
        if (optimistic) return;
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
        <Star size={14} strokeWidth={2} fill={optimistic ? "currentColor" : "none"} />
      </button>
    </form>
  );
}

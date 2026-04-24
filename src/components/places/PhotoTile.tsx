"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deletePhotoAction,
  setCoverPhotoAction,
  type DeletePhotoState,
  type SetCoverState,
} from "@/app/(app)/places/[id]/actions";

/**
 * Single photo tile in the place detail grid.
 *  - Star toggle promotes this photo to cover (visible to all group members).
 *  - Trash button deletes the photo, uploader-only.
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
      {canDelete && <DeleteButton photoId={photoId} />}
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

function DeleteButton({ photoId }: { photoId: string }) {
  const [state, action, pending] = useActionState<DeletePhotoState, FormData>(
    deletePhotoAction,
    null,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "error" in state) toast.error(state.error);
  }, [state]);

  return (
    <>
      <form ref={formRef} action={action} className="absolute bottom-1.5 right-1.5">
        <input type="hidden" name="photoId" value={photoId} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          aria-label="Usuń zdjęcie"
          title="Usuń zdjęcie"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-destructive/90 hover:text-destructive-foreground"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Usunąć zdjęcie?"
        description="Tej akcji nie można cofnąć."
        confirmLabel="Usuń"
        destructive
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}

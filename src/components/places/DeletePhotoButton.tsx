"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Delete-state shape every photo-delete server action settles to.
 * Both place and item delete actions already conform; this lets us
 * share the button without TypeScript generics gymnastics.
 */
export type PhotoDeleteState = { error: string } | { ok: true } | null;

export type PhotoDeleteAction = (
  state: PhotoDeleteState,
  formData: FormData,
) => Promise<PhotoDeleteState>;

/**
 * Floating trash button used by `<PhotoTile>` and `<ItemPhotoTile>`.
 * Wraps the form, confirm dialog, error toasting and the visual
 * affordance — the only thing the caller has to bind is the
 * server action that does the actual delete.
 */
export function DeletePhotoButton({
  photoId,
  action,
}: {
  photoId: string;
  action: PhotoDeleteAction;
}) {
  const [state, dispatch, pending] = useActionState<PhotoDeleteState, FormData>(
    action,
    null,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "error" in state) toast.error(state.error);
  }, [state]);

  return (
    <>
      <form
        ref={formRef}
        action={dispatch}
        className="absolute bottom-1.5 right-1.5"
      >
        <input type="hidden" name="photoId" value={photoId} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          aria-label="Usuń zdjęcie"
          title="Usuń zdjęcie"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background/70 text-muted-foreground backdrop-blur-sm transition-all hover:bg-destructive/90 hover:text-destructive-foreground active:scale-95"
        >
          <Trash2 size={16} strokeWidth={2} />
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

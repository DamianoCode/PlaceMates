"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deletePlaceAction,
  type DeletePlaceState,
} from "@/app/(app)/places/actions";

export function DeletePlaceButton({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const [state, action, pending] = useActionState<DeletePlaceState, FormData>(
    deletePlaceAction,
    null,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "error" in state) toast.error(state.error);
  }, [state]);

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="placeId" value={placeId} />
        <Button
          type="button"
          onClick={() => setOpen(true)}
          variant="destructive"
          disabled={pending}
          className="w-full"
        >
          <Trash2 size={16} className="mr-2" />
          {pending ? "Usuwam…" : "Usuń miejsce"}
        </Button>
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Usunąć „${placeName}”?`}
        description="Wszystkie oceny, wizyty, zdjęcia i produkty przypisane do tego miejsca zostaną trwale usunięte. Tej akcji nie można cofnąć."
        confirmLabel="Usuń miejsce"
        destructive
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}

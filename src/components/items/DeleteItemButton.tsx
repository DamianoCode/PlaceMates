"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteItemAction,
  type DeleteItemState,
} from "@/app/(app)/places/[id]/item-actions";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<DeleteItemState, FormData>(
    deleteItemAction,
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
        <input type="hidden" name="itemId" value={itemId} />
        <Button
          type="button"
          onClick={() => setOpen(true)}
          variant="destructive"
          disabled={pending}
        >
          <Trash2 size={14} className="mr-2" />
          {pending ? "Usuwam…" : "Usuń produkt"}
        </Button>
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Usunąć produkt?"
        description="Wszystkie oceny, notatki i zdjęcia tego produktu zostaną trwale usunięte."
        confirmLabel="Usuń produkt"
        destructive
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}

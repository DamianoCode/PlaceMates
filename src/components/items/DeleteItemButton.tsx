"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteItemAction,
  type DeleteItemState,
} from "@/app/(app)/places/[id]/item-actions";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<DeleteItemState, FormData>(
    deleteItemAction,
    null,
  );
  const error = state && "error" in state ? state.error : null;

  return (
    <form
      action={(fd) => {
        if (typeof window !== "undefined") {
          if (!window.confirm("Na pewno usunąć ten produkt i jego oceny?")) {
            return;
          }
        }
        return action(fd);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="itemId" value={itemId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        <Trash2 size={14} className="mr-2" />
        {pending ? "Usuwam…" : "Usuń produkt"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

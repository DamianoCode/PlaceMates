"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createItemAction,
  type CreateItemState,
} from "@/app/(app)/places/[id]/item-actions";

export function CreateItemForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState<CreateItemState, FormData>(
    createItemAction,
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");

  const error = state && "error" in state ? state.error : null;
  // Collapse on success; clear the input so the next add starts fresh.
  if (state && "ok" in state && state.ok && expanded) {
    queueMicrotask(() => {
      setValue("");
      setExpanded(false);
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Plus size={16} />
        </span>
        Dodaj produkt lub usługę
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-2xl border bg-card p-4">
      <input type="hidden" name="placeId" value={placeId} />
      <label htmlFor="item-name" className="text-sm font-medium">
        Nazwa
      </label>
      <Input
        id="item-name"
        name="name"
        autoFocus
        required
        maxLength={120}
        placeholder="np. Lody waniliowe"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Dodaję…" : "Dodaj"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setExpanded(false);
            setValue("");
          }}
        >
          Anuluj
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createGroupAction,
  type CreateGroupState,
} from "@/app/(app)/groups/actions";

/** Inline "new group" affordance — a + button that expands into a small form. */
export function CreateGroupForm() {
  const [state, action, pending] = useActionState<CreateGroupState, FormData>(
    createGroupAction,
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const error = state && "error" in state ? state.error : null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Plus size={18} />
        </span>
        Utwórz nową grupę
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-2 rounded-2xl border bg-card p-4"
    >
      <div className="space-y-1.5">
        <label htmlFor="group-name" className="text-sm font-medium">
          Nazwa grupy
        </label>
        <Input
          id="group-name"
          name="name"
          autoFocus
          required
          maxLength={80}
          placeholder="np. Wakacje 2026"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Tworzę…" : "Utwórz"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setExpanded(false)}
        >
          Anuluj
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addVisitAction } from "@/app/(app)/places/[id]/actions";

type State = { error: string } | { ok: true } | null;

export function VisitForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(addVisitAction, null);
  const error = state && "error" in state ? state.error : null;
  const saved = state && "ok" in state && state.ok;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="placeId" value={placeId} />
      <textarea
        name="note"
        rows={2}
        placeholder="Notatka z wizyty (opcjonalnie)"
        maxLength={2000}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Dodano wizytę.</p> : null}
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Dodaję…" : "Zaznacz wizytę"}
      </Button>
    </form>
  );
}

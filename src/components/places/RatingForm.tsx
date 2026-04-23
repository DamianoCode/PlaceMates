"use client";

import { useActionState, useState } from "react";
import type { RatingDimension } from "@/infra/db/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { submitRatingAction } from "@/app/(app)/places/[id]/actions";

type State = { error: string } | { ok: true } | null;

export function RatingForm({
  placeId,
  schema,
  initial,
}: {
  placeId: string;
  schema: RatingDimension[];
  initial?: { dimensions: Record<string, number>; note: string | null } | null;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    submitRatingAction,
    null,
  );

  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const d of schema) {
      v[d.key] = initial?.dimensions?.[d.key] ?? Math.ceil((d.min + d.max) / 2);
    }
    return v;
  });

  const error = state && "error" in state ? state.error : null;
  const saved = state && "ok" in state && state.ok;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="placeId" value={placeId} />

      {schema.map((dim) => (
        <div key={dim.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`dim_${dim.key}`}>{dim.label}</Label>
            <span className="tabular-nums text-sm text-muted-foreground">
              {values[dim.key]} / {dim.max}
            </span>
          </div>
          <input
            id={`dim_${dim.key}`}
            name={`dim_${dim.key}`}
            type="range"
            min={dim.min}
            max={dim.max}
            step={1}
            value={values[dim.key]}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [dim.key]: Number(e.target.value) }))
            }
            className="w-full accent-primary"
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="note">Notatka (opcjonalnie)</Label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.note ?? ""}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Zapisano ocenę.</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Zapisuję…" : initial ? "Zaktualizuj ocenę" : "Zapisz ocenę"}
      </Button>
    </form>
  );
}

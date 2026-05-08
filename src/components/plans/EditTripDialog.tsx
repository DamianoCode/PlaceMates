"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTripAction } from "@/app/(app)/plans/actions";

/**
 * Edit dialog for an existing trip — name + date. Group can't be
 * changed (would orphan stops in a group user might not even be in);
 * if you need a different group, recreate.
 */
export function EditTripDialog({
  open,
  onClose,
  tripId,
  initialName,
  initialPlannedFor,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  initialName: string;
  initialPlannedFor: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [plannedFor, setPlannedFor] = useState(
    initialPlannedFor ? toDateInput(initialPlannedFor) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset to current values whenever the dialog re-opens — prevents
  // stale local edits leaking into the next edit session. Deferred
  // to satisfy react-compiler's set-state-in-effect rule.
  useEffect(() => {
    if (!open) return;
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      setName(initialName);
      setPlannedFor(
        initialPlannedFor ? toDateInput(initialPlannedFor) : "",
      );
    });
    return () => {
      abort = true;
    };
  }, [open, initialName, initialPlannedFor]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Nazwa planu jest wymagana.");
      return;
    }
    startTransition(async () => {
      const res = await updateTripAction({
        tripId,
        name: trimmed,
        plannedFor: plannedFor || null,
      });
      if (res.ok) {
        toast.success("Zapisano.");
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edytuj plan"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="font-display text-lg">Edytuj plan</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="edit-trip-name">Nazwa</Label>
            <Input
              id="edit-trip-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-trip-date">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                Data (opcjonalnie)
              </span>
            </Label>
            <Input
              id="edit-trip-date"
              type="date"
              value={plannedFor}
              onChange={(e) => setPlannedFor(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Zapisuję…" : "Zapisz"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toDateInput(d: Date): string {
  // Local YYYY-MM-DD for <input type="date"> — toISOString would shift
  // by the timezone offset and could land us a day off.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

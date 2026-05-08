"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTripAction } from "@/app/(app)/plans/actions";

type Group = { id: string; name: string };

/**
 * Lightweight modal for creating a trip. Reused from two entry points:
 *   - /plans page "Nowy plan" button → no preselected place
 *   - /places/[id] AddToPlanButton "Nowy plan…" → seed firstPlaceId so
 *     the new trip opens with that place already as stop #1
 *
 * Group picker only renders when the user has 2+ groups. The
 * single-group path stays UI-identical to a frictionless "name +
 * date" dialog.
 */
export function CreateTripDialog({
  open,
  onClose,
  groups,
  initialGroupId,
  firstPlaceId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  /** Pre-selects this group; required when user has only one. */
  initialGroupId?: string;
  /** When set, the new trip starts with this place as stop #1. */
  firstPlaceId?: string;
  /** Called after successful create with the new trip id. */
  onCreated?: (tripId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [plannedFor, setPlannedFor] = useState("");
  const [groupId, setGroupId] = useState<string>(
    initialGroupId ?? groups[0]?.id ?? "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape, focus name on open. Defer focus with rAF so the
  // dialog is mounted in the DOM tree before we try to grab it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset form whenever the dialog re-opens — leaving stale state
  // around between "create another" cycles is confusing. Deferred to
  // satisfy react-compiler's set-state-in-effect rule.
  useEffect(() => {
    if (!open) return;
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      setName("");
      setPlannedFor("");
      setGroupId(initialGroupId ?? groups[0]?.id ?? "");
    });
    return () => {
      abort = true;
    };
  }, [open, initialGroupId, groups]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Nazwa planu jest wymagana.");
      return;
    }
    if (!groupId) {
      toast.error("Wybierz grupę.");
      return;
    }

    startTransition(async () => {
      const res = await createTripAction({
        groupId,
        name: trimmed,
        plannedFor: plannedFor || null,
        firstPlaceId,
      });
      if (res.ok) {
        toast.success("Utworzono plan.");
        onClose();
        if (onCreated) {
          onCreated(res.data.id);
        } else {
          router.push(`/plans/${res.data.id}`);
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nowy plan"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        // Click outside the inner card closes — convention from native
        // alert dialogs.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="font-display text-lg">Nowy plan</h2>
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
            <Label htmlFor="trip-name">Nazwa</Label>
            <Input
              id="trip-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
              placeholder="np. Sobota w Zamościu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-date">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                Data (opcjonalnie)
              </span>
            </Label>
            <Input
              id="trip-date"
              type="date"
              value={plannedFor}
              onChange={(e) => setPlannedFor(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Bez daty plan zostanie w „Aktualne&rdquo; do ręcznego archiwum.
            </p>
          </div>

          {groups.length >= 2 && (
            <div className="space-y-2">
              <Label htmlFor="trip-group">Grupa</Label>
              <select
                id="trip-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="field-base h-11"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {pending ? "Tworzę…" : "Stwórz plan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTripAction } from "@/app/(app)/plans/actions";

/**
 * Bottom-drawer for editing a trip's name + date. Group can't be
 * changed (would orphan stops in a group user might not even be in);
 * if you need a different group, recreate.
 *
 * Same Vaul primitive as CreateTripDialog — keeps the modal language
 * of the app consistent and sidesteps the containing-block trap of
 * `position: fixed` inside an ancestor with `transform` / `sticky`
 * (which was breaking the previous absolutely-positioned dialog
 * when launched from the PageHeader trailing slot).
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

  // Reset to current values whenever the drawer re-opens — prevents
  // stale local edits leaking into the next edit session.
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

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open]);

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
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-x bg-background outline-none pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-md"
          aria-describedby={undefined}
        >
          <Drawer.Handle className="my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />

          <div className="border-b border-border/60 px-5 pb-4">
            <Drawer.Title className="font-display text-xl leading-tight">
              Edytuj plan
            </Drawer.Title>
            <Drawer.Description className="mt-0.5 text-xs italic text-muted-foreground">
              Zmień nazwę albo datę. Stopy zostają bez zmian.
            </Drawer.Description>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
          >
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

            <div className="mt-auto flex gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={pending}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? "Zapisuję…" : "Zapisz"}
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
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

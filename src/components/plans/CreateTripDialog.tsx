"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTripAction } from "@/app/(app)/plans/actions";

type Group = { id: string; name: string };

/**
 * Bottom-drawer for creating a trip. Same Vaul primitive as the
 * "Do planu" affordance — keeps the modal language of the app
 * consistent across "create plan" / "edit plan" / "edit stop"
 * surfaces. Vaul's Portal sidesteps containing-block traps from
 * any ancestor with `transform` / `position: sticky`, so the
 * drawer always renders against the viewport.
 *
 * Two entry points:
 *   - /plans NewTripButton  (no preselected place, group selector
 *     visible when user has 2+ groups)
 *   - /places/[id] AddToPlanButton "Nowy plan…" (firstPlaceId set,
 *     group locked to the place's group)
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
  initialGroupId?: string;
  firstPlaceId?: string;
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

  // Reset on open. queueMicrotask satisfies react-compiler's
  // set-state-in-effect rule.
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

  // Focus name on open. Vaul handles its own focus trap; we just
  // pick the first interesting element.
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
              Nowy plan
            </Drawer.Title>
            <Drawer.Description className="mt-0.5 text-xs italic text-muted-foreground">
              {firstPlaceId
                ? "To miejsce stanie się stopem #1."
                : "Wycieczka, weekend, wypad — uporządkowane stopy z odhaczaniem."}
            </Drawer.Description>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
          >
            <div className="space-y-2">
              <Label htmlFor="create-trip-name">Nazwa</Label>
              <Input
                id="create-trip-name"
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required
                placeholder="np. Sobota w Zamościu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-trip-date">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  Data (opcjonalnie)
                </span>
              </Label>
              <Input
                id="create-trip-date"
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
                <Label htmlFor="create-trip-group">Grupa</Label>
                <select
                  id="create-trip-group"
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
                {pending ? "Tworzę…" : "Stwórz plan"}
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

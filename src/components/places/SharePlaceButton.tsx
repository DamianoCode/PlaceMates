"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { sharePlaceToGroupAction } from "@/app/(app)/places/[id]/share-place-actions";

type Target = { id: string; name: string };

/**
 * "Udostępnij do innej grupy" affordance on /places/[id]. Renders only
 * for users in 2+ groups where at least one group doesn't yet have
 * this canonical. Two layouts:
 *   - exactly 1 target → single-shot button "Udostępnij do {name}"
 *   - 2+ targets       → button + dropdown menu
 *
 * Pin-drops without a canonical are filtered out server-side
 * (`availableTargets` will be empty), so the component just hides.
 */
export function SharePlaceButton({
  placeId,
  targets,
}: {
  placeId: string;
  targets: Target[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside-to-close — vanilla so we don't pull in a popover lib
  // for a single dropdown. Keys: Escape closes too.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (targets.length === 0) return null;

  function share(targetId: string, targetName: string) {
    startTransition(async () => {
      const res = await sharePlaceToGroupAction(placeId, targetId);
      if (res.ok) {
        toast.success(`Udostępniono do „${targetName}".`);
        setOpen(false);
        // Server already revalidated; refresh the RSC tree so the
        // share menu, group chip and lists reflect the new state.
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Single target — skip the menu, one click does it.
  if (targets.length === 1) {
    const t = targets[0];
    return (
      <button
        type="button"
        onClick={() => share(t.id, t.name)}
        disabled={pending}
        aria-label={`Udostępnij miejsce do grupy ${t.name}`}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        <Share2 size={16} />
        {pending ? "Udostępniam…" : `Udostępnij do „${t.name}"`}
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        <Share2 size={16} />
        {pending ? "Udostępniam…" : "Udostępnij"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Do grupy
          </p>
          <ul className="pb-1">
            {targets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => share(t.id, t.name)}
                  disabled={pending}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                >
                  <span className="truncate">{t.name}</span>
                  <Check
                    size={14}
                    className="invisible text-primary"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

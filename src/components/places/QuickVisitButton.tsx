"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Footprints } from "lucide-react";
import { toast } from "sonner";
import { quickVisitAction } from "@/app/(app)/places/[id]/actions";

/**
 * Filmweb-style "watched without rating" affordance. Sits at the top
 * of the "Twoja ocena" card so the user can mark a visit independently
 * of filling in dimensions / a note.
 *
 * State machine:
 *   - never visited      → [Byłem dzisiaj]
 *   - visited today      → [✓ Byłeś dzisiaj]   (disabled, soft-confirm)
 *   - visited recently   → [Byłem dzisiaj]  +  "Ostatnia: 3 dni temu →"
 *
 * The link on the right scrolls to the Wizyty section (anchor=#wizyty)
 * so the user can edit / add a backdated visit there.
 */
export function QuickVisitButton({
  placeId,
  myLastVisitedAt,
}: {
  placeId: string;
  /** Most recent visit by *the current user* — null if they've never
   *  been. Sibling group members' visits don't drive this UI. */
  myLastVisitedAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const visitedToday = myLastVisitedAt
    ? sameLocalDate(myLastVisitedAt, new Date())
    : false;
  const daysSince =
    myLastVisitedAt && !visitedToday ? daysAgo(myLastVisitedAt) : null;

  function handleClick() {
    startTransition(async () => {
      const res = await quickVisitAction(placeId);
      if (res && "ok" in res && res.ok) {
        toast.success("Zapisano wizytę.");
        // RSC refresh so the card re-renders with new "byłeś dzisiaj"
        // state without a hard reload.
        router.refresh();
      } else if (res && "error" in res) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      <span className="text-muted-foreground">Byłeś tutaj?</span>
      {visitedToday ? (
        <span
          aria-label="Już oznaczono wizytę dzisiaj"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <Check size={14} /> Byłeś dzisiaj
        </span>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          aria-label="Oznacz wizytę dzisiaj"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          <Footprints size={14} />
          {pending ? "Zapisuję…" : "Byłem dzisiaj"}
        </button>
      )}
      {daysSince !== null && (
        <a
          href="#wizyty"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Ostatnia: {formatRelativeDays(daysSince)} →
        </a>
      )}
    </div>
  );
}

/** True when both timestamps fall on the same calendar day in the
 *  user's local timezone. UTC comparison would mis-mark a midnight
 *  visit "yesterday" depending on offset. */
function sameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Calendar-day delta (not 24-hour delta). A visit at 23:50 last
 *  night is "1 day ago" at 00:10 today, which matches user intuition. */
function daysAgo(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visited = new Date(d);
  visited.setHours(0, 0, 0, 0);
  const ms = today.getTime() - visited.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatRelativeDays(d: number): string {
  if (d === 1) return "wczoraj";
  return `${d} dni temu`;
}

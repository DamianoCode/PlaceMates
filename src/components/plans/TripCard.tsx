import Link from "next/link";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import type { TripSummary } from "@/domain/trips/service";

/**
 * One trip in the /plans list. Visual signals at a glance:
 *   - name + group attribution chip
 *   - planned date (or "bez daty")
 *   - completion progress (X/Y stopów + thin progress bar)
 *
 * All the heavy lifting (which section it lands in, sort order)
 * happens server-side; this component is purely presentational.
 */
export function TripCard({ trip }: { trip: TripSummary }) {
  const pct =
    trip.stopCount > 0
      ? Math.round((trip.completedCount / trip.stopCount) * 100)
      : 0;
  const allDone = trip.stopCount > 0 && trip.completedCount === trip.stopCount;

  return (
    <Link
      href={`/plans/${trip.id}`}
      className="group block overflow-hidden rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-lg leading-tight">
            {trip.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users size={12} />
              {trip.groupName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} />
              {trip.plannedFor ? formatDate(trip.plannedFor) : "bez daty"}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {trip.stopCount === 0
                ? "brak stopów"
                : `${trip.completedCount}/${trip.stopCount} ${plStops(trip.stopCount)}`}
            </span>
          </div>
        </div>
        {allDone && (
          <span
            aria-label="Wszystkie stopy ukończone"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            <Check size={14} />
          </span>
        )}
      </div>

      {trip.stopCount > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={
                "h-full rounded-full transition-all " +
                (allDone ? "bg-emerald-500" : "bg-primary")
              }
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
        </div>
      )}
    </Link>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pl", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function plStops(n: number): string {
  // PL pluralisation for "stop" — only the 1-form differs from "stopów".
  if (n === 1) return "stop";
  return "stopów";
}

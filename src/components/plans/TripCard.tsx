import Link from "next/link";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripSummary } from "@/domain/trips/service";

/**
 * One trip in the /plans list. Visual signals at a glance:
 *   - left accent stripe (motyw "biletu") — primary for active,
 *     emerald for fully-completed. Echoes the perforated drag-rail
 *     on TripStopRow so the trip-planning surfaces feel like one
 *     visual family.
 *   - name + meta row (group, date, count) on Fraunces display
 *   - thin progress bar at the bottom when there's something to
 *     measure
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
  const inProgress = trip.completedCount > 0 && !allDone;

  return (
    <Link
      href={`/plans/${trip.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card pl-5 pr-4 py-4 shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.99]",
        allDone && "border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/15",
      )}
    >
      {/* Accent stripe — matches the drag-rail aesthetic on
       *  TripStopRow. Primary for plans you're still working through,
       *  emerald for fully-checked-off ones. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          allDone
            ? "bg-emerald-500/70"
            : inProgress
              ? "bg-gradient-to-b from-emerald-500/70 to-primary/70"
              : "bg-primary/70",
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg leading-tight">
            {trip.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users size={12} aria-hidden />
              {trip.groupName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} aria-hidden />
              {trip.plannedFor ? formatDate(trip.plannedFor) : "bez daty"}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MapPin size={12} aria-hidden />
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
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allDone ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {pct}%
          </span>
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
  if (n === 1) return "stop";
  return "stopów";
}

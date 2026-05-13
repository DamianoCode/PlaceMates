import { notFound, redirect } from "next/navigation";
import { CalendarDays, Check, Users } from "lucide-react";
import { getAuth } from "@/infra/auth";
import {
  getTripForUser,
  listAddableStopCandidates,
} from "@/domain/trips/service";
import { isMember, getRole } from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { TripActionsBar } from "@/components/plans/TripActionsBar";
import { TripDetailView } from "@/components/plans/TripDetailView";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const trip = await getTripForUser(id, user.id);
  if (!trip) notFound();

  // Belt-and-suspenders: getTripForUser already checks membership,
  // but we re-derive role for the delete-button gate. Cheap (one
  // join) and keeps the auth surface explicit on the page.
  const [memberCheck, role, addableCandidates] = await Promise.all([
    isMember(trip.groupId, user.id),
    getRole(trip.groupId, user.id),
    // Pre-fetch the multi-select picker payload so AddStopsDrawer
    // opens with data ready — avoids a spinner the moment the user
    // taps "Dodaj stopy".
    listAddableStopCandidates(id, user.id),
  ]);
  if (!memberCheck) notFound();
  const canDelete = trip.createdBy === user.id || role === "owner";

  const completedCount = trip.stops.filter(
    (s) => s.completedAt !== null,
  ).length;
  const total = trip.stops.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const allDone = total > 0 && completedCount === total;

  return (
    <>
      <PageHeader
        title={trip.name}
        fallbackHref="/plans"
        // Action icons up top, mirroring the place-detail page's
        // FavoriteHeart / Wishlist / GroupWishlist trio. Frees the
        // body for the toggle + map without two competing button
        // rows fighting for the user's eye.
        trailing={
          <TripActionsBar
            tripId={trip.id}
            tripName={trip.name}
            tripPlannedFor={trip.plannedFor}
            stopCount={trip.stops.length}
            canDelete={canDelete}
          />
        }
      />
      <section className="mx-auto max-w-2xl space-y-3 p-4">
        {/* Compact meta band — single inline row of group / date /
         *  completion counter, separated by middle-dot characters
         *  (looks more deliberate than space + bullet markup). The
         *  "all done" check stays as a soft badge on the right. */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users size={12} aria-hidden />
                {trip.groupName}
              </span>
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} aria-hidden />
                {trip.plannedFor
                  ? formatDate(trip.plannedFor)
                  : "bez daty"}
              </span>
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
              <span className="tabular-nums">
                {completedCount}/{total} odhaczone
              </span>
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

          {trip.description && (
            <p className="text-sm italic text-muted-foreground">
              {trip.description}
            </p>
          )}

          {total > 0 && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={
                  "h-full rounded-full transition-all " +
                  (allDone ? "bg-emerald-500" : "bg-primary")
                }
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
          )}
        </div>

        <TripDetailView
          stops={trip.stops}
          tripId={trip.id}
          addableCandidates={addableCandidates}
        />
      </section>
    </>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pl", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

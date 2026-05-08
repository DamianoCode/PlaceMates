import { notFound, redirect } from "next/navigation";
import { CalendarDays, Check, Users } from "lucide-react";
import { getAuth } from "@/infra/auth";
import { getTripForUser } from "@/domain/trips/service";
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
  const memberCheck = await isMember(trip.groupId, user.id);
  if (!memberCheck) notFound();
  const role = await getRole(trip.groupId, user.id);
  const canDelete = trip.createdBy === user.id || role === "owner";

  const completedCount = trip.stops.filter(
    (s) => s.completedAt !== null,
  ).length;
  const total = trip.stops.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const allDone = total > 0 && completedCount === total;

  return (
    <>
      <PageHeader title={trip.name} fallbackHref="/plans" />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        {/* Summary band — date, group attribution, completion. The
         *  metadata is read-only here; edit lives in the actions bar. */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users size={12} />
                  {trip.groupName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={12} />
                  {trip.plannedFor
                    ? formatDate(trip.plannedFor)
                    : "bez daty"}
                </span>
                <span className="tabular-nums">
                  {completedCount}/{total} odhaczone
                </span>
              </div>
              {trip.description && (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  {trip.description}
                </p>
              )}
            </div>
            {allDone && (
              <span
                aria-label="Wszystkie stopy ukończone"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              >
                <Check size={16} />
              </span>
            )}
          </div>

          {total > 0 && (
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
          )}

          <TripActionsBar
            tripId={trip.id}
            tripName={trip.name}
            tripPlannedFor={trip.plannedFor}
            canDelete={canDelete}
          />
        </div>

        <TripDetailView stops={trip.stops} tripId={trip.id} />
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

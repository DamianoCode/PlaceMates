import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listTripsForUser } from "@/domain/trips/service";
import { listUserGroups } from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { TripCard } from "@/components/plans/TripCard";
import { NewTripButton } from "@/components/plans/NewTripButton";

/**
 * /plans — overview of every trip in the user's groups, split into
 * "Aktualne" (something still to do, deadline in the future or none)
 * and "Archiwalne" (everything done, or planned date already gone).
 */
export default async function PlansPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const [{ active, archived }, groups] = await Promise.all([
    listTripsForUser(user.id),
    listUserGroups(user.id),
  ]);

  return (
    <>
      <PageHeader title="Plany" fallbackHref="/me" />
      <section className="mx-auto max-w-2xl space-y-6 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Wycieczki, weekendy, wypady — uporządkowane miejsca z odhaczaniem.
          </p>
          <NewTripButton
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          />
        </div>

        {active.length === 0 && archived.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {groups.length === 0
                ? "Najpierw dołącz do grupy."
                : "Brak planów. Stwórz pierwszy albo dodaj miejsce do nowego planu z poziomu jego widoku."}
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <Section title="Aktualne">
                {active.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </Section>
            )}
            {archived.length > 0 && (
              <Section title="Archiwalne" muted>
                {archived.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </Section>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Section({
  title,
  muted = false,
  children,
}: {
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2
        className={
          "font-mono text-xs uppercase tracking-[0.2em] " +
          (muted ? "text-muted-foreground/70" : "text-muted-foreground")
        }
      >
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

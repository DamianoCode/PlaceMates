import { redirect } from "next/navigation";
import { Route, Sparkles } from "lucide-react";
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
 *
 * Two layouts:
 *   - empty state: hero CTA centred in the page, decorative Route
 *     icon, primary "Stwórz pierwszy plan" button. The page title
 *     in PageHeader already says "Plany" so we don't repeat the
 *     descriptor — empty surface speaks louder.
 *   - populated: compact stats strip + the new-plan CTA on the
 *     right, then sectioned card lists.
 */
export default async function PlansPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const [{ active, archived }, groups] = await Promise.all([
    listTripsForUser(user.id),
    listUserGroups(user.id),
  ]);

  const total = active.length + archived.length;
  const inProgress = active.filter(
    (t) => t.completedCount > 0 && t.completedCount < t.stopCount,
  ).length;

  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <PageHeader
        title="Plany"
        fallbackHref="/me"
        // Icon-only "+ Nowy plan" w trailing slot — usuwa drugi
        // konkurujący CTA z body i zachowuje spójność z PageHeader
        // patternem na /places/[id] (FavoriteHeart/Wishlist/etc.).
        trailing={<NewTripButton groups={groupOptions} variant="icon" />}
      />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        {total === 0 ? (
          <EmptyState
            disabled={groups.length === 0}
            groups={groupOptions}
          />
        ) : (
          <>
            {/* Stats strip — pełna szerokość, mono uppercase labels +
             *  Fraunces display numbers. CTA odjechał do nagłówka. */}
            <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <div className="flex items-baseline gap-1.5">
                <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-muted-foreground/70">
                  Razem
                </dt>
                <dd className="font-display text-base text-foreground tabular-nums">
                  {total}
                </dd>
              </div>
              {inProgress > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-muted-foreground/70">
                    W toku
                  </dt>
                  <dd className="font-display text-base text-primary tabular-nums">
                    {inProgress}
                  </dd>
                </div>
              )}
              {archived.length > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-muted-foreground/70">
                    Archiwum
                  </dt>
                  <dd className="font-display text-base text-foreground tabular-nums">
                    {archived.length}
                  </dd>
                </div>
              )}
            </dl>

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

function EmptyState({
  disabled,
  groups,
}: {
  disabled: boolean;
  groups: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="flex flex-col items-center gap-5 px-4 py-10 text-center sm:py-16">
      {/* Decorative icon — soft primary-tinted disc with route glyph
       *  and a small sparkle accent. Evokes "let's chart a course"
       *  without being childish. */}
      <div className="relative">
        <div
          aria-hidden
          className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
        >
          <Route size={40} className="text-primary" strokeWidth={1.5} />
        </div>
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          <Sparkles size={14} />
        </span>
      </div>

      <div className="space-y-1.5">
        <h2 className="font-display text-2xl leading-tight">
          {disabled ? "Najpierw dołącz do grupy" : "Brak jeszcze planów"}
        </h2>
        <p className="mx-auto max-w-sm text-sm italic leading-relaxed text-muted-foreground">
          {disabled
            ? "Plan żyje w grupie — utwórz albo dołącz do jakiejś, żeby zaplanować pierwszą wycieczkę."
            : "Zaplanuj sobotni wypad, weekendową ucieczkę albo wakacje. Możesz też dodać miejsce do nowego planu z poziomu jego widoku."}
        </p>
      </div>

      {!disabled && <NewTripButton groups={groups} />}
    </div>
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
      <div className="pm-stagger space-y-2">{children}</div>
    </div>
  );
}

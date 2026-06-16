import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/infra/auth";
import { getGroupForUser } from "@/domain/groups/service";
import {
  buildCategoryBreakdown,
  getGroupInsightCounts,
} from "@/domain/insights/service";
import { listRankedPlaces } from "@/domain/ranking/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { EditorialHeader } from "@/components/layout/EditorialHeader";
import { StaggerList } from "@/components/layout/StaggerList";
import { RankedPlaceCard } from "@/components/places/RankedPlaceCard";
import { CounterGrid } from "@/components/insights/CounterGrid";
import { CategoryBreakdown } from "@/components/insights/CategoryBreakdown";
import { EmptyState } from "@/components/layout/EmptyState";

/** How many top places the dashboard previews before linking to the full ranking. */
const TOP_PLACES_PREVIEW = 5;

export default async function GroupInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // Membership gate first — both data fetches below trust the group id.
  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  // Independent reads — fan out in parallel.
  const [counts, ranked] = await Promise.all([
    getGroupInsightCounts(id),
    listRankedPlaces({ groupId: id, limit: 100, minRatings: 1 }),
  ]);

  const breakdown = buildCategoryBreakdown(ranked);
  const topPlaces = ranked.slice(0, TOP_PLACES_PREVIEW);

  return (
    <>
      <PageHeader title="Statystyki" fallbackHref={`/groups/${id}`} />
      <section className="mx-auto max-w-2xl space-y-6 p-4">
        <EditorialHeader
          eyebrow={group.name}
          title={
            <>
              Wasze <em className="font-display italic text-primary">liczby</em>.
            </>
          }
          lede="Podsumowanie tego, co wspólnie odkryliście i oceniliście w tej grupie."
        />

        {counts.places === 0 ? (
          <EmptyState icon={BarChart3}>
            Ta grupa nie ma jeszcze żadnych miejsc. Dodajcie pierwsze, a
            statystyki pojawią się tutaj.
          </EmptyState>
        ) : (
          <>
            <CounterGrid counts={counts} />

            {breakdown.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-xl">Wg kategorii</h2>
                <CategoryBreakdown rows={breakdown} />
              </div>
            )}

            {topPlaces.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl">Najwyżej oceniane</h2>
                  <Link
                    href={`/ranking?group=${id}`}
                    className="group inline-flex items-center gap-0.5 text-xs font-medium text-primary"
                  >
                    Pełny ranking
                    <ChevronRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
                <StaggerList as="ul" className="space-y-2">
                  {topPlaces.map((place, i) => (
                    <li key={place.canonicalId}>
                      <RankedPlaceCard place={place} rank={i + 1} />
                    </li>
                  ))}
                </StaggerList>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

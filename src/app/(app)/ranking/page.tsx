import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infra/auth";
import { listRankedPlaces } from "@/domain/ranking/service";
import { listUserGroups } from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { EditorialHeader } from "@/components/layout/EditorialHeader";
import { ScrollRow } from "@/components/layout/ScrollRow";
import { StaggerList } from "@/components/layout/StaggerList";
import { RankedPlaceCard } from "@/components/places/RankedPlaceCard";

type Search = Promise<{ category?: string; group?: string }>;

// Slugs exposed as filter pills. Stays aligned with scripts/seed-categories.ts
// and the CATEGORY_TO_OSM map in overpass.ts.
const FILTERS: { slug: string; label: string }[] = [
  { slug: "restaurant", label: "Restauracje" },
  { slug: "cafe", label: "Kawiarnie" },
  { slug: "ice-cream", label: "Lodziarnie" },
  { slug: "bakery", label: "Piekarnie" },
  { slug: "viewpoint", label: "Widoki" },
  { slug: "attraction", label: "Atrakcje" },
  { slug: "park", label: "Parki" },
  { slug: "beach", label: "Plaże" },
  { slug: "bar", label: "Bary" },
  { slug: "accommodation", label: "Noclegi" },
];

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { category, group } = await searchParams;
  const activeCategory = category && FILTERS.some((f) => f.slug === category)
    ? category
    : null;

  // Group scope: only honour `?group=<id>` when the user is actually in
  // that group — otherwise we'd render an empty list (membership check
  // also keeps the cache key from leaking foreign group ids).
  const userGroups = await listUserGroups(user.id);
  const activeGroup =
    group && userGroups.some((g) => g.id === group) ? group : null;
  const activeGroupName = activeGroup
    ? userGroups.find((g) => g.id === activeGroup)?.name ?? null
    : null;

  const ranked = await listRankedPlaces({
    categorySlug: activeCategory,
    groupId: activeGroup,
    limit: 100,
    // default 1 — matches small private groups where every rating counts.
    minRatings: 1,
  });

  function buildHref(opts: { category?: string | null; group?: string | null }) {
    const params = new URLSearchParams();
    const nextCategory = opts.category === undefined ? activeCategory : opts.category;
    const nextGroup = opts.group === undefined ? activeGroup : opts.group;
    if (nextCategory) params.set("category", nextCategory);
    if (nextGroup) params.set("group", nextGroup);
    const qs = params.toString();
    return qs ? `/ranking?${qs}` : "/ranking";
  }

  return (
    <>
      <PageHeader title="Ranking" fallbackHref="/me" />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        <EditorialHeader
          eyebrow={
            activeGroupName
              ? `Ranking grupy „${activeGroupName}”`
              : "Agregat wszystkich ocen"
          }
          title={
            activeGroupName ? (
              <>
                Co <em className="font-display italic text-primary">my</em>{" "}
                ocenialiśmy najlepiej.
              </>
            ) : (
              <>
                Ranking <em className="font-display italic text-primary">wspólnego</em>{" "}
                atlasu.
              </>
            )
          }
          lede={
            activeGroupName
              ? "Tylko miejsca dodane przez tę grupę i tylko oceny jej członków. Idealne do porównania waszych własnych odkryć."
              : "Każda ocena — twoja, twoich bliskich, i wszystkich innych użytkowników PlaceMates — wlicza się anonimowo. Nazwiska i grupy nie są tu widoczne."
          }
        />

        {userGroups.length > 0 && (
          <ScrollRow
            aria-label="Zakres rankingu"
            className="flex gap-1.5 overflow-x-auto no-scrollbar"
          >
            <Pill href={buildHref({ group: null })} active={!activeGroup}>
              Wszyscy
            </Pill>
            {userGroups.map((g) => (
              <Pill
                key={g.id}
                href={buildHref({ group: g.id })}
                active={activeGroup === g.id}
              >
                {g.name}
              </Pill>
            ))}
          </ScrollRow>
        )}

        <ScrollRow
          aria-label="Filtry kategorii"
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
        >
          <Pill href={buildHref({ category: null })} active={!activeCategory}>
            Wszystkie
          </Pill>
          {FILTERS.map((f) => (
            <Pill
              key={f.slug}
              href={buildHref({ category: f.slug })}
              active={activeCategory === f.slug}
            >
              {f.label}
            </Pill>
          ))}
        </ScrollRow>

        {ranked.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm italic text-muted-foreground">
            {activeGroup
              ? activeCategory
                ? "Wasza grupa nie ma jeszcze ocen w tej kategorii."
                : "Wasza grupa nie ma jeszcze ocenionych miejsc."
              : activeCategory
                ? "Nikt jeszcze nie ocenił miejsca w tej kategorii."
                : "Ranking czeka na pierwsze oceny."}
          </p>
        ) : (
          <StaggerList as="ul" className="space-y-2">
            {ranked.map((place, i) => (
              <li key={place.canonicalId}>
                <RankedPlaceCard place={place} rank={i + 1} />
              </li>
            ))}
          </StaggerList>
        )}
      </section>
    </>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const base =
    "relative inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition duration-150 before:absolute before:-inset-y-1 before:content-[''] active:scale-95";
  return (
    <Link
      href={href}
      className={
        active
          ? `${base} bg-primary text-primary-foreground shadow-sm shadow-primary/30`
          : `${base} border border-border text-muted-foreground hover:bg-muted hover:text-foreground`
      }
    >
      {children}
    </Link>
  );
}

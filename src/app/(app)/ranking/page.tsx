import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listRankedPlaces } from "@/domain/ranking/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { EditorialHeader } from "@/components/layout/EditorialHeader";
import { RankedPlaceCard } from "@/components/places/RankedPlaceCard";

type Search = Promise<{ category?: string }>;

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
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const activeCategory = category && FILTERS.some((f) => f.slug === category)
    ? category
    : null;

  const ranked = await listRankedPlaces({
    categorySlug: activeCategory,
    limit: 100,
    // default 1 — matches small private groups where every rating counts.
    minRatings: 1,
  });

  return (
    <>
      <PageHeader title="Ranking" fallbackHref="/me" />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        <EditorialHeader
          eyebrow="Agregat wszystkich ocen"
          title={
            <>
              Ranking <em className="font-display italic text-primary">wspólnego</em>{" "}
              atlasu.
            </>
          }
          lede="Każda ocena — twoja, twoich bliskich, i wszystkich innych użytkowników PlaceMates — wlicza się anonimowo. Nazwiska i grupy nie są tu widoczne."
        />

        <nav
          aria-label="Filtry kategorii"
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
        >
          <Pill href="/ranking" active={!activeCategory}>
            Wszystkie
          </Pill>
          {FILTERS.map((f) => (
            <Pill
              key={f.slug}
              href={`/ranking?category=${f.slug}`}
              active={activeCategory === f.slug}
            >
              {f.label}
            </Pill>
          ))}
        </nav>

        {ranked.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm italic text-muted-foreground">
            {activeCategory
              ? "Nikt jeszcze nie ocenił miejsca w tej kategorii."
              : "Ranking czeka na pierwsze oceny."}
          </p>
        ) : (
          <ul className="space-y-2">
            {ranked.map((place, i) => (
              <li key={place.canonicalId}>
                <RankedPlaceCard place={place} rank={i + 1} />
              </li>
            ))}
          </ul>
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
    "inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors";
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

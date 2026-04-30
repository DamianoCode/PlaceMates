import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  Bookmark,
  Clock,
  Heart,
  Star,
} from "lucide-react";
import { getAuth } from "@/infra/auth";
import {
  listPlacesWithStats,
  type PlacesSetFilter,
  type PlacesSortBy,
  type PlacesSortDir,
} from "@/domain/places/list-with-stats";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { listUserGroups } from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlacesVirtualList } from "@/components/places/PlacesVirtualList";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { cn } from "@/lib/utils";

type Search = {
  q?: string;
  set?: string;
  category?: string;
  sort?: string;
  dir?: string;
};

const SORT_OPTIONS: {
  value: PlacesSortBy;
  label: string;
  icon: typeof Clock;
}[] = [
  { value: "recent", label: "Ostatnio dodane", icon: Clock },
  { value: "name", label: "Nazwa", icon: ArrowDownAZ },
  { value: "rating", label: "Ocena", icon: Star },
];

function parseSort(raw: string | undefined): PlacesSortBy {
  return raw === "name" || raw === "rating" ? raw : "recent";
}
function parseDir(raw: string | undefined): PlacesSortDir {
  return raw === "asc" ? "asc" : "desc";
}
function parseSet(raw: string | undefined): PlacesSetFilter | null {
  return raw === "wishlist" || raw === "favorites" ? raw : null;
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { q, set, category, sort, dir } = await searchParams;
  const sortBy = parseSort(sort);
  const sortDir = parseDir(dir);
  const setFilter = parseSet(set);

  // Categories for the filter pills come from the user's primary group
  // — same source the map and the new-place form already use. A user
  // with zero groups gets an empty pill row and an empty list.
  const groups = await listUserGroups(user.id);
  const primaryGroupId = groups[0]?.id ?? null;
  const cats = primaryGroupId
    ? await listCategoriesForGroup(primaryGroupId)
    : [];

  const activeCategory =
    category && cats.some((c) => c.id === category) ? category : null;

  const cards = await listPlacesWithStats(user.id, {
    query: q,
    categoryId: activeCategory ?? undefined,
    setFilter: setFilter ?? undefined,
    sortBy,
    sortDir,
  });

  function buildHref(opts: {
    set?: PlacesSetFilter | null;
    category?: string | null;
    sort?: PlacesSortBy;
    dir?: PlacesSortDir;
  }) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const nextSet = opts.set === undefined ? setFilter : opts.set;
    const nextCategory =
      opts.category === undefined ? activeCategory : opts.category;
    const nextSort = opts.sort ?? sortBy;
    const nextDir = opts.dir ?? sortDir;
    if (nextSet) params.set("set", nextSet);
    if (nextCategory) params.set("category", nextCategory);
    if (nextSort !== "recent") params.set("sort", nextSort);
    if (nextDir !== "desc") params.set("dir", nextDir);
    const qs = params.toString();
    return qs ? `/places?${qs}` : "/places";
  }

  const activeSortMeta = SORT_OPTIONS.find((s) => s.value === sortBy)!;
  const nextSortBy: PlacesSortBy =
    sortBy === "recent" ? "name" : sortBy === "name" ? "rating" : "recent";

  return (
    <>
      <PageHeader title="Miejsca" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        <PlaceSearchInput />

        {/* Saved-set filter row. Each pill is a toggle: clicking the
         *  active one clears it (so "Wszystkie" isn't strictly needed
         *  but stays visible as a no-op default for clarity). Combines
         *  with the category filter — favourites + restaurant works. */}
        <nav
          aria-label="Filtr zapisanych"
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
        >
          <Pill href={buildHref({ set: null })} active={!setFilter}>
            Wszystkie
          </Pill>
          <Pill
            href={buildHref({
              set: setFilter === "wishlist" ? null : "wishlist",
            })}
            active={setFilter === "wishlist"}
            icon={<Bookmark size={12} />}
          >
            Do odwiedzenia
          </Pill>
          <Pill
            href={buildHref({
              set: setFilter === "favorites" ? null : "favorites",
            })}
            active={setFilter === "favorites"}
            icon={<Heart size={12} />}
          >
            Ulubione
          </Pill>
        </nav>

        {cats.length > 0 && (
          <nav
            aria-label="Filtry kategorii"
            className="flex gap-1.5 overflow-x-auto no-scrollbar"
          >
            <Pill href={buildHref({ category: null })} active={!activeCategory}>
              Wszystkie
            </Pill>
            {cats.map((c) => (
              <Pill
                key={c.id}
                href={buildHref({ category: c.id })}
                active={activeCategory === c.id}
              >
                {c.name}
              </Pill>
            ))}
          </nav>
        )}

        {cards.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {cards.length} {cards.length === 1 ? "miejsce" : "miejsc"}
            </span>
            <div className="inline-flex items-center gap-1">
              <Link
                href={buildHref({ sort: nextSortBy })}
                aria-label="Zmień kryterium sortowania"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <activeSortMeta.icon size={14} />
                {activeSortMeta.label}
              </Link>
              <Link
                href={buildHref({ dir: sortDir === "asc" ? "desc" : "asc" })}
                aria-label={
                  sortDir === "asc" ? "Sortuj malejąco" : "Sortuj rosnąco"
                }
                title={dirTitle(sortBy, sortDir)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {sortDir === "asc" ? (
                  <ArrowUp size={14} />
                ) : (
                  <ArrowDown size={14} />
                )}
              </Link>
            </div>
          </div>
        )}

        {cards.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {q
              ? `Brak wyników dla „${q}".`
              : setFilter === "wishlist"
                ? "Nic do odwiedzenia. Zaznacz miejsce zakładką w nagłówku jego widoku."
                : setFilter === "favorites"
                  ? "Brak ulubionych. Zaznacz miejsce serduszkiem w nagłówku jego widoku."
                  : activeCategory
                    ? "Brak miejsc w tej kategorii."
                    : "Brak miejsc. Dodaj pierwsze z poziomu mapy."}
          </p>
        ) : (
          <PlacesVirtualList cards={cards} />
        )}
      </section>
    </>
  );
}

function dirTitle(sortBy: PlacesSortBy, dir: PlacesSortDir): string {
  if (sortBy === "name") return dir === "asc" ? "A → Z" : "Z → A";
  if (sortBy === "rating")
    return dir === "asc" ? "Od najniższych ocen" : "Od najwyższych ocen";
  return dir === "asc" ? "Od najstarszych" : "Od najnowszych";
}

function Pill({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors";
  return (
    <Link
      href={href}
      className={cn(
        base,
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

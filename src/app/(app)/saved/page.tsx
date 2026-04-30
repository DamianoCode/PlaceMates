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
  type PlacesSortBy,
  type PlacesSortDir,
} from "@/domain/places/list-with-stats";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { listUserGroups } from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlacesVirtualList } from "@/components/places/PlacesVirtualList";
import { cn } from "@/lib/utils";

type Tab = "wishlist" | "favorites";
type Search = {
  tab?: string;
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

function parseTab(raw: string | undefined): Tab {
  return raw === "favorites" ? "favorites" : "wishlist";
}
function parseSort(raw: string | undefined): PlacesSortBy {
  return raw === "name" || raw === "rating" ? raw : "recent";
}
function parseDir(raw: string | undefined): PlacesSortDir {
  return raw === "asc" ? "asc" : "desc";
}

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { tab: tabRaw, category, sort, dir } = await searchParams;
  const tab = parseTab(tabRaw);
  const sortBy = parseSort(sort);
  const sortDir = parseDir(dir);

  const groups = await listUserGroups(user.id);
  const primaryGroupId = groups[0]?.id ?? null;
  const cats = primaryGroupId
    ? await listCategoriesForGroup(primaryGroupId)
    : [];
  const activeCategory =
    category && cats.some((c) => c.id === category) ? category : null;

  // Fetch the full list once (sorted + filtered by category) and split
  // by the saved-flag the active tab targets. listPlacesWithStats
  // already returns isWishlisted / isFavorite per card.
  const all = await listPlacesWithStats(user.id, {
    categoryId: activeCategory ?? undefined,
    sortBy,
    sortDir,
  });
  const cards = all.filter((c) =>
    tab === "favorites" ? c.isFavorite : c.isWishlisted,
  );

  function buildHref(opts: {
    tab?: Tab;
    category?: string | null;
    sort?: PlacesSortBy;
    dir?: PlacesSortDir;
  }) {
    const params = new URLSearchParams();
    const nextTab = opts.tab ?? tab;
    const nextCategory =
      opts.category === undefined ? activeCategory : opts.category;
    const nextSort = opts.sort ?? sortBy;
    const nextDir = opts.dir ?? sortDir;
    if (nextTab !== "wishlist") params.set("tab", nextTab);
    if (nextCategory) params.set("category", nextCategory);
    if (nextSort !== "recent") params.set("sort", nextSort);
    if (nextDir !== "desc") params.set("dir", nextDir);
    const qs = params.toString();
    return qs ? `/saved?${qs}` : "/saved";
  }

  const activeSortMeta = SORT_OPTIONS.find((s) => s.value === sortBy)!;
  const nextSortBy: PlacesSortBy =
    sortBy === "recent" ? "name" : sortBy === "name" ? "rating" : "recent";

  return (
    <>
      <PageHeader title="Zapisane" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        {/* Tab switcher: do-odwiedzenia ↔ ulubione. Mirrors the
         *  PlaceCard icons (Bookmark / Heart) so the visual mapping
         *  stays self-consistent across the app. */}
        <nav
          aria-label="Zakładki"
          className="grid grid-cols-2 gap-2 rounded-full border border-border bg-muted/30 p-1"
        >
          <TabLink
            href={buildHref({ tab: "wishlist" })}
            active={tab === "wishlist"}
            icon={<Bookmark size={14} />}
          >
            Do odwiedzenia
          </TabLink>
          <TabLink
            href={buildHref({ tab: "favorites" })}
            active={tab === "favorites"}
            icon={<Heart size={14} />}
          >
            Ulubione
          </TabLink>
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
            {tab === "favorites" ? (
              <>
                Nic tu jeszcze nie ma. Zaznacz miejsce serduszkiem w nagłówku
                jego widoku.
              </>
            ) : (
              <>
                Nic tu jeszcze nie ma. Zaznacz miejsce zakładką „Do odwiedzenia”
                w nagłówku jego widoku.
              </>
            )}
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

function TabLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
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
      className={cn(
        base,
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

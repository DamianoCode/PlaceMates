import { redirect } from "next/navigation";
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
import { PlacesListShell } from "@/components/places/PlacesListShell";
import { PlacesVirtualList } from "@/components/places/PlacesVirtualList";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";

type Search = {
  q?: string;
  set?: string;
  category?: string;
  /** Only honoured when `set=group-wishlist`. Ignored otherwise. */
  group?: string;
  sort?: string;
  dir?: string;
};

function parseSort(raw: string | undefined): PlacesSortBy {
  return raw === "name" || raw === "rating" ? raw : "recent";
}
function parseDir(raw: string | undefined): PlacesSortDir {
  return raw === "asc" ? "asc" : "desc";
}
function parseSet(raw: string | undefined): PlacesSetFilter | null {
  return raw === "wishlist" ||
    raw === "favorites" ||
    raw === "group-wishlist"
    ? raw
    : null;
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { q, set, category, group, sort, dir } = await searchParams;
  const sortBy = parseSort(sort);
  const sortDir = parseDir(dir);
  const setFilter = parseSet(set);

  const groups = await listUserGroups(user.id);
  const primaryGroupId = groups[0]?.id ?? null;
  const cats = primaryGroupId
    ? await listCategoriesForGroup(primaryGroupId)
    : [];

  const activeCategory =
    category && cats.some((c) => c.id === category) ? category : null;

  // `group` is only meaningful inside the group-wishlist set, and only
  // when the user actually belongs to that group (defensive — protects
  // against a stale URL or a copy/paste from someone else's session).
  const activeGroupWishlistGroupId =
    setFilter === "group-wishlist" &&
    group &&
    groups.some((g) => g.id === group)
      ? group
      : null;

  const cards = await listPlacesWithStats(user.id, {
    query: q,
    categoryId: activeCategory ?? undefined,
    setFilter: setFilter ?? undefined,
    groupWishlistGroupId: activeGroupWishlistGroupId ?? undefined,
    sortBy,
    sortDir,
  });

  const activeGroupName = activeGroupWishlistGroupId
    ? (groups.find((g) => g.id === activeGroupWishlistGroupId)?.name ?? "")
    : null;

  const list =
    cards.length === 0 ? (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {q
          ? `Brak wyników dla „${q}".`
          : setFilter === "wishlist"
            ? "Nic do odwiedzenia. Zaznacz miejsce zakładką w nagłówku jego widoku."
            : setFilter === "favorites"
              ? "Brak ulubionych. Zaznacz miejsce serduszkiem w nagłówku jego widoku."
              : setFilter === "group-wishlist"
                ? activeGroupName
                  ? `Grupa „${activeGroupName}" nie ma jeszcze nic na wspólnej liście.`
                  : "Wasza grupa nie ma jeszcze nic na wspólnej liście do odwiedzenia."
                : activeCategory
                  ? "Brak miejsc w tej kategorii."
                  : "Brak miejsc. Dodaj pierwsze z poziomu mapy."}
      </p>
    ) : (
      <PlacesVirtualList cards={cards} />
    );

  return (
    <>
      <PageHeader title="Miejsca" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        <PlaceSearchInput />
        <PlacesListShell
          state={{
            q: q ?? "",
            set: setFilter,
            category: activeCategory,
            groupWishlistGroupId: activeGroupWishlistGroupId,
            sortBy,
            sortDir,
          }}
          count={cards.length}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          groupWishlistGroups={groups.map((g) => ({ id: g.id, name: g.name }))}
        >
          {list}
        </PlacesListShell>
      </section>
    </>
  );
}

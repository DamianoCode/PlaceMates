import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import {
  filterStateToOptions,
  parsePlacesSearch,
  type PlacesFilterState,
  type RawPlacesSearch,
} from "@/lib/places/list-params";
import { listPlacesWithStats } from "@/domain/places/list-with-stats";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { listUserGroups } from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlacesBrowser } from "@/components/places/PlacesBrowser";

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<RawPlacesSearch>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const raw = await searchParams;
  const parsed = parsePlacesSearch(raw);

  const groups = await listUserGroups(user.id);
  const primaryGroupId = groups[0]?.id ?? null;
  const cats = primaryGroupId
    ? await listCategoriesForGroup(primaryGroupId)
    : [];

  // Narrow the category/group ids defensively — a stale URL or a
  // pasted link from another session must not resolve to ids the user
  // can't actually see. The validated values become the canonical
  // initial state shared with the client browser.
  const initialState: PlacesFilterState = {
    ...parsed,
    category:
      parsed.category && cats.some((c) => c.id === parsed.category)
        ? parsed.category
        : null,
    groupWishlistGroupId:
      parsed.set === "group-wishlist" &&
      parsed.groupWishlistGroupId &&
      groups.some((g) => g.id === parsed.groupWishlistGroupId)
        ? parsed.groupWishlistGroupId
        : null,
  };

  const initialCards = await listPlacesWithStats(
    user.id,
    filterStateToOptions(initialState),
  );

  return (
    <>
      <PageHeader title="Miejsca" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        <PlacesBrowser
          initialState={initialState}
          initialCards={initialCards}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          groupWishlistGroups={groups.map((g) => ({ id: g.id, name: g.name }))}
        />
      </section>
    </>
  );
}

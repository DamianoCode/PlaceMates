import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { listPlacesForUser } from "@/domain/places/service";
import { wishlistedIds } from "@/domain/wishlist/service";
import { favoriteIds } from "@/domain/favorites/service";
import { MapScreen } from "@/components/map/MapScreen";

type Search = Promise<{
  lat?: string;
  lng?: string;
  zoom?: string;
  place?: string;
}>;

function parseFloatInRange(raw: string | undefined, range: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > range) return null;
  return n;
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const groups = await listUserGroups(user.id);
  const primaryGroupId = groups[0]?.id ?? null;
  const [cats, places, wishIds, favIds] = await Promise.all([
    primaryGroupId ? listCategoriesForGroup(primaryGroupId) : Promise.resolve([]),
    listPlacesForUser(user.id),
    wishlistedIds(user.id),
    favoriteIds(user.id),
  ]);

  // Optional ?lat=&lng=&zoom=&place= deeplink lets /places/[id]
  // hand the user back to the map centred on a specific place. Safety
  // gate: a place id is only honoured when it actually appears in this
  // user's accessible places — otherwise we'd auto-open a preview for
  // a place they can't see (which would 404 the API anyway).
  const { lat: latRaw, lng: lngRaw, zoom: zoomRaw, place: placeRaw } =
    await searchParams;
  const lat = parseFloatInRange(latRaw, 90);
  const lng = parseFloatInRange(lngRaw, 180);
  const zoom = (() => {
    if (!zoomRaw) return null;
    const z = Number(zoomRaw);
    if (!Number.isFinite(z) || z < 1 || z > 22) return null;
    return z;
  })();
  const placeId =
    placeRaw && places.some((p) => p.id === placeRaw) ? placeRaw : null;
  const focus =
    lat !== null && lng !== null
      ? { lat, lng, zoom: zoom ?? 17, placeId }
      : null;

  return (
    <MapScreen
      primaryGroupId={primaryGroupId}
      categories={cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
      places={places}
      wishlistedIds={Array.from(wishIds)}
      favoriteIds={Array.from(favIds)}
      focus={focus}
    />
  );
}

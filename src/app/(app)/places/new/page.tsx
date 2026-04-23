import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { NewPlaceForm } from "@/components/places/NewPlaceForm";
import { PageHeader } from "@/components/layout/PageHeader";

type Search = Promise<{ lat?: string; lng?: string }>;

function parseLatLng(raw?: string, range = 90): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > range) return null;
  return n;
}

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const groups = await listUserGroups(user.id);
  if (groups.length === 0) {
    return (
      <>
        <PageHeader title="Dodaj miejsce" fallbackHref="/map" />
        <section className="p-4">
          <p>Brak grupy. Skontaktuj się z adminem.</p>
        </section>
      </>
    );
  }
  const cats = await listCategoriesForGroup(groups[0].id);

  const { lat: latRaw, lng: lngRaw } = await searchParams;
  const lat = parseLatLng(latRaw, 90);
  const lng = parseLatLng(lngRaw, 180);
  const initialPick = lat !== null && lng !== null ? { lat, lng } : undefined;

  return (
    <>
      <PageHeader title="Dodaj miejsce" fallbackHref="/map" />
      <section className="p-4 space-y-4">
        <NewPlaceForm
          categories={cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          initialPick={initialPick}
        />
      </section>
    </>
  );
}

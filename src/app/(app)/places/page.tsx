import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listPlacesWithStats } from "@/domain/places/list-with-stats";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlaceCard } from "@/components/places/PlaceCard";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const cards = await listPlacesWithStats(user.id, q);

  return (
    <>
      <PageHeader title="Miejsca" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        <PlaceSearchInput />

        {cards.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {q
              ? `Brak wyników dla „${q}”.`
              : "Brak miejsc. Dodaj pierwsze z poziomu mapy."}
          </p>
        ) : (
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id}>
                <PlaceCard place={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

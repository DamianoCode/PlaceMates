import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listPlacesWithStats } from "@/domain/places/list-with-stats";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlaceCard } from "@/components/places/PlaceCard";

export default async function FavoritesPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const cards = (await listPlacesWithStats(user.id)).filter((c) => c.isFavorite);

  return (
    <>
      <PageHeader title="Ulubione" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        {cards.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nic tu jeszcze nie ma. Zaznacz miejsce serduszkiem w nagłówku
            jego widoku.
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

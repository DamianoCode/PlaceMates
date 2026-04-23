import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { getPlaceForUser } from "@/domain/places/service";
import { getCategory } from "@/domain/categories/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const place = await getPlaceForUser(id, user.id);
  if (!place) notFound();
  const category = await getCategory(place.categoryId);

  return (
    <section className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{place.name}</h1>
        {category && (
          <p className="text-sm text-muted-foreground">{category.name}</p>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lokalizacja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {place.address && <p>{place.address}</p>}
          <p className="text-muted-foreground">
            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Oceny i zdjęcia dojdą w Sprincie 2.
      </p>
    </section>
  );
}

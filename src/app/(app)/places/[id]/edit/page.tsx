import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/infra/auth";
import { canUserEditPlace, getPlaceForUser } from "@/domain/places/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EditPlaceForm } from "@/components/places/EditPlaceForm";
import { DeletePlaceButton } from "@/components/places/DeletePlaceButton";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  // Both checks query membership independently — run them together.
  const [place, allowed] = await Promise.all([
    getPlaceForUser(id, user.id),
    canUserEditPlace(id, user.id),
  ]);
  if (!place) notFound();
  // Guard server-side — never render the edit form for unauthorized users
  // even if they typed the URL directly.
  if (!allowed) redirect(`/places/${id}`);

  const cats = await listCategoriesForGroup(place.groupId);

  return (
    <>
      <PageHeader
        title="Edytuj miejsce"
        subtitle={place.name}
        fallbackHref={`/places/${id}`}
      />
      <section className="mx-auto max-w-2xl space-y-6 p-4">
        <EditPlaceForm
          placeId={place.id}
          initialName={place.name}
          initialCategoryId={place.categoryId}
          initialLat={place.lat}
          initialLng={place.lng}
          initialAddress={place.address}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        />

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="font-display text-xl text-destructive">
              Strefa niebezpieczna
            </CardTitle>
            <CardDescription>
              Usunięcie miejsca jest nieodwracalne — przepadają też oceny,
              wizyty, zdjęcia i produkty członków grupy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeletePlaceButton placeId={place.id} placeName={place.name} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

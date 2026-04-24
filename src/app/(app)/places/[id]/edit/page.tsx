import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { canUserEditPlace, getPlaceForUser } from "@/domain/places/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { EditPlaceForm } from "@/components/places/EditPlaceForm";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const place = await getPlaceForUser(id, user.id);
  if (!place) notFound();

  // Guard server-side — never render the edit form for unauthorized users
  // even if they typed the URL directly.
  const allowed = await canUserEditPlace(id, user.id);
  if (!allowed) redirect(`/places/${id}`);

  const cats = await listCategoriesForGroup(place.groupId);

  return (
    <>
      <PageHeader
        title="Edytuj miejsce"
        subtitle={place.name}
        fallbackHref={`/places/${id}`}
      />
      <section className="mx-auto max-w-2xl p-4">
        <EditPlaceForm
          placeId={place.id}
          initialName={place.name}
          initialCategoryId={place.categoryId}
          initialLat={place.lat}
          initialLng={place.lng}
          initialAddress={place.address}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>
    </>
  );
}

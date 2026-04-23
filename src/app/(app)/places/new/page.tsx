import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { NewPlaceForm } from "@/components/places/NewPlaceForm";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function NewPlacePage() {
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

  return (
    <>
      <PageHeader title="Dodaj miejsce" fallbackHref="/map" />
      <section className="p-4 space-y-4">
        <NewPlaceForm
          categories={cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        />
      </section>
    </>
  );
}

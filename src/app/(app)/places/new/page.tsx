import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { NewPlaceForm } from "@/components/places/NewPlaceForm";

export default async function NewPlacePage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const groups = await listUserGroups(user.id);
  if (groups.length === 0) {
    // User hasn't been bootstrapped with a group — shouldn't happen past
    // the registration flow, but handle it defensively.
    return (
      <section className="p-4">
        <p>Brak grupy. Skontaktuj się z adminem.</p>
      </section>
    );
  }
  const cats = await listCategoriesForGroup(groups[0].id);

  return (
    <section className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dodaj miejsce</h1>
      <NewPlaceForm
        categories={cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </section>
  );
}

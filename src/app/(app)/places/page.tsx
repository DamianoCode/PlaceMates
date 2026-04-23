import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listPlacesForUser } from "@/domain/places/service";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";

export default async function PlacesPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const [places, groups] = await Promise.all([
    listPlacesForUser(user.id),
    listUserGroups(user.id),
  ]);

  const cats = groups.length > 0 ? await listCategoriesForGroup(groups[0].id) : [];
  const catById = new Map(cats.map((c) => [c.id, c]));

  return (
    <section className="p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Miejsca</h1>
      {places.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Brak miejsc. Dodaj pierwsze z poziomu mapy.
        </p>
      ) : (
        <ul className="space-y-2">
          {places.map((p) => {
            const cat = catById.get(p.categoryId);
            return (
              <li key={p.id}>
                <Link
                  href={`/places/${p.id}`}
                  className="flex items-baseline justify-between rounded-md border p-3 hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="font-medium">{p.name}</span>
                  {cat && <span className="text-xs text-muted-foreground">{cat.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

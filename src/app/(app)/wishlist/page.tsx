import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { listWishlistForUser } from "@/domain/wishlist/service";

export default async function WishlistPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const [items, groups] = await Promise.all([
    listWishlistForUser(user.id),
    listUserGroups(user.id),
  ]);
  const cats = groups.length > 0 ? await listCategoriesForGroup(groups[0].id) : [];
  const catById = new Map(cats.map((c) => [c.id, c]));

  return (
    <section className="p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Wishlist</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nic tu jeszcze nie ma. Wejdź w dowolne miejsce i kliknij „Dodaj do wishlist”.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const cat = catById.get(it.categoryId);
            return (
              <li key={it.placeId}>
                <Link
                  href={`/places/${it.placeId}`}
                  className="flex items-baseline justify-between rounded-md border p-3 hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="font-medium">{it.name}</span>
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

import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { listCategoriesForGroup } from "@/domain/categories/service";
import { wishlistedIds } from "@/domain/wishlist/service";
import { favoriteIds } from "@/domain/favorites/service";
import { MapScreen } from "@/components/map/MapScreen";

export default async function MapPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const groups = await listUserGroups(user.id);
  const cats = groups.length > 0 ? await listCategoriesForGroup(groups[0].id) : [];
  const [wishIds, favIds] = await Promise.all([
    wishlistedIds(user.id),
    favoriteIds(user.id),
  ]);

  return (
    <MapScreen
      categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      wishlistedIds={Array.from(wishIds)}
      favoriteIds={Array.from(favIds)}
    />
  );
}

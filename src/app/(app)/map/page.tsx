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
  const primaryGroupId = groups[0]?.id ?? null;
  const cats = primaryGroupId ? await listCategoriesForGroup(primaryGroupId) : [];
  const [wishIds, favIds] = await Promise.all([
    wishlistedIds(user.id),
    favoriteIds(user.id),
  ]);

  return (
    <MapScreen
      primaryGroupId={primaryGroupId}
      categories={cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
      wishlistedIds={Array.from(wishIds)}
      favoriteIds={Array.from(favIds)}
    />
  );
}

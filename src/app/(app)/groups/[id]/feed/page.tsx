import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/infra/auth";
import { getGroupForUser } from "@/domain/groups/service";
import { listActivityForGroup } from "@/domain/activity/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { EditorialHeader } from "@/components/layout/EditorialHeader";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default async function GroupFeedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // Membership gate — the feed query trusts the group id.
  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  const first = await listActivityForGroup(id);

  return (
    <>
      <PageHeader title="Aktywność" fallbackHref={`/groups/${id}`} />
      <section className="mx-auto max-w-2xl space-y-6 p-4">
        <EditorialHeader
          eyebrow={group.name}
          title={
            <>
              Co się <em className="font-display italic text-primary">dzieje</em>.
            </>
          }
          lede="Najnowsze ruchy w grupie — nowe miejsca, oceny, zdjęcia i plany."
        />

        {first.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm italic text-muted-foreground">
            Jeszcze nic się nie wydarzyło. Dodajcie miejsce albo wystawcie
            ocenę — pojawi się tutaj.
          </p>
        ) : (
          <ActivityFeed
            groupId={id}
            initialItems={first.items}
            initialCursor={first.nextCursor}
          />
        )}
      </section>
    </>
  );
}

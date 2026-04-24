import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getAuth } from "@/infra/auth";
import {
  getGroupForUser,
  listGroupMembers,
} from "@/domain/groups/service";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteForm } from "@/components/groups/InviteForm";
import { RenameGroupForm } from "@/components/groups/RenameGroupForm";
import { MemberRow } from "@/components/groups/MemberRow";
import { LeaveGroupForm } from "@/components/groups/LeaveGroupForm";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  const members = await listGroupMembers(id, user.id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const isOwner = group.role === "owner";

  return (
    <>
      <PageHeader title={group.name} fallbackHref="/me" />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        <div className="space-y-1">
          <RenameGroupForm
            groupId={group.id}
            currentName={group.name}
            canEdit={isOwner}
          />
          <p className="text-sm italic text-muted-foreground">
            {members.length} {members.length === 1 ? "osoba" : "osób"} · założona{" "}
            {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
              group.createdAt,
            )}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Users size={18} /> Członkowie
            </CardTitle>
            <CardDescription>
              {isOwner
                ? "Możesz zapraszać nowe osoby i usuwać członków."
                : "Tylko właściciel może zapraszać i usuwać członków."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {members.map((m) => (
                <MemberRow
                  key={m.userId}
                  groupId={group.id}
                  member={m}
                  canManage={isOwner}
                  isSelf={m.userId === user.id}
                />
              ))}
            </ul>
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Zaproszenia</CardTitle>
              <CardDescription>
                Link ważny 14 dni, pojedynczego użycia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm
                groupId={group.id}
                groupName={group.name}
                baseUrl={baseUrl}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Opcje</CardTitle>
            <CardDescription>
              {isOwner
                ? "Opuszczenie jest możliwe po usunięciu pozostałych członków."
                : "Możesz opuścić grupę w dowolnej chwili."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeaveGroupForm groupId={group.id} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

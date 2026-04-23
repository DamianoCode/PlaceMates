import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/app/(auth)/actions";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { InviteForm } from "@/components/groups/InviteForm";

export default async function MePage() {
  const user = await (await getAuth()).getUser();
  const groups = user ? await listUserGroups(user.id) : [];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <section className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Twoje konto</h1>
      <Card>
        <CardHeader>
          <CardTitle>{user?.displayName ?? "—"}</CardTitle>
          <CardDescription>{user?.email ?? ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">Wyloguj</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publiczne opinie</CardTitle>
          <CardDescription>
            Przeglądaj oceny udostępnione przez wszystkich użytkowników.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/discover"
            className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Otwórz
          </Link>
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zaproś do grupy</CardTitle>
            <CardDescription>
              Link działa 14 dni. Każde zaproszenie można wykorzystać raz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groups.map((g) => (
              <InviteForm
                key={g.id}
                groupId={g.id}
                groupName={g.name}
                baseUrl={baseUrl}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

import Link from "next/link";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { acceptInvite } from "@/domain/groups/invites";
import { recordMemberJoined } from "@/domain/activity/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Invite acceptance is intentionally outside the (app) group so that the
// proxy redirect on /login picks up `?next=/join/<token>` and brings the
// user back after signing in.

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await (await getAuth()).getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const result = await acceptInvite(token, user.id);
  if (result.ok) {
    // Single-use invite → fires once per join. `after` defers the feed
    // write past the redirect response (redirect() throws below).
    after(() => recordMemberJoined(user.id, result.data.groupId));
    redirect("/map");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Zaproszenie nieważne</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/map" className="text-sm underline">
            Przejdź do mapy
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

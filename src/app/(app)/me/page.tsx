import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/app/(auth)/actions";
import { getAuth } from "@/infra/auth";

export default async function MePage() {
  const user = await (await getAuth()).getUser();
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
    </section>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

type Search = Promise<{ next?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { next } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zaloguj się do PlaceMates</CardTitle>
        <CardDescription>Oceniajcie miejsca razem — prywatnie.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}

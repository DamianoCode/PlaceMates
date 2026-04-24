import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

type Search = Promise<{ next?: string }>;

function invitedFrom(next?: string): boolean {
  return !!next && next.startsWith("/join/");
}

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { next } = await searchParams;
  const invited = invitedFrom(next);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">
          {invited ? "Zaloguj się, żeby dołączyć" : "Zaloguj się do PlaceMates"}
        </CardTitle>
        <CardDescription className="italic">
          {invited
            ? "Masz zaproszenie do grupy. Po zalogowaniu dołączysz automatycznie."
            : "Oceniajcie miejsca razem — prywatnie."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}

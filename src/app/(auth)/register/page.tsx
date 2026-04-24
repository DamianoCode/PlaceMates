import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/RegisterForm";

type Search = Promise<{ next?: string }>;

function invitedFrom(next?: string): boolean {
  return !!next && next.startsWith("/join/");
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { next } = await searchParams;
  const invited = invitedFrom(next);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">
          {invited ? "Dołącz do grupy" : "Załóż konto"}
        </CardTitle>
        <CardDescription className="italic">
          {invited
            ? "Po rejestracji od razu dodamy cię do grupy z zaproszenia."
            : "Zaczynasz z pustą, prywatną grupą „Moja”."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm next={next} />
      </CardContent>
    </Card>
  );
}

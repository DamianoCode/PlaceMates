import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";

type Search = Promise<{ next?: string }>;

function invitedFrom(next?: string): boolean {
  return !!next && next.startsWith("/join/");
}

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { next } = await searchParams;
  const invited = invitedFrom(next);

  return (
    <AuthShell
      eyebrow={invited ? "Dostałeś zaproszenie" : "Witaj z powrotem"}
      headline={
        invited ? (
          <>
            Dołącz do <em className="font-display italic text-primary">wspólnego</em>
            <br />
            atlasu.
          </>
        ) : (
          <>
            Wróć do <em className="font-display italic text-primary">wspólnego</em>
            <br />
            atlasu.
          </>
        )
      }
      subhead={
        invited ? (
          <>
            Zaloguj się, żeby od razu dołączyć do grupy. Wszystkie miejsca,
            oceny i zdjęcia jej członków pojawią się u ciebie.
          </>
        ) : (
          <>
            Twoje lodziarnie, punkty widokowe, kawiarnie — zapamiętane
            razem z bliskimi. Prywatnie, bez reklam.
          </>
        )
      }
    >
      <FormCard
        title={invited ? "Zaloguj się, żeby dołączyć" : "Zaloguj się"}
        lede={
          invited
            ? "Po zalogowaniu dodamy cię do grupy automatycznie."
            : "Konto istnieje od pierwszej pinezki."
        }
      >
        <GoogleButton next={next} label="Zaloguj przez Google" />
        <AuthDivider />
        <LoginForm next={next} />
      </FormCard>
    </AuthShell>
  );
}

function FormCard({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card/90 p-7 shadow-[0_30px_80px_-40px_oklch(0_0_0/0.5)] backdrop-blur-md">
      {/* Subtle internal glow so the card feels lit from within. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative">
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
        <p className="mt-1 text-sm italic text-muted-foreground">{lede}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";

type Search = Promise<{ next?: string; error?: string }>;

function invitedFrom(next?: string): boolean {
  return !!next && next.startsWith("/join/");
}

// Turn Supabase / OAuth raw error strings into something a human can act on.
function humaniseError(raw: string): string {
  if (!raw) return "Nie udało się zalogować.";
  const map: Record<string, string> = {
    oauth_missing_code: "Google nie wrócił z kodem autoryzacji.",
    oauth_failed: "Logowanie przez Google nie udało się.",
    access_denied: "Odmówiłeś zgody w Google.",
    redirect_uri_mismatch:
      "Adres powrotny nie jest zezwolony w Supabase (sprawdź Redirect URLs).",
  };
  return map[raw] ?? raw;
}

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { next, error } = await searchParams;
  const invited = invitedFrom(next);
  const errMsg = error ? humaniseError(error) : null;

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
        {errMsg && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errMsg}</span>
          </div>
        )}
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

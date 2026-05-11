import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getAuth } from "@/infra/auth";

/**
 * Landing page for the magic-link click. /auth/callback already
 * exchanged the code and redirected here with the session set —
 * so we can read the user to verify the recovery flow worked.
 *
 * If we land here without a session, the link expired or wasn't
 * for password recovery. Show a friendly path back to /forgot-password.
 */
export default async function ResetPasswordPage() {
  const user = await (await getAuth()).getUser();

  return (
    <AuthShell
      eyebrow="Nowe hasło"
      headline={
        <>
          Ustaw <em className="font-display italic text-primary">nowe</em> hasło.
        </>
      }
      subhead={
        user ? (
          <>
            Twój link działa. Wybierz hasło które łatwo zapamiętasz — co
            najmniej 8 znaków.
          </>
        ) : (
          <>
            Link wygasł albo został już wykorzystany. Wygeneruj nowy.
          </>
        )
      }
    >
      <FormCard
        title={user ? "Ustaw nowe hasło" : "Link wygasł"}
        lede={
          user
            ? "Po zapisaniu zostaniesz przeniesiony do mapy."
            : "Linki ważne są 60 minut, każdy do jednorazowego użycia."
        }
      >
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="space-y-4">
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Sesja resetująca nie istnieje. Może link został już użyty
                albo wygasł.
              </span>
            </div>
            <Link
              href="/forgot-password"
              className="block text-center text-sm text-foreground underline-offset-4 hover:underline"
            >
              Wyślij nowy link
            </Link>
          </div>
        )}
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

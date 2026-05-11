import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Zapomniałeś hasła?"
      headline={
        <>
          Wracamy do <em className="font-display italic text-primary">atlasu</em>.
        </>
      }
      subhead={
        <>
          Wpisz e-mail którym się rejestrowałeś. Wyślemy link który pozwoli
          ustawić nowe hasło — bez konieczności pamiętania starego.
        </>
      }
    >
      <FormCard
        title="Reset hasła"
        lede="Link zadziała 60 minut od wysłania."
      >
        <ForgotPasswordForm />
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

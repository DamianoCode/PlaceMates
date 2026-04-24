import { headers } from "next/headers";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { WebViewNotice } from "@/components/auth/WebViewNotice";
import { detectWebView } from "@/lib/webview";

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
  const webView = detectWebView((await headers()).get("user-agent"));

  return (
    <AuthShell
      eyebrow={invited ? "Zaproszenie czeka" : "Nowy atlas"}
      headline={
        invited ? (
          <>
            Dołącz i zacznij<br />
            <em className="font-display italic text-primary">zbierać miejsca</em>.
          </>
        ) : (
          <>
            Zacznijcie własny<br />
            <em className="font-display italic text-primary">atlas</em>.
          </>
        )
      }
      subhead={
        invited ? (
          <>
            Po rejestracji dodamy cię do grupy z zaproszenia. Zobaczysz
            miejsca odkryte przez znajomych i wystawisz swoje oceny.
          </>
        ) : (
          <>
            Każda grupa to osobny świat miejsc. Zaczynasz z prywatną
            grupą „Moja” i możesz zapraszać bliskich w dowolnej chwili.
          </>
        )
      }
    >
      <FormCard
        title={invited ? "Dołącz do grupy" : "Załóż konto"}
        lede={
          invited
            ? "Po chwili będziesz w środku."
            : "Darmowe. Bez reklam. Twoje."
        }
      >
        {webView && <WebViewNotice kind={webView} />}
        {!webView && (
          <>
            <GoogleButton next={next} label="Załóż przez Google" />
            <AuthDivider />
          </>
        )}
        <RegisterForm next={next} />
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

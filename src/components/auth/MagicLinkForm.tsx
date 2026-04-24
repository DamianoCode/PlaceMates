"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendMagicLinkAction,
  type MagicLinkState,
} from "@/app/(auth)/actions";

/**
 * Passwordless login. Works in every WebView because the link lands
 * in the user's Mail app → opens in the system browser. Ideal for
 * friends + family signups from Messenger, where Google OAuth is
 * blocked by 403 disallowed_useragent.
 */
export function MagicLinkForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(
    sendMagicLinkAction,
    null,
  );

  const error = state && "error" in state ? state.error : null;
  const sentTo =
    state && "ok" in state && state.ok ? state.email : null;

  if (sentTo) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm"
      >
        <div className="flex items-start gap-2">
          <Mail size={18} className="mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="font-semibold">Sprawdź skrzynkę</p>
            <p className="text-muted-foreground">
              Wysłaliśmy link do logowania na{" "}
              <span className="font-medium text-foreground">{sentTo}</span>.
              Klik w link w aplikacji Mail otworzy aplikację bezpośrednio w
              twojej zwykłej przeglądarce.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {/* Honeypot — see registerAction. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden opacity-0"
      >
        <label>
          Nie wypełniaj
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="magic-email">Logowanie linkiem przez email</Label>
        <Input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ty@example.com"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="w-full"
      >
        <Mail size={16} className="mr-2" />
        {pending ? "Wysyłam…" : "Wyślij link logujący"}
      </Button>
    </form>
  );
}

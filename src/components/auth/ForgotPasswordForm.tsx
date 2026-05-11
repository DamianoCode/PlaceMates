"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forgotPasswordAction,
  type FormState,
} from "@/app/(auth)/actions";

/**
 * Email input → triggers a magic link sent by Supabase. We always
 * show a "check your inbox" success even if the email doesn't
 * exist — prevents account enumeration. The server logs the
 * actual error if any (see auth provider impl).
 */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    forgotPasswordAction,
    null,
  );
  const ok = state && "ok" in state && state.ok;
  const error = state && "error" in state ? state.error : null;

  if (ok) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Mail size={18} className="mt-0.5 flex-shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Sprawdź skrzynkę.</p>
            <p className="text-muted-foreground">
              Jeśli ten e-mail jest u nas zarejestrowany, wysłaliśmy link do
              ustawienia nowego hasła. Może chwilę zająć — sprawdź też spam.
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Wracam do logowania
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
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
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Wysyłam…" : "Wyślij link resetujący"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Pamiętasz hasło?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}

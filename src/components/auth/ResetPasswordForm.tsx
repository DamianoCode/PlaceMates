"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordAction,
  type FormState,
} from "@/app/(auth)/actions";

/**
 * Shown after the user clicks the magic link in the reset email.
 * By this point the session is set (the magic link went through
 * /auth/callback which exchanged the code) so the server action
 * can just `updateUser({password})`.
 */
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    resetPasswordAction,
    null,
  );
  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nowe hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="min. 8 znaków"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Powtórz nowe hasło</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Zapisuję…" : "Ustaw nowe hasło"}
      </Button>
    </form>
  );
}

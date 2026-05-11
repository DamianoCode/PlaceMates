"use client";

import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(app)/me/password-actions";

/**
 * Change-password form for /me. Three fields (current / new /
 * confirm), inline success badge after save, fields auto-clear on
 * success so the user can change again or move on.
 *
 * Re-verifies current password server-side (see action) — Supabase
 * doesn't do this by default.
 */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<
    ChangePasswordState,
    FormData
  >(changePasswordAction, null);
  const [formKey, setFormKey] = useState(0);

  const ok = state && "ok" in state && state.ok;
  const error = state && "error" in state ? state.error : null;

  // Reset inputs on success — easier than wiring controlled refs
  // for three fields just to clear them. Bumping `key` remounts
  // the form so browser autofill leaves us alone too.
  useEffect(() => {
    if (!ok) return;
    let abort = false;
    queueMicrotask(() => {
      if (!abort) setFormKey((k) => k + 1);
    });
    return () => {
      abort = true;
    };
  }, [ok]);

  return (
    <form key={formKey} action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Aktualne hasło</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nowe hasło</Label>
        <Input
          id="newPassword"
          name="newPassword"
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
      {ok ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Check size={14} aria-hidden />
          Hasło zmienione.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Zmieniam…" : "Zmień hasło"}
      </Button>
    </form>
  );
}

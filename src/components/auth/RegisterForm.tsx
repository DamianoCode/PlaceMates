"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type FormState } from "@/app/(auth)/actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, null);
  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Nazwa wyświetlana</Label>
        <Input id="displayName" name="displayName" type="text" autoComplete="name" required maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Tworzę konto..." : "Załóż konto"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Masz już konto?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}

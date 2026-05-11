"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

/**
 * Supabase zwraca błędy auth (magic link wygasł, OAuth denied, etc.)
 * w fragment'cie URL — `#error=access_denied&error_code=otp_expired&...`.
 * Hash NIE jest wysyłany do serwera, więc /login page (RSC) ich nie
 * widzi — query-param banner pomija je.
 *
 * Ten klient czyta hash on-mount, parsuje znane error codes,
 * pokazuje friendly polski komunikat, a potem czyści hash przez
 * history.replaceState żeby refresh nie pokazywał tego ponownie.
 *
 * Działa razem z (a nie zamiast) server-side errMsg z `?error=`
 * w LoginPage — to dwa różne kanały.
 */
type ParsedError = {
  code: string;
  description: string;
};

function parseHashError(hash: string): ParsedError | null {
  if (!hash || hash.length < 2) return null;
  // Hash zaczyna się od '#', zachowuje się jak query-string po nim.
  const params = new URLSearchParams(hash.slice(1));
  const error = params.get("error");
  if (!error) return null;
  const code = params.get("error_code") ?? error;
  const description = params.get("error_description") ?? "";
  return { code, description: description.replace(/\+/g, " ") };
}

function humanise(err: ParsedError): string {
  // Najczęstsze case'y które realnie widzi user — wszystko po polsku.
  switch (err.code) {
    case "otp_expired":
      return "Link wygasł albo został już użyty. Wygeneruj nowy w „Zapomniałem hasła”.";
    case "access_denied":
      return "Dostęp odrzucony. Spróbuj ponownie albo zaloguj się inaczej.";
    case "invalid_request":
      return "Link jest niepoprawny. Wygeneruj nowy w „Zapomniałem hasła”.";
    case "server_error":
      return "Coś poszło nie tak po stronie serwera. Spróbuj za chwilę.";
    default:
      // Surowy opis jako fallback — Supabase czasem zwraca przydatny
      // text, nawet jeśli code nie jest na naszej liście.
      return err.description || "Wystąpił błąd przy weryfikacji linka.";
  }
}

export function HashErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      const parsed = parseHashError(window.location.hash);
      if (!parsed) return;
      setMessage(humanise(parsed));
      // Wyczyść hash żeby F5 nie reaktywował błędu, ale zachowaj
      // pathname + query. replaceState nie wywołuje navigation,
      // user pozostaje w bieżącym layoutie.
      const cleanUrl =
        window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    });
    return () => {
      abort = true;
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

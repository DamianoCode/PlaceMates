"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";

/**
 * Controlled search box for the places list. Keeps an immediate local
 * value (so typing feels instant) but only reports the *deferred* value
 * up via `onChange` — that's what drives the cached query, so we don't
 * fire a fetch on every keystroke. The parent owns the resulting filter
 * state and URL.
 */
export function PlaceSearchInput({
  initialValue,
  onChange,
  placeholder,
}: {
  initialValue: string;
  onChange: (q: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const deferred = useDeferredValue(value);

  // Skip the mount call — the initial value already came from the URL,
  // so reporting it back would be a redundant no-op (and could race the
  // initial query). Only propagate genuine edits.
  const lastReported = useRef(initialValue);
  useEffect(() => {
    if (deferred === lastReported.current) return;
    lastReported.current = deferred;
    onChange(deferred.trim());
  }, [deferred, onChange]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
      />
      <input
        // type="text" not "search" — the browser-native clear "X" on
        // type=search would pile on top of our custom clear button.
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "Szukaj miejsca…"}
        className="h-10 w-full rounded-full border border-border bg-card pr-10 pl-9 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Wyczyść"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

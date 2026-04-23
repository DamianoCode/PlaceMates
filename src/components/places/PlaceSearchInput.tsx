"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useState, useTransition } from "react";

export function PlaceSearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const deferred = useDeferredValue(value);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (deferred.trim().length > 0) next.set("q", deferred);
    else next.delete("q");
    const nextUrl = `${pathname}${next.size > 0 ? `?${next.toString()}` : ""}`;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
    // params is stable per render; deferred drives updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, pathname]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
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

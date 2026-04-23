"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Sticky top bar with a platform-style back button. Prefers router.back()
 * when there's a navigation history entry; otherwise navigates to `fallbackHref`
 * so deep-links land somewhere sensible.
 */
export function PageHeader({
  title,
  subtitle,
  fallbackHref = "/map",
  trailing,
}: {
  title: string;
  subtitle?: string;
  fallbackHref?: string;
  trailing?: ReactNode;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/85 px-3 py-2 backdrop-blur">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Wróć"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {trailing}
    </header>
  );
}

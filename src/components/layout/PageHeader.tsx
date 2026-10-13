"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import {
  PAGE_HEADER_CLASS,
  PAGE_HEADER_VT_STYLE,
} from "@/components/layout/page-header-style";

/**
 * Sticky top bar with a platform-style back button. Prefers router.back()
 * when there's a navigation history entry; otherwise navigates to `fallbackHref`
 * so deep-links land somewhere sensible.
 *
 * Pages that open with their own EditorialHeader pass `titleAs="p"` so the
 * route keeps a single <h1>; the bar title then stays a plain label.
 */
export function PageHeader({
  title,
  subtitle,
  fallbackHref = "/map",
  trailing,
  titleAs: TitleTag = "h1",
}: {
  title: string;
  titleAs?: "h1" | "p";
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
    <header style={PAGE_HEADER_VT_STYLE} className={PAGE_HEADER_CLASS}>
      <button
        type="button"
        onClick={handleBack}
        aria-label="Wróć"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <TitleTag className="truncate font-display text-base font-semibold leading-tight">
          {title}
        </TitleTag>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {trailing}
    </header>
  );
}

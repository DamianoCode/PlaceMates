import { ArrowLeft } from "lucide-react";
import {
  PAGE_HEADER_CLASS,
  PAGE_HEADER_VT_STYLE,
} from "@/components/layout/page-header-style";

/**
 * Non-interactive skeleton frame that matches the PageHeader + section
 * shape used by every (app) route. Lives under Suspense so Next.js
 * pops it onto screen instantly while the real RSC streams. Keeps
 * navigation feel snappy even on slow connections or cold functions.
 */
export function PageSkeleton({
  rows = 3,
  withHero = false,
}: {
  rows?: number;
  withHero?: boolean;
}) {
  return (
    <>
      <header style={PAGE_HEADER_VT_STYLE} className={PAGE_HEADER_CLASS}>
        <span
          aria-hidden
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/40"
        >
          <ArrowLeft size={22} />
        </span>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </header>
      <section className="mx-auto max-w-2xl space-y-4 p-4">
        {withHero && (
          <div className="aspect-[16/9] max-h-[min(50vh,420px)] w-full animate-pulse rounded-2xl bg-muted" />
        )}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-20 w-full animate-pulse rounded-2xl bg-muted"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </section>
    </>
  );
}

import type { ReactNode } from "react";

/**
 * Shared "editorial" page title: mono eyebrow → big Fraunces headline →
 * optional lede. Keeps typographic rhythm consistent with the auth
 * screens so the whole app feels written by the same hand.
 *
 * Server-rendered, no animation so it doesn't replay on every navigation.
 */
export function EditorialHeader({
  eyebrow,
  title,
  lede,
  trailing,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pb-1">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-2 font-mono text-[10px] tracking-[0.32em] uppercase text-primary/80">
            — {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl leading-[1.05] tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {lede && (
          <p className="mt-2 max-w-2xl text-sm italic text-muted-foreground sm:text-base">
            {lede}
          </p>
        )}
      </div>
      {trailing}
    </header>
  );
}

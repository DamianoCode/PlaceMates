import type { ReactNode } from "react";
import { FloatingStickers } from "./FloatingStickers";
import { TopoLines } from "./TopoLines";

/**
 * Editorial two-column shell for /login and /register.
 *
 * Left: hero — giant italic Fraunces headline that breaks the grid,
 * subhead, three polaroid-style category stickers drifting at
 * slightly off-axis rotations, an ornamental coord-spine ticker and
 * compass-rose wordmark. All server-rendered (no client code needed).
 *
 * Right: the form card, pulled in by the caller as children.
 *
 * Backdrop: topographic contour lines, a radial primary glow, and a
 * faint paper-noise overlay. Every layer is pointer-events-none so
 * the form stays the only interactive region.
 */
export function AuthShell({
  eyebrow,
  headline,
  subhead,
  children,
}: {
  eyebrow: string;
  headline: ReactNode;
  subhead: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Layered background — contour lines + radial glows + grain. */}
      <TopoLines />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_15%_15%,oklch(from_var(--color-primary)_l_c_h/0.18)_0%,transparent_60%),radial-gradient(ellipse_40%_50%_at_85%_85%,oklch(from_var(--color-primary)_l_c_h/0.12)_0%,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(oklch(0.2 0.02 50) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Top bar: signature wordmark + vertical coords on the right. */}
      <div className="relative z-10 flex items-start justify-between p-5 md:p-8">
        <div className="flex items-center gap-2">
          <CompassGlyph />
          <span className="font-display text-sm tracking-[0.22em] uppercase">
            PlaceMates
          </span>
        </div>
        <div className="hidden shrink-0 md:block">
          <span className="block rotate-90 origin-top-right font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/80">
            50.7°N · 23.2°E · together since 2026
          </span>
        </div>
      </div>

      {/* Main split. On mobile everything stacks; on lg+ the hero takes
       *  the left 3 cols of a 5-col grid so the form breathes. */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-6rem)] max-w-[1400px] grid-cols-1 gap-10 px-5 pb-10 md:px-10 lg:grid-cols-5 lg:gap-16">
        {/* Hero column. */}
        <section className="relative flex flex-col justify-center lg:col-span-3 lg:py-16">
          <p className="mb-4 font-mono text-[11px] tracking-[0.35em] uppercase text-primary/80 [animation:auth-rise_700ms_40ms_both]">
            — {eyebrow}
          </p>
          <h1
            className="font-display text-[clamp(3rem,9vw,7rem)] leading-[0.95] tracking-[-0.02em] text-foreground"
            style={{ fontWeight: 400 }}
          >
            {headline}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground [animation:auth-rise_800ms_220ms_both] md:text-xl">
            {subhead}
          </p>

          <div className="mt-10 hidden lg:block">
            <FloatingStickers />
          </div>
        </section>

        {/* Form column. */}
        <section className="relative flex items-center justify-center lg:col-span-2 lg:py-16">
          <div className="w-full max-w-sm [animation:auth-rise_900ms_380ms_both]">
            {children}
          </div>
        </section>

        {/* Mobile-only stickers row, stacked below form so the hero
         *  doesn't push the form below the fold on small screens. */}
        <div className="lg:hidden">
          <FloatingStickers compact />
        </div>
      </div>

      <style>{`
        @keyframes auth-rise {
          from { opacity: 0; transform: translateY(14px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);     filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

function CompassGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden
      className="text-primary"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M12 3 L14 12 L12 21 L10 12 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M3 12 L12 10 L21 12 L12 14 Z"
        fill="currentColor"
        opacity="0.35"
      />
      <circle cx="12" cy="12" r="1.6" fill="var(--color-background)" />
    </svg>
  );
}

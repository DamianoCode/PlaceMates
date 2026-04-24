/**
 * Polaroid-like category stickers that "drop" into place on load.
 *
 * These are the app's visual language — the categories people actually
 * rate (lody, widok, kawa…) presented as paper stickers pinned at
 * slight rotations. Purely decorative and server-rendered.
 *
 * When `compact`, renders smaller and inline for mobile; otherwise
 * scatters across the hero area with absolute rotation offsets.
 */
export function FloatingStickers({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-4">
        {STICKERS.map((s, i) => (
          <Sticker key={s.label} {...s} compact delayMs={200 + i * 110} />
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex h-48 max-w-[520px] items-end gap-5">
      {STICKERS.map((s, i) => (
        <Sticker key={s.label} {...s} delayMs={500 + i * 140} index={i} />
      ))}
    </div>
  );
}

type StickerProps = {
  emoji: string;
  label: string;
  accent: string; // tiny annotation line under the label
  delayMs?: number;
  compact?: boolean;
  index?: number;
};

function Sticker({
  emoji,
  label,
  accent,
  delayMs = 0,
  compact = false,
  index = 0,
}: StickerProps) {
  // Non-random, deterministic rotations so SSR/CSR match.
  const rotations = [-6, 3.5, -2.5, 5, -4];
  const rot = rotations[index % rotations.length];
  const offset = [0, 12, -6, 14, 4][index % 5];

  return (
    <figure
      className={
        "relative flex-shrink-0 rounded-[14px] border border-border/60 bg-card/95 px-3 pt-3 pb-2.5 shadow-[0_18px_40px_-12px_oklch(0_0_0/0.25)] backdrop-blur-sm " +
        (compact ? "w-28" : "w-32")
      }
      style={{
        transform: `rotate(${rot}deg) translateY(${offset}px)`,
        animation: `sticker-in 900ms ${delayMs}ms cubic-bezier(0.2, 0.9, 0.25, 1.15) both`,
      }}
    >
      {/* Paper clip / pin — a tiny primary-tinted dot at the top. */}
      <span
        aria-hidden
        className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary/90 shadow-[0_2px_6px_oklch(0_0_0/0.3)] ring-2 ring-background"
      />
      <div className="flex items-center justify-center py-2 text-3xl leading-none">
        {emoji}
      </div>
      <figcaption className="mt-1 text-center">
        <span className="block font-display text-[13px] italic leading-tight">
          {label}
        </span>
        <span className="block text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70">
          {accent}
        </span>
      </figcaption>

      <style>{`
        @keyframes sticker-in {
          0%   { opacity: 0; transform: rotate(${rot}deg) translateY(${offset - 30}px) scale(0.9); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: rotate(${rot}deg) translateY(${offset}px) scale(1); }
        }
      `}</style>
    </figure>
  );
}

const STICKERS: Omit<StickerProps, "delayMs" | "compact" | "index">[] = [
  { emoji: "🍨", label: "Lodziarnia", accent: "50.7°N" },
  { emoji: "🏔️", label: "Widok", accent: "320 m n.p.m." },
  { emoji: "☕", label: "Kawa", accent: "o poranku" },
  { emoji: "🍽️", label: "Obiad", accent: "w drodze" },
];

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { StarRating } from "@/components/places/StarRating";
import { TopoLines } from "@/components/auth/TopoLines";
import { getPublicRatingBySlug } from "@/domain/sharing/service";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await getPublicRatingBySlug(slug);
  if (!view) return { title: "Opinia — PlaceMates" };
  return {
    title: `${view.placeName} — ocena ${view.overall.toFixed(2)}/5`,
    description: view.note ?? `${view.categoryName} · ocenił(a) ${view.authorName}`,
  };
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(d);
}

export default async function PublicSharePage({ params }: { params: Params }) {
  const { slug } = await params;
  const view = await getPublicRatingBySlug(slug);
  if (!view) notFound();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <TopoLines />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_20%_10%,oklch(from_var(--color-primary)_l_c_h/0.16)_0%,transparent_60%),radial-gradient(ellipse_45%_35%_at_80%_90%,oklch(from_var(--color-primary)_l_c_h/0.12)_0%,transparent_60%)]"
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-start justify-between p-5 md:p-8">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <CompassMark size={22} />
          <span className="font-display text-sm tracking-[0.22em] uppercase text-foreground">
            PlaceMates
          </span>
        </Link>
        <span className="hidden font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/80 md:block">
          pocztówka · wspólny atlas
        </span>
      </div>

      <main className="relative z-10 mx-auto max-w-2xl px-5 pb-16 md:px-8">
        <p className="mb-3 font-mono text-[11px] tracking-[0.35em] uppercase text-primary/80">
          — {view.categoryName}
        </p>
        <h1 className="font-display text-[clamp(2.25rem,7vw,4.5rem)] leading-[1] tracking-[-0.02em]">
          {view.placeName}
        </h1>
        <p className="mt-4 text-sm italic text-muted-foreground sm:text-base">
          Oceniono przez{" "}
          <span className="font-medium not-italic text-foreground">
            {view.authorName}
          </span>{" "}
          · {fmtDate(view.ratedAt)}
        </p>

        {/* Rating headline — giant number + star rating */}
        <section
          aria-label="Ocena"
          className="mt-10 flex items-end gap-5 border-t pt-8"
        >
          <span className="font-display text-[clamp(3.5rem,12vw,6rem)] leading-none tabular-nums text-primary">
            {view.overall.toFixed(1)}
          </span>
          <div className="mb-1 flex flex-col gap-1">
            <StarRating value={view.overall} size={20} />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/80">
              z 5.0
            </span>
          </div>
        </section>

        {/* Per-dimension breakdown as a definition list. */}
        {Object.keys(view.dimensions).length > 0 && (
          <section
            aria-label="Wymiary oceny"
            className="mt-8 rounded-2xl border bg-card/80 p-5 backdrop-blur-sm"
          >
            <h2 className="mb-3 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              — wymiary oceny
            </h2>
            <dl className="divide-y">
              {Object.entries(view.dimensions).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <dt className="text-sm">
                    {view.dimensionLabels[key] ?? key}
                  </dt>
                  <dd className="flex items-center gap-2">
                    <StarRating value={value} size={12} />
                    <span className="tabular-nums text-sm font-medium text-primary">
                      {value.toFixed(1)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {view.note && (
          <blockquote className="mt-8 border-l-4 border-primary/60 pl-5 text-lg leading-relaxed italic text-foreground/90">
            “{view.note}”
            <footer className="mt-2 text-xs font-mono not-italic tracking-[0.25em] uppercase text-muted-foreground/70">
              — {view.authorName}
            </footer>
          </blockquote>
        )}

        {view.address && (
          <section className="mt-10 flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
            <MapPin
              size={18}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="break-words">{view.address}</p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground/80">
                {view.lat.toFixed(5)}°N · {view.lng.toFixed(5)}°E
              </p>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${view.lat.toFixed(6)},${view.lng.toFixed(6)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Star size={14} className="fill-current stroke-current" />
              Nawiguj
            </a>
          </section>
        )}

        <footer className="mt-16 border-t pt-6 text-center">
          <p className="font-display italic text-muted-foreground">
            Pocztówka z wspólnego atlasu.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            <Link
              href="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Załóż własny atlas
            </Link>{" "}
            i oceniaj miejsca z bliskimi.
          </p>
        </footer>
      </main>
    </div>
  );
}

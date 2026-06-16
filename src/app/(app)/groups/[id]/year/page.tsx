import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/infra/auth";
import { getGroupForUser } from "@/domain/groups/service";
import { getGroupYearReview } from "@/domain/year-review/service";
import { plural } from "@/lib/plural";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompassMark } from "@/components/brand/CompassMark";
import { CategoryBreakdown } from "@/components/insights/CategoryBreakdown";
import { YearStats } from "@/components/year-review/YearStats";
import { YearTopPlaces } from "@/components/year-review/YearTopPlaces";
import { YearGallery } from "@/components/year-review/YearGallery";
import { MonthlyBars } from "@/components/year-review/MonthlyBars";
import { TopMemberCard } from "@/components/year-review/TopMemberCard";

export default async function GroupYearPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { year: yearParam } = await searchParams;

  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  const requested = yearParam ? Number(yearParam) : undefined;
  const review = await getGroupYearReview(id, requested);

  const hrefForYear = (y: number) => `/groups/${id}/year?year=${y}`;
  const hasPrev = review.year > review.minYear;
  const hasNext = review.year < review.maxYear;
  const isEmpty = review.counts.places === 0 && review.totalEvents === 0;

  // Only scenes with data render; numbering stays sequential regardless.
  const scenes: { title: string; node: React.ReactNode }[] = [];
  if (!isEmpty) {
    scenes.push({ title: "Wasze liczby", node: <YearStats counts={review.counts} /> });
    if (review.topPlaces.length > 0) {
      scenes.push({ title: "Podium roku", node: <YearTopPlaces places={review.topPlaces} /> });
    }
    if (review.gallery.length > 0) {
      scenes.push({ title: "Kadry roku", node: <YearGallery photos={review.gallery} /> });
    }
    if (review.topMember) {
      scenes.push({ title: "Gwiazda roku", node: <TopMemberCard member={review.topMember} /> });
    }
    if (review.totalEvents > 0) {
      scenes.push({
        title: "Miesiąc po miesiącu",
        node: (
          <div className="rounded-3xl border bg-card p-5">
            <MonthlyBars months={review.monthly} />
          </div>
        ),
      });
    }
    if (review.categories.length > 0) {
      scenes.push({
        title: "Wasze smaki",
        node: (
          <div className="rounded-3xl border bg-card p-5">
            <CategoryBreakdown rows={review.categories} />
          </div>
        ),
      });
    }
  }

  return (
    <>
      <PageHeader title="Rok w pigułce" fallbackHref={`/groups/${id}`} />
      <section className="mx-auto max-w-2xl space-y-12 px-4 pb-16 pt-2">
        {/* Hero + year switcher */}
        <header
          className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent px-6 py-8"
          style={{ animation: "pm-fade-up 600ms ease-out both" }}
        >
          <CompassMark
            size={220}
            className="pointer-events-none absolute -right-12 -top-12 text-primary/10"
          />
          <p className="relative font-mono text-[11px] uppercase tracking-[0.32em] text-primary/80">
            — {group.name}
          </p>
          <div className="relative mt-3 flex items-center justify-between gap-3">
            <YearArrow href={hasPrev ? hrefForYear(review.year - 1) : null} dir="prev" />
            <div className="text-center">
              <p className="font-display text-7xl leading-none tracking-tight tabular-nums sm:text-8xl">
                {review.year}
              </p>
              <p className="mt-2 text-sm italic text-muted-foreground">
                {isEmpty
                  ? "w pigułce"
                  : `${review.totalEvents} ${plural(review.totalEvents, ["wydarzenie", "wydarzenia", "wydarzeń"])}`}
              </p>
            </div>
            <YearArrow href={hasNext ? hrefForYear(review.year + 1) : null} dir="next" />
          </div>
        </header>

        {isEmpty ? (
          <p
            className="rounded-3xl border border-dashed p-10 text-center text-sm italic text-muted-foreground"
            style={{ animation: "pm-fade-up 600ms ease-out 120ms both" }}
          >
            W {review.year} roku nic się jeszcze nie wydarzyło w tej grupie.
            {hasPrev && (
              <>
                {" "}
                Zajrzyj do{" "}
                <Link
                  href={hrefForYear(review.year - 1)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {review.year - 1}
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          scenes.map((scene, i) => (
            <section
              key={scene.title}
              className="space-y-4"
              style={{
                animation: `pm-fade-up 600ms ease-out ${(i + 1) * 90}ms both`,
              }}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs tabular-nums text-primary/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-2xl leading-tight">
                  {scene.title}
                </h2>
              </div>
              {scene.node}
            </section>
          ))
        )}
      </section>
    </>
  );
}

function YearArrow({
  href,
  dir,
}: {
  href: string | null;
  dir: "prev" | "next";
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const label = dir === "prev" ? "Poprzedni rok" : "Następny rok";
  const base =
    "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border backdrop-blur transition-colors";
  if (!href) {
    return (
      <span
        aria-hidden
        className={`${base} border-border/30 text-muted-foreground/25`}
      >
        <Icon size={22} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} border-primary/40 bg-card/40 text-primary hover:bg-primary/10 active:scale-95`}
    >
      <Icon size={22} />
    </Link>
  );
}

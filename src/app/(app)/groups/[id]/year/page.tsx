import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/infra/auth";
import { getGroupForUser } from "@/domain/groups/service";
import { getGroupYearReview } from "@/domain/year-review/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { StaggerList } from "@/components/layout/StaggerList";
import { RankedPlaceCard } from "@/components/places/RankedPlaceCard";
import { CounterGrid } from "@/components/insights/CounterGrid";
import { CategoryBreakdown } from "@/components/insights/CategoryBreakdown";
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

  // Membership gate — the recap queries trust the group id.
  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  const requested = yearParam ? Number(yearParam) : undefined;
  const review = await getGroupYearReview(id, requested);

  const hrefForYear = (y: number) => `/groups/${id}/year?year=${y}`;
  const hasPrev = review.year > review.minYear;
  const hasNext = review.year < review.maxYear;
  const isEmpty = review.counts.places === 0 && review.totalEvents === 0;

  return (
    <>
      <PageHeader title="Rok w pigułce" fallbackHref={`/groups/${id}`} />
      <section className="mx-auto max-w-2xl space-y-8 p-4">
        {/* Hero + year switcher */}
        <header className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/80">
            — {group.name}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <YearArrow
              href={hasPrev ? hrefForYear(review.year - 1) : null}
              dir="prev"
            />
            <div className="text-center">
              <p className="font-display text-6xl leading-none tracking-tight tabular-nums">
                {review.year}
              </p>
              <p className="mt-1 text-sm italic text-muted-foreground">
                w pigułce
              </p>
            </div>
            <YearArrow
              href={hasNext ? hrefForYear(review.year + 1) : null}
              dir="next"
            />
          </div>
        </header>

        {isEmpty ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm italic text-muted-foreground">
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
          <>
            <Scene index="01" title="Wasze liczby">
              <CounterGrid counts={review.counts} />
            </Scene>

            {review.topPlaces.length > 0 && (
              <Scene index="02" title="Najwyżej oceniane">
                <StaggerList as="ul" className="space-y-2">
                  {review.topPlaces.map((place, i) => (
                    <li key={place.canonicalId}>
                      <RankedPlaceCard place={place} rank={i + 1} />
                    </li>
                  ))}
                </StaggerList>
              </Scene>
            )}

            {review.topMember && (
              <Scene index="03" title="Gwiazda roku">
                <TopMemberCard member={review.topMember} />
              </Scene>
            )}

            {review.totalEvents > 0 && (
              <Scene index="04" title="Miesiąc po miesiącu">
                <MonthlyBars months={review.monthly} />
              </Scene>
            )}

            {review.categories.length > 0 && (
              <Scene index="05" title="Wasze smaki">
                <CategoryBreakdown rows={review.categories} />
              </Scene>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Scene({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/70">
          {index}
        </p>
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
      </div>
      {children}
    </section>
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
    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border transition-colors";
  if (!href) {
    return (
      <span
        aria-hidden
        className={`${base} border-border/40 text-muted-foreground/30`}
      >
        <Icon size={20} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} border-primary/30 text-primary hover:bg-primary/10 active:scale-95`}
    >
      <Icon size={20} />
    </Link>
  );
}

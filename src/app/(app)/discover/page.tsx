import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Star, Trophy } from "lucide-react";
import { getAuth } from "@/infra/auth";
import { listPublicShares } from "@/domain/sharing/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { EditorialHeader } from "@/components/layout/EditorialHeader";
import { StarRating } from "@/components/places/StarRating";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(d);
}

export default async function DiscoverPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const items = await listPublicShares(100);

  return (
    <>
      <PageHeader title="Odkrywaj" fallbackHref="/me" />
      <section className="mx-auto max-w-2xl space-y-6 p-4">
        <EditorialHeader
          eyebrow="Publicznie udostępnione"
          title={
            <>
              Opinie z <em className="font-display italic text-primary">cudzych</em> atlasów.
            </>
          }
          lede="Oceny wystawione i upublicznione przez innych użytkowników PlaceMates. Kliknij, żeby zobaczyć pełną pocztówkę."
        />

        <Link
          href="/ranking"
          className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Trophy size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base leading-tight">
              Ranking PlaceMates
            </p>
            <p className="truncate text-xs italic text-muted-foreground">
              Globalny atlas — anonimowe średnie ze wszystkich grup.
            </p>
          </div>
          <ChevronRight
            size={18}
            className="flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </Link>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm italic text-muted-foreground">
            Nikt nic jeszcze nie udostępnił. Bądź pierwszą osobą.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.slug}>
                <Link
                  href={`/share/${it.slug}`}
                  className="group block rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-base leading-tight">
                      {it.placeName}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm">
                      <Star size={14} className="fill-amber-400 stroke-amber-500" />
                      <span className="font-medium tabular-nums">
                        {it.overall.toFixed(1)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs italic text-muted-foreground">
                    <span>{it.categoryName}</span>
                    <span aria-hidden>·</span>
                    <span>{it.authorName}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono not-italic tracking-wide">
                      {fmtDate(it.ratedAt)}
                    </span>
                  </div>
                  {it.note && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      “{it.note}”
                    </p>
                  )}
                  <div className="mt-2">
                    <StarRating value={it.overall} size={12} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

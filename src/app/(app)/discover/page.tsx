import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { listPublicShares } from "@/domain/sharing/service";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(d);
}

export default async function DiscoverPage() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const items = await listPublicShares(100);

  return (
    <section className="p-4 space-y-3">
      <header>
        <h1 className="text-2xl font-semibold">Publiczne opinie</h1>
        <p className="text-sm text-muted-foreground">
          Oceny udostępnione przez innych użytkowników PlaceMates.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nikt nic jeszcze nie udostępnił.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.slug}>
              <Link
                href={`/share/${it.slug}`}
                className="block rounded-md border p-3 hover:bg-accent hover:text-accent-foreground"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{it.placeName}</span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {it.overall.toFixed(2)} / 5
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {it.categoryName} · {it.authorName} · {fmtDate(it.ratedAt)}
                </div>
                {it.note && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {it.note}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicRatingBySlug } from "@/domain/sharing/service";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getPublicRatingBySlug(slug);
  if (!view) return { title: "Opinia — PlaceMates" };
  return {
    title: `${view.placeName} — ocena ${view.overall.toFixed(2)}/5`,
    description: view.note ?? `${view.categoryName} · ocenił(a) ${view.authorName}`,
  };
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(d);
}

export default async function PublicSharePage({ params }: { params: Params }) {
  const { slug } = await params;
  const view = await getPublicRatingBySlug(slug);
  if (!view) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-xl p-4 space-y-4">
      <header className="space-y-1">
        <Link href="/" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          PlaceMates
        </Link>
        <h1 className="text-2xl font-semibold">{view.placeName}</h1>
        <p className="text-sm text-muted-foreground">{view.categoryName}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ocena: {view.overall.toFixed(2)} / 5</CardTitle>
          <CardDescription>
            {view.authorName} · {fmtDate(view.ratedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1.5 text-sm">
            {Object.entries(view.dimensions).map(([key, value]) => (
              <li key={key} className="flex items-baseline justify-between">
                <span>{view.dimensionLabels[key] ?? key}</span>
                <span className="tabular-nums text-muted-foreground">{value}</span>
              </li>
            ))}
          </ul>
          {view.note && (
            <blockquote className="rounded-md border-l-4 border-muted bg-muted/30 p-3 text-sm italic">
              “{view.note}”
            </blockquote>
          )}
        </CardContent>
      </Card>

      {view.address && (
        <Card>
          <CardHeader>
            <CardTitle>Lokalizacja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{view.address}</p>
            <p className="text-muted-foreground">
              {view.lat.toFixed(5)}, {view.lng.toFixed(5)}
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Ta opinia została udostępniona publicznie przez autora.{" "}
        <Link href="/" className="underline-offset-4 hover:underline">
          Stwórz konto w PlaceMates
        </Link>
        , żeby oceniać miejsca z bliskimi.
      </p>
    </main>
  );
}

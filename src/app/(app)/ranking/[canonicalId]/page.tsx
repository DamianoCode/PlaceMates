import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, MapPin, Star } from "lucide-react";
import { getAuth } from "@/infra/auth";
import { plural } from "@/lib/plural";
import {
  findUserPlaceForCanonical,
  getCanonicalById,
} from "@/domain/ranking/service";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryIcon } from "@/components/map/category-icons";
import { StarRating } from "@/components/places/StarRating";
import { NavigateButton } from "@/components/places/NavigateButton";

export default async function CanonicalPlacePage({
  params,
}: {
  params: Promise<{ canonicalId: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { canonicalId } = await params;
  const canonical = await getCanonicalById(canonicalId);
  if (!canonical) notFound();

  const userPlace = await findUserPlaceForCanonical(canonicalId, user.id);

  return (
    <>
      <PageHeader title="Ranking" fallbackHref="/ranking" />
      <section className="mx-auto max-w-2xl space-y-6 p-4">
        {/* Hero: big category icon + name + score. */}
        <div className="space-y-4">
          <div
            aria-hidden
            className="flex aspect-[16/9] max-h-[min(50vh,420px)] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
          >
            <CategoryIcon
              slug={canonical.categoryHint}
              size={72}
              strokeWidth={1.25}
              className="text-primary/60"
            />
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-[0.3em] uppercase text-primary/80">
              — w rankingu PlaceMates
            </p>
            <h2 className="font-display text-3xl leading-tight tracking-tight">
              {canonical.name}
            </h2>
          </div>
        </div>

        {/* Big score readout. */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Ocena wspólna</CardTitle>
            <CardDescription>
              Agregat anonimowy — liczba zebranych ocen ze wszystkich grup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canonical.avg !== null ? (
              <div className="flex items-end gap-5">
                <span className="font-display text-5xl leading-none tabular-nums text-primary">
                  {canonical.avg.toFixed(2)}
                </span>
                <div className="mb-1 flex flex-col gap-1">
                  <StarRating value={canonical.avg} size={18} />
                  <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/80">
                    {canonical.count}{" "}
                    {plural(canonical.count, ["ocena", "oceny", "ocen"])}
                  </span>
                </div>
              </div>
            ) : (
              <p className="italic text-muted-foreground">Brak ocen.</p>
            )}
          </CardContent>
        </Card>

        {/* Location + actions. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <MapPin size={18} /> Lokalizacja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {canonical.lat.toFixed(5)}°N · {canonical.lng.toFixed(5)}°E
            </p>
            <div className="flex flex-wrap gap-2">
              <NavigateButton
                lat={canonical.lat}
                lng={canonical.lng}
                label={canonical.name}
              />
              {userPlace ? (
                <Link
                  href={`/places/${userPlace.placeId}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
                >
                  <ExternalLink size={14} />
                  Otwórz w „{userPlace.groupName}”
                </Link>
              ) : canonical.hasExternalId ? (
                <Link
                  href={`/places/new?lat=${canonical.lat.toFixed(6)}&lng=${canonical.lng.toFixed(6)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Star size={14} />
                  Dodaj do swojej grupy
                </Link>
              ) : null}
            </div>
            {!userPlace && !canonical.hasExternalId && (
              <p className="text-xs italic text-muted-foreground">
                To miejsce zostało dodane jako pin na mapie w innej grupie —
                żeby wystawić własną ocenę, dodaj je przez wyszukiwarkę POI
                lub pin-drop w swojej grupie.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

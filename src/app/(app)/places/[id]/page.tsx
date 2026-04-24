import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Camera,
  Footprints,
  MapPin,
  PencilLine,
  Star,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { getAuth } from "@/infra/auth";
import { canUserEditPlace, getPlaceForUser } from "@/domain/places/service";
import { getCategory } from "@/domain/categories/service";
import {
  getUserRating,
  listRatingsForPlace,
} from "@/domain/ratings/service";
import { listVisitsForPlace } from "@/domain/visits/service";
import { listPhotosForPlace } from "@/domain/photos/service";
import { listItemsForPlace } from "@/domain/items/service";
import { isOnWishlist } from "@/domain/wishlist/service";
import { isFavorite } from "@/domain/favorites/service";
import { getExistingShareSlug } from "@/domain/sharing/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingForm } from "@/components/places/RatingForm";
import { VisitForm } from "@/components/places/VisitForm";
import { PhotoUploadForm } from "@/components/places/PhotoUploadForm";
import { WishlistHeartButton } from "@/components/places/WishlistHeartButton";
import { FavoriteHeartButton } from "@/components/places/FavoriteHeartButton";
import { ShareRating } from "@/components/places/ShareRating";
import { PlaceHero } from "@/components/places/PlaceHero";
import { CoverToggle } from "@/components/places/CoverToggle";
import { StatPill } from "@/components/places/StatPill";
import { NavigateButton } from "@/components/places/NavigateButton";
import { ItemCard } from "@/components/items/ItemCard";
import { CreateItemForm } from "@/components/items/CreateItemForm";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const place = await getPlaceForUser(id, user.id);
  if (!place) notFound();

  const [category, ratings, visits, photos, myRating, wish, fav, canEdit, items] =
    await Promise.all([
      getCategory(place.categoryId),
      listRatingsForPlace(id, user.id),
      listVisitsForPlace(id, user.id),
      listPhotosForPlace(id, user.id),
      getUserRating(id, user.id),
      isOnWishlist(id, user.id),
      isFavorite(id, user.id),
      canUserEditPlace(id, user.id),
      listItemsForPlace(id, user.id),
    ]);
  const shareSlug = myRating ? await getExistingShareSlug(myRating.id) : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const othersRatings = ratings.filter((r) => r.userId !== user.id);
  const groupAvg =
    ratings.length > 0
      ? ratings.reduce((s, r) => s + r.overall, 0) / ratings.length
      : null;

  return (
    <>
      <PageHeader
        title={place.name}
        subtitle={category?.name}
        fallbackHref="/map"
        trailing={
          <div className="flex items-center gap-0.5">
            <FavoriteHeartButton placeId={id} initial={fav} />
            <WishlistHeartButton placeId={id} initial={wish} />
          </div>
        }
      />

      <section className="space-y-6 p-4">
        <PlaceHero
          photos={photos.map((p) => ({ id: p.id, url: p.url }))}
          categorySlug={category?.slug ?? null}
        />

        <div className="-mt-2">
          <h2 className="font-display text-3xl leading-tight tracking-tight">
            {place.name}
          </h2>
          {category && (
            <p className="text-sm italic text-muted-foreground">{category.name}</p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatPill
            icon={Star}
            value={groupAvg !== null ? groupAvg.toFixed(2) : "—"}
            label={`Ocena · ${ratings.length}`}
          />
          <StatPill
            icon={Footprints}
            value={String(visits.length)}
            label="Wizyt"
          />
          <StatPill
            icon={Camera}
            value={String(photos.length)}
            label="Zdjęć"
          />
          <StatPill
            icon={Users}
            value={String(othersRatings.length)}
            label="Od innych"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
          <MapPin size={16} className="flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {place.address ? (
              <p className="break-words">{place.address}</p>
            ) : (
              <p className="text-muted-foreground">Bez adresu</p>
            )}
            <p className="text-xs tabular-nums text-muted-foreground">
              {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
            </p>
          </div>
          <NavigateButton lat={place.lat} lng={place.lng} label={place.name} />
          {canEdit && (
            <Link
              href={`/places/${id}/edit`}
              aria-label="Edytuj miejsce"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              <PencilLine size={16} />
              Edytuj
            </Link>
          )}
        </div>

        {category && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Star size={18} className="text-primary" /> Twoja ocena
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RatingForm
                placeId={id}
                schema={category.ratingSchema}
                initial={
                  myRating
                    ? { dimensions: myRating.dimensions, note: myRating.note }
                    : null
                }
              />
              <div className="border-t pt-4">
                <ShareRating
                  placeId={id}
                  initialSlug={shareSlug}
                  baseUrl={baseUrl}
                  hasRating={!!myRating}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <UtensilsCrossed size={18} /> Produkty i usługi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Brak produktów. Dodaj np. {"„lody waniliowe”"} albo {"„masaż karku”"} i oceń osobno.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <ItemCard placeId={id} item={item} />
                  </li>
                ))}
              </ul>
            )}
            <CreateItemForm placeId={id} />
          </CardContent>
        </Card>

        {othersRatings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Users size={18} /> Oceny grupy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {othersRatings.map((r) => (
                <div key={r.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{r.userDisplayName}</span>
                    <span className="flex items-center gap-1 tabular-nums text-primary">
                      <Star size={14} className="fill-current" />
                      {r.overall.toFixed(2)}
                    </span>
                  </div>
                  {r.note && (
                    <p className="mt-1 italic text-muted-foreground">“{r.note}”</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Footprints size={18} /> Wizyty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <VisitForm placeId={id} />
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wizyt jeszcze.</p>
            ) : (
              <ul className="space-y-2">
                {visits.map((v) => (
                  <li key={v.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{v.userDisplayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(v.visitedAt)}
                      </span>
                    </div>
                    {v.note && (
                      <p className="mt-1 italic text-muted-foreground">“{v.note}”</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Camera size={18} /> Zdjęcia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PhotoUploadForm placeId={id} />
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <li
                    key={p.id}
                    className="relative aspect-square overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <CoverToggle photoId={p.id} isCover={p.isCover} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

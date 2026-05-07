import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Camera,
  Footprints,
  Map as MapIcon,
  MapPin,
  PencilLine,
  Star,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { getAuth } from "@/infra/auth";
import {
  canUserEditPlace,
  getPlaceForUser,
  getSharePlaceAvailability,
} from "@/domain/places/service";
import { getCategory } from "@/domain/categories/service";
import {
  getUserRating,
  listRatingsForPlaceAcrossGroups,
} from "@/domain/ratings/service";
import { listVisitsForPlace } from "@/domain/visits/service";
import { listPhotosForPlace } from "@/domain/photos/service";
import { listItemsForPlace } from "@/domain/items/service";
import { isOnWishlist } from "@/domain/wishlist/service";
import { isFavorite } from "@/domain/favorites/service";
import { getGroupWishlistEntry } from "@/domain/group-wishlist/service";
import { getExistingShareSlug } from "@/domain/sharing/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { PhotoGallery } from "@/components/places/PhotoGallery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingForm } from "@/components/places/RatingForm";
import { VisitForm } from "@/components/places/VisitForm";
import { PhotoUploadForm } from "@/components/places/PhotoUploadForm";
import { WishlistHeartButton } from "@/components/places/WishlistHeartButton";
import { FavoriteHeartButton } from "@/components/places/FavoriteHeartButton";
import { GroupWishlistButton } from "@/components/places/GroupWishlistButton";
import { ShareRating } from "@/components/places/ShareRating";
import { PlaceHero } from "@/components/places/PlaceHero";
import { PhotoTile } from "@/components/places/PhotoTile";
import { StatPill } from "@/components/places/StatPill";
import { VisitList } from "@/components/places/VisitList";
import { NavigateButton } from "@/components/places/NavigateButton";
import { QuickVisitButton } from "@/components/places/QuickVisitButton";
import { SharePlaceButton } from "@/components/places/SharePlaceButton";
import { ItemCard } from "@/components/items/ItemCard";
import { CreateItemForm } from "@/components/items/CreateItemForm";
import { RatingsByGroup } from "@/components/places/RatingsByGroup";

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

  const [
    category,
    ratingsByGroup,
    visits,
    photos,
    myRating,
    wish,
    fav,
    groupWish,
    canEdit,
    items,
    shareAvailability,
  ] = await Promise.all([
    getCategory(place.categoryId),
    listRatingsForPlaceAcrossGroups(id, user.id),
    listVisitsForPlace(id, user.id),
    listPhotosForPlace(id, user.id),
    getUserRating(id, user.id),
    isOnWishlist(id, user.id),
    isFavorite(id, user.id),
    getGroupWishlistEntry(id),
    canUserEditPlace(id, user.id),
    listItemsForPlace(id, user.id),
    getSharePlaceAvailability(id, user.id),
  ]);
  const shareSlug = myRating ? await getExistingShareSlug(myRating.id) : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Cross-group aggregate — "ocena · X" stat on top now counts every
  // rating the user can see for this canonical, not just this place.
  const allCrossGroupRatings = ratingsByGroup.flatMap((b) => b.ratings);
  const groupAvg =
    allCrossGroupRatings.length > 0
      ? allCrossGroupRatings.reduce((s, r) => s + r.overall, 0) /
        allCrossGroupRatings.length
      : null;
  // "od innych" counter still means ratings not authored by the current
  // user (same meaning as before, just computed from the cross-group
  // pool so multi-group places show the full count).
  const othersCount = allCrossGroupRatings.filter(
    (r) => r.userId !== user.id,
  ).length;

  // Most recent visit by *this* user — drives QuickVisitButton's three
  // states (never / today / N days ago). visits is already sorted desc
  // by visitedAt, so .find takes the most recent in O(1) average.
  const myLastVisit = visits.find((v) => v.userId === user.id) ?? null;

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
            <GroupWishlistButton placeId={id} initial={!!groupWish} />
          </div>
        }
      />

      <section className="mx-auto max-w-2xl space-y-6 p-4">
        {/* PhotoGallery owns the carousel state. Both the hero and
         *  the grid tiles below call openAt(photoId) — the photos
         *  array passed here is the single source of truth, so the
         *  same photo clicked from anywhere opens at the same slot
         *  and the counter never double-counts. */}
        <PhotoGallery photos={photos.map((p) => ({ id: p.id, url: p.url }))}>
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
            index={0}
            icon={Star}
            value={groupAvg !== null ? groupAvg.toFixed(2) : "—"}
            label={`Ocena · ${allCrossGroupRatings.length}`}
          />
          <StatPill
            index={1}
            icon={Footprints}
            value={String(visits.length)}
            label="Wizyt"
          />
          <StatPill
            index={2}
            icon={Camera}
            value={String(photos.length)}
            label="Zdjęć"
          />
          <StatPill
            index={3}
            icon={Users}
            value={String(othersCount)}
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
          <Link
            href={`/map?lat=${place.lat.toFixed(6)}&lng=${place.lng.toFixed(6)}&zoom=18&place=${id}`}
            aria-label="Pokaż na mapie"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            <MapIcon size={16} />
            Na mapie
          </Link>
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
          {shareAvailability && shareAvailability.availableTargets.length > 0 && (
            <SharePlaceButton
              placeId={id}
              targets={shareAvailability.availableTargets}
            />
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
              {/* Filmweb-style "byłem tam" — independent of rating.
               *  Sits above the dimensions so a one-tap visit is the
               *  first thing the user can do on this card. */}
              <QuickVisitButton
                placeId={id}
                myLastVisitedAt={myLastVisit?.visitedAt ?? null}
              />
              <div className="border-t pt-4">
                <RatingForm
                  placeId={id}
                  schema={category.ratingSchema}
                  initial={
                    myRating
                      ? { dimensions: myRating.dimensions, note: myRating.note }
                      : null
                  }
                />
              </div>
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

        <RatingsByGroup buckets={ratingsByGroup} currentUserId={user.id} />

        <Card id="wizyty" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Footprints size={18} /> Wizyty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <VisitForm placeId={id} />
            <VisitList visits={visits} placeId={id} currentUserId={user.id} />
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
                  <li key={p.id}>
                    <PhotoTile
                      photoId={p.id}
                      url={p.url}
                      isCover={p.isCover}
                      canDelete={p.userId === user.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </PhotoGallery>
      </section>
    </>
  );
}

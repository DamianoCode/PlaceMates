import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { getPlaceForUser } from "@/domain/places/service";
import { getCategory } from "@/domain/categories/service";
import {
  getUserRating,
  listRatingsForPlace,
} from "@/domain/ratings/service";
import { listVisitsForPlace } from "@/domain/visits/service";
import { listPhotosForPlace } from "@/domain/photos/service";
import { isOnWishlist } from "@/domain/wishlist/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingForm } from "@/components/places/RatingForm";
import { VisitForm } from "@/components/places/VisitForm";
import { PhotoUploadForm } from "@/components/places/PhotoUploadForm";
import { WishlistToggle } from "@/components/places/WishlistToggle";

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

  const [category, ratings, visits, photos, myRating, wish] = await Promise.all([
    getCategory(place.categoryId),
    listRatingsForPlace(id, user.id),
    listVisitsForPlace(id, user.id),
    listPhotosForPlace(id, user.id),
    getUserRating(id, user.id),
    isOnWishlist(id, user.id),
  ]);

  return (
    <section className="p-4 space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{place.name}</h1>
        {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
        <WishlistToggle placeId={id} initial={wish} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lokalizacja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {place.address && <p>{place.address}</p>}
          <p className="text-muted-foreground">
            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
          </p>
        </CardContent>
      </Card>

      {category && (
        <Card>
          <CardHeader>
            <CardTitle>Twoja ocena</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingForm
              placeId={id}
              schema={category.ratingSchema}
              initial={
                myRating
                  ? { dimensions: myRating.dimensions, note: myRating.note }
                  : null
              }
            />
          </CardContent>
        </Card>
      )}

      {ratings.filter((r) => r.userId !== user.id).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Oceny grupy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ratings
              .filter((r) => r.userId !== user.id)
              .map((r) => (
                <div key={r.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{r.userDisplayName}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.overall.toFixed(2)} / 5
                    </span>
                  </div>
                  {r.note && <p className="mt-1 text-muted-foreground">{r.note}</p>}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Wizyty</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <VisitForm placeId={id} />
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak wizyt jeszcze.</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => (
                <li key={v.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{v.userDisplayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(v.visitedAt)}
                    </span>
                  </div>
                  {v.note && <p className="mt-1 text-muted-foreground">{v.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zdjęcia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PhotoUploadForm placeId={id} />
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <li key={p.id} className="aspect-square overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

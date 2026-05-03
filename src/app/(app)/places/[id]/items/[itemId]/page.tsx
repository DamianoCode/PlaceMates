import { notFound, redirect } from "next/navigation";
import { Camera, Star, Trash2, UtensilsCrossed, Users } from "lucide-react";
import { getAuth } from "@/infra/auth";
import {
  getItemForUser,
  listItemPhotos,
  listItemRatings,
} from "@/domain/items/service";
import { getPlaceForUser } from "@/domain/places/service";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ItemRateForm } from "@/components/items/ItemRateForm";
import { ItemPhotoUpload } from "@/components/items/ItemPhotoUpload";
import { ItemPhotoTile } from "@/components/items/ItemPhotoTile";
import { PhotoGallery } from "@/components/places/PhotoGallery";
import { PhotoHero } from "@/components/places/PhotoHero";
import { StarRating } from "@/components/places/StarRating";
import { DeleteItemButton } from "@/components/items/DeleteItemButton";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  const { id, itemId } = await params;
  const [place, item] = await Promise.all([
    getPlaceForUser(id, user.id),
    getItemForUser(itemId, user.id),
  ]);
  if (!place || !item || item.placeId !== id) notFound();

  const [ratings, photos] = await Promise.all([
    listItemRatings(itemId, user.id),
    listItemPhotos(itemId, user.id),
  ]);

  const mine = ratings.find((r) => r.userId === user.id) ?? null;
  const others = ratings.filter((r) => r.userId !== user.id);
  const avg =
    ratings.length > 0
      ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length
      : null;
  const canDelete = item.createdBy === user.id;

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={place.name}
        fallbackHref={`/places/${id}`}
      />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        {/* PhotoGallery owns the carousel state — hero and grid
         *  tiles both call openAt(photoId). Photos array is the
         *  single source of truth so clicks from either surface
         *  open at the same slot without double-counting. */}
        <PhotoGallery photos={photos.map((p) => ({ id: p.id, url: p.url }))}>
        <PhotoHero
          photos={photos}
          fallback={
            <UtensilsCrossed
              size={72}
              strokeWidth={1.25}
              className="text-primary/60"
            />
          }
        />

        {/* Summary row with big score + stars. */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-3xl leading-tight">{item.name}</h2>
            <p className="text-sm italic text-muted-foreground">
              z {place.name}
            </p>
          </div>
          <div className="flex flex-col items-end">
            {avg !== null ? (
              <>
                <span className="font-display text-4xl leading-none tabular-nums text-primary">
                  {avg.toFixed(1)}
                </span>
                <StarRating value={avg} size={16} className="mt-1" />
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {ratings.length}{" "}
                  {ratings.length === 1 ? "ocena" : "ocen"}
                </span>
              </>
            ) : (
              <span className="text-sm italic text-muted-foreground">
                jeszcze bez oceny
              </span>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Star size={18} className="text-primary" /> Twoja ocena
            </CardTitle>
            <CardDescription>Skala 1 – 5 z krokiem 0.5.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemRateForm
              itemId={item.id}
              initialScore={mine?.score ?? null}
              initialNote={mine?.note ?? null}
            />
          </CardContent>
        </Card>

        {others.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Users size={18} /> Oceny grupy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {others.map((r) => (
                <div key={r.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{r.userDisplayName}</span>
                    <span className="flex items-center gap-1 text-primary tabular-nums">
                      <Star size={14} className="fill-current" />
                      {r.score.toFixed(1)}
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
              <Camera size={18} /> Zdjęcia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ItemPhotoUpload itemId={item.id} />
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <li key={p.id}>
                    <ItemPhotoTile
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

        {canDelete && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Trash2 size={18} /> Opcje
              </CardTitle>
              <CardDescription>
                Usunięcie produktu usuwa też wszystkie oceny i notatki.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteItemButton itemId={item.id} />
            </CardContent>
          </Card>
        )}
        </PhotoGallery>
      </section>
    </>
  );
}

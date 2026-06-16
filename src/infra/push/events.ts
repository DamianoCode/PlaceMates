import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  groupMembers,
  places,
  profiles,
  tripStops,
  trips,
} from "@/infra/db/schema";
import { sendToUser, sendToUsersExcept } from "./sender";

/**
 * Concrete event helpers. Each one resolves the recipient(s),
 * crafts the title/body, and delegates to the sender. Caller
 * invokes via `after(() => ...)` so the push runs after the
 * server-action response is sent — no added latency on the
 * user-perceived path.
 *
 * Self-events filtered at the boundary (`sendToUsersExcept` /
 * createdBy check) — never push to the actor themselves.
 */

/** Someone (`actorId`) rated `placeId`. Notify the place creator. */
export async function pushRatingCreated(
  actorId: string,
  placeId: string,
  overall: number,
): Promise<void> {
  try {
    const [place] = await db
      .select({
        createdBy: places.createdBy,
        name: places.name,
      })
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);
    if (!place || place.createdBy === actorId) return;

    const [actor] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, actorId))
      .limit(1);

    await sendToUser(place.createdBy, "rating", {
      title: "Ocena Twojego miejsca",
      body: `${actor?.displayName ?? "Ktoś"} ocenił ${place.name} na ${overall.toFixed(1)}.`,
      url: `/places/${placeId}`,
    });
  } catch (err) {
    console.error("[push] rating event failed", err);
  }
}

/** Someone (`actorId`) toggled a stop completed in a trip. Notify
 *  every other group member. `completed=true` when they marked done,
 *  `false` when they unmarked. Looks up tripId / placeName from
 *  stopId so callers only need the cheap identifiers. */
export async function pushStopCompleted(
  actorId: string,
  stopId: string,
  completed: boolean,
): Promise<void> {
  // We only notify on completion — unmark is rarely noteworthy and
  // would create a noisy "asia odhaczyła; asia cofnęła; asia odhaczyła…"
  // ping-pong while she fumbles the checkbox.
  if (!completed) return;
  try {
    const [row] = await db
      .select({
        tripId: tripStops.tripId,
        tripName: trips.name,
        groupId: trips.groupId,
        placeName: places.name,
      })
      .from(tripStops)
      .innerJoin(trips, eq(trips.id, tripStops.tripId))
      .innerJoin(places, eq(places.id, tripStops.placeId))
      .where(eq(tripStops.id, stopId))
      .limit(1);
    if (!row) return;

    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, row.groupId));

    const [actor] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, actorId))
      .limit(1);

    await sendToUsersExcept(
      members.map((m) => m.userId),
      actorId,
      "stopCompleted",
      {
        title: row.tripName,
        body: `${actor?.displayName ?? "Ktoś"} odhaczył(a) ${row.placeName}.`,
        url: `/plans/${row.tripId}`,
      },
    );
  } catch (err) {
    console.error("[push] stop-completed event failed", err);
  }
}

/** Someone (`actorId`) added a place to a group. Notify every other
 *  group member. */
export async function pushPlaceCreated(
  actorId: string,
  placeId: string,
  groupId: string,
  placeName: string,
): Promise<void> {
  try {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const [actor] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, actorId))
      .limit(1);

    await sendToUsersExcept(
      members.map((m) => m.userId),
      actorId,
      "newPlace",
      {
        title: "Nowe miejsce w grupie",
        body: `${actor?.displayName ?? "Ktoś"} dodał(a) ${placeName}.`,
        url: `/places/${placeId}`,
      },
    );
  } catch (err) {
    console.error("[push] place-created event failed", err);
  }
}

/** Someone (`actorId`) added a photo to `placeId`. Notify every other
 *  group member. Resolves the place's group + name from its id. */
export async function pushPhotoAdded(
  actorId: string,
  placeId: string,
): Promise<void> {
  try {
    const [place] = await db
      .select({ groupId: places.groupId, name: places.name })
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);
    if (!place) return;

    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, place.groupId));

    const [actor] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, actorId))
      .limit(1);

    await sendToUsersExcept(
      members.map((m) => m.userId),
      actorId,
      "photo",
      {
        title: "Nowe zdjęcie w grupie",
        body: `${actor?.displayName ?? "Ktoś"} dodał(a) zdjęcie do ${place.name}.`,
        url: `/places/${placeId}`,
      },
    );
  } catch (err) {
    console.error("[push] photo-added event failed", err);
  }
}

/** Someone (`actorId`) created a trip. Notify every other group member.
 *  Group id + name are known at the call site. */
export async function pushTripCreated(
  actorId: string,
  tripId: string,
  groupId: string,
  tripName: string,
): Promise<void> {
  try {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const [actor] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, actorId))
      .limit(1);

    await sendToUsersExcept(
      members.map((m) => m.userId),
      actorId,
      "trip",
      {
        title: "Nowy plan w grupie",
        body: `${actor?.displayName ?? "Ktoś"} zaplanował(a) „${tripName}”.`,
        url: `/plans/${tripId}`,
      },
    );
  } catch (err) {
    console.error("[push] trip-created event failed", err);
  }
}

/** Someone (`actorId`) joined `groupId`. Notify every existing member. */
export async function pushMemberJoined(
  actorId: string,
  groupId: string,
): Promise<void> {
  try {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const [actor] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, actorId))
      .limit(1);

    await sendToUsersExcept(
      members.map((m) => m.userId),
      actorId,
      "member",
      {
        title: "Nowy członek grupy",
        body: `${actor?.displayName ?? "Ktoś"} dołączył(a) do grupy.`,
        url: `/groups/${groupId}`,
      },
    );
  } catch (err) {
    console.error("[push] member-joined event failed", err);
  }
}

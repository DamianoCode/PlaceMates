import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { notificationPrefs, pushSubscriptions } from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

/**
 * Web Push subscriptions + per-user notification prefs.
 *
 * One row per (user, endpoint) — a single user can have multiple
 * subscriptions if they install the PWA on phone + desktop. Each
 * device gets its own row, each notification fans out to all of
 * them.
 *
 * Prefs default to "everything on" — missing row treated as
 * `{ rating: true, stopCompleted: true, newPlace: true }` so a
 * brand-new user gets the most useful set without an explicit
 * setup step.
 */

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type NotificationKind =
  | "rating"
  | "stopCompleted"
  | "newPlace"
  | "photo"
  | "trip"
  | "member";

export type NotificationPrefs = Record<NotificationKind, boolean>;

const DEFAULT_PREFS: NotificationPrefs = {
  rating: true,
  stopCompleted: true,
  newPlace: true,
  photo: true,
  trip: true,
  member: true,
};

export async function addSubscription(
  userId: string,
  sub: PushSubscriptionPayload,
  userAgent: string | null,
): Promise<Result<{ id: string }>> {
  if (!sub.endpoint || !sub.keys.p256dh || !sub.keys.auth) {
    return err("Niepoprawna subskrypcja.");
  }
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
      },
    })
    .returning({ id: pushSubscriptions.id });
  return ok({ id: row.id });
}

export async function removeSubscription(
  userId: string,
  endpoint: string,
): Promise<Result<null>> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );
  return ok(null);
}

export async function listUserSubscriptions(userId: string): Promise<
  Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>
> {
  return db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/** Bulk delete by ids — called after a push fails with 404/410. */
export async function removeSubscriptionsById(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .delete(pushSubscriptions)
    .where(inArray(pushSubscriptions.id, ids));
}

export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const [row] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId))
    .limit(1);
  if (!row) return DEFAULT_PREFS;
  return {
    rating: row.rating,
    stopCompleted: row.stopCompleted,
    newPlace: row.newPlace,
    photo: row.photo,
    trip: row.trip,
    member: row.member,
  };
}

export async function setNotificationPref(
  userId: string,
  kind: NotificationKind,
  value: boolean,
): Promise<Result<null>> {
  // Upsert — first toggle creates the row, subsequent toggles
  // update it. Defaults stay "all on" for missing rows so we have
  // to materialise on first explicit change.
  const current = await getNotificationPrefs(userId);
  const next = { ...current, [kind]: value };
  await db
    .insert(notificationPrefs)
    .values({
      userId,
      rating: next.rating,
      stopCompleted: next.stopCompleted,
      newPlace: next.newPlace,
      photo: next.photo,
      trip: next.trip,
      member: next.member,
    })
    .onConflictDoUpdate({
      target: notificationPrefs.userId,
      set: {
        rating: next.rating,
        stopCompleted: next.stopCompleted,
        newPlace: next.newPlace,
        photo: next.photo,
        trip: next.trip,
        member: next.member,
        updatedAt: new Date(),
      },
    });
  return ok(null);
}

import "server-only";
import webpush from "web-push";
import {
  getNotificationPrefs,
  listUserSubscriptions,
  removeSubscriptionsById,
  type NotificationKind,
} from "@/domain/push/service";

/**
 * Server-side Web Push sender. Wraps the `web-push` library with
 * our preference-checking + dead-subscription pruning.
 *
 * VAPID keys must live in env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — exposed to client (used to subscribe)
 *   VAPID_PRIVATE_KEY              — server only (signs each push)
 *   VAPID_CONTACT                   — mailto: identifying us to the
 *                                     push service in case of abuse
 *
 * Generate locally: `npx web-push generate-vapid-keys`
 */

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? "mailto:noreply@placemates.app";
  if (!publicKey || !privateKey) {
    // Soft-fail — push just won't work, rest of app continues. Logging
    // once at boot is the only signal we surface here.
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[push] VAPID keys missing — push notifications disabled",
      );
    }
    return false;
  }
  webpush.setVapidDetails(contact, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Optional URL to open when user clicks the notification. */
  url?: string;
  /** Optional override for the icon (defaults to app icon). */
  icon?: string;
};

/**
 * Fan out a push to every subscription belonging to `userId`,
 * gated by their preference for this `kind`. Self-events are
 * filtered at the call site (sendToUserExcept) — `sendToUser`
 * trusts the caller knows what they're doing.
 *
 * Returns the count of successful deliveries.
 */
export async function sendToUser(
  userId: string,
  kind: NotificationKind,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapid()) return 0;

  const prefs = await getNotificationPrefs(userId);
  if (!prefs[kind]) return 0;

  const subs = await listUserSubscriptions(userId);
  if (subs.length === 0) return 0;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    icon: payload.icon ?? "/icons/icon-192.png",
  });

  const dead: string[] = [];
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        delivered++;
      } catch (err) {
        // 404 (Not Registered) / 410 (Gone) → endpoint is dead,
        // remove it. Other errors (5xx push service issues) we
        // leave alone to retry on the next event.
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          dead.push(sub.id);
        }
      }
    }),
  );

  if (dead.length > 0) await removeSubscriptionsById(dead);
  return delivered;
}

/**
 * Convenience: send to every user in a list except one (the actor).
 * Used for "Asia odhaczyła stop" → notify Marek + Kasia, not Asia
 * herself.
 */
export async function sendToUsersExcept(
  userIds: string[],
  exceptUserId: string,
  kind: NotificationKind,
  payload: PushPayload,
): Promise<number> {
  const recipients = userIds.filter((id) => id !== exceptUserId);
  if (recipients.length === 0) return 0;
  const counts = await Promise.all(
    recipients.map((id) => sendToUser(id, kind, payload)),
  );
  return counts.reduce((s, c) => s + c, 0);
}

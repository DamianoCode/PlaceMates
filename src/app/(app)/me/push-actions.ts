"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import {
  addSubscription,
  removeSubscription,
  setNotificationPref,
  type NotificationKind,
  type PushSubscriptionPayload,
} from "@/domain/push/service";
import { err, type Result } from "@/domain/result";

export async function subscribeToPushAction(
  sub: PushSubscriptionPayload,
  userAgent: string | null,
): Promise<Result<{ id: string }>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");
  const result = await addSubscription(user.id, sub, userAgent);
  if (result.ok) revalidatePath("/me");
  return result;
}

export async function unsubscribeFromPushAction(
  endpoint: string,
): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");
  const result = await removeSubscription(user.id, endpoint);
  if (result.ok) revalidatePath("/me");
  return result;
}

export async function setNotificationPrefAction(
  kind: NotificationKind,
  value: boolean,
): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");
  const result = await setNotificationPref(user.id, kind, value);
  if (result.ok) revalidatePath("/me");
  return result;
}

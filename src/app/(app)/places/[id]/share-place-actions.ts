"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { sharePlaceToGroup } from "@/domain/places/service";
import { err, type Result } from "@/domain/result";

export async function sharePlaceToGroupAction(
  placeId: string,
  targetGroupId: string,
): Promise<Result<{ id: string }>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await sharePlaceToGroup(placeId, targetGroupId, user.id);
  if (!result.ok) return result;

  // Revalidate the source detail page (so the share menu reflects the
  // new occupied group) and the broader lists that show per-group cards.
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/places");
  revalidatePath("/map");
  return result;
}

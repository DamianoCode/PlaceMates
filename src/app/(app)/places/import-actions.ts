"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/infra/auth";
import { bulkCreatePlaces, type BulkPlaceItem } from "@/domain/places/service";

// One POI row. Validated per-item (not as a whole array) so a single
// malformed hit never sinks the rest of the batch — see bulkImportAction.
const BulkItem = z.object({
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(500).nullable(),
  // Either the legacy `osmId` (kept for old clients) or the explicit
  // (provider, externalId) pair the multi-provider nearby flow now ships.
  osmId: z.string().max(64).nullable().optional(),
  provider: z.enum(["osm", "geoapify"]).nullable().optional(),
  // Geoapify place_ids encode the POI name in hex and routinely exceed
  // 128 chars (observed up to 212). A too-tight cap rejects the row —
  // long-named churches/monuments never import. DB column is `text`;
  // this is an abuse guard, so keep it roomy.
  externalId: z.string().max(1024).nullable().optional(),
});

// Envelope only — `items` stays `unknown[]` here so we can validate each
// element individually below and report partial failures instead of an
// all-or-nothing reject.
const BulkEnvelope = z.object({
  groupId: z.string().uuid(),
  categoryId: z.string().uuid(),
  items: z.array(z.unknown()).min(1).max(200),
});

export type ImportResult =
  | {
      ok: true;
      inserted: number;
      skipped: number;
      /** Rows dropped because they failed per-item validation. */
      failed: number;
      /** Human-readable reason for the first dropped row, if any. */
      failureReason?: string;
    }
  | { ok: false; error: string };

/** First Zod issue as a short "field: message" string for the user. */
function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Bulk-import picked POIs into one group+category.
 *
 * Resilient by design: each item is validated on its own, so one bad
 * row (an over-long id from a future provider, a name past the limit)
 * is counted and skipped while the good rows still import. The DB write
 * is wrapped so a thrown error becomes a clean message instead of a
 * rejected server action that would freeze the client's spinner.
 */
export async function bulkImportAction(
  payload: unknown,
): Promise<ImportResult> {
  const user = await (await getAuth()).getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const envelope = BulkEnvelope.safeParse(payload);
  if (!envelope.success) {
    return { ok: false, error: "Niepoprawne dane importu." };
  }

  // Partition items: keep the valid ones, count + remember why the rest
  // failed. Never reject the whole batch over a single bad row.
  const valid: BulkPlaceItem[] = [];
  let failed = 0;
  let firstFailureReason: string | null = null;
  for (const raw of envelope.data.items) {
    const item = BulkItem.safeParse(raw);
    if (item.success) {
      valid.push(item.data);
    } else {
      failed++;
      firstFailureReason ??= describeIssue(item.error);
    }
  }

  if (valid.length === 0) {
    return {
      ok: false,
      error: firstFailureReason
        ? `Nie udało się dodać żadnego miejsca (${firstFailureReason}).`
        : "Niepoprawne dane importu.",
    };
  }

  let result;
  try {
    result = await bulkCreatePlaces(
      envelope.data.groupId,
      envelope.data.categoryId,
      valid,
      user.id,
    );
  } catch (err) {
    // A thrown DB/canonical error would otherwise reject the action and
    // leave the client awaiting forever. Convert it into a clean result.
    console.error("bulkImportAction: insert failed", err);
    return { ok: false, error: "Błąd zapisu w bazie. Spróbuj ponownie." };
  }
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/map");
  revalidatePath("/places");
  return {
    ok: true,
    inserted: result.data.inserted,
    skipped: result.data.skipped,
    failed,
    failureReason: failed > 0 ? firstFailureReason ?? undefined : undefined,
  };
}

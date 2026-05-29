/**
 * One-off backfill: recompute `ratings.overall` for every existing rating
 * using the corrected `computeOverall` (1..5 scale). Rows written under the
 * old 0..5 normalization stored systematically low values; this rewrites
 * them from their stored `dimensions` + the place's category schema.
 *
 * Dry-run by default (prints what would change). Pass `--apply` to write.
 *   npm run db:backfill-ratings          # dry-run
 *   npm run db:backfill-ratings -- --apply
 *
 * Idempotent: re-running after a successful apply reports 0 changes.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/infra/db/client";
import { categories, places, ratings } from "../src/infra/db/schema";
import { computeOverall } from "../src/lib/validation/rating";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Pull each rating alongside the category schema it should be scored by.
  const rows = await db
    .select({
      id: ratings.id,
      dimensions: ratings.dimensions,
      overall: ratings.overall,
      schema: categories.ratingSchema,
    })
    .from(ratings)
    .innerJoin(places, eq(places.id, ratings.placeId))
    .innerJoin(categories, eq(categories.id, places.categoryId));

  let changed = 0;
  let unchanged = 0;

  for (const r of rows) {
    const next = computeOverall(r.dimensions, r.schema);
    const nextStr = next.toFixed(2);
    const prevStr = Number(r.overall).toFixed(2);

    if (nextStr === prevStr) {
      unchanged += 1;
      continue;
    }

    changed += 1;
    console.log(`${r.id}  ${prevStr} -> ${nextStr}`);

    if (APPLY) {
      await db
        .update(ratings)
        .set({ overall: nextStr })
        .where(eq(ratings.id, r.id));
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry-run"} — ${rows.length} ratings, ${changed} ${
      APPLY ? "updated" : "would change"
    }, ${unchanged} already correct.`,
  );
  if (!APPLY && changed > 0) {
    console.log("Re-run with `-- --apply` to write the changes.");
  }

  // Drizzle's pg pool keeps the process alive otherwise.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

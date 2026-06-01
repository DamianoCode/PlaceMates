/**
 * Guard: every category string in CATEGORY_TO_GEOAPIFY must be a real
 * Geoapify Places category.
 *
 * Why this exists: Geoapify rejects the ENTIRE request with HTTP 400 if
 * even one category is unknown, so a single typo silently disables
 * "Znajdź w okolicy" for any selection that includes the offending slug
 * (it falls back to the thinner Overpass path). This check fails loudly
 * instead — run it in CI or before shipping a mapping change.
 *
 *   npm run check:geoapify            # validate against vendored list
 *   npm run check:geoapify -- --refresh  # re-snapshot the taxonomy (needs GEOAPIFY_API_KEY)
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATEGORY_TO_GEOAPIFY } from "../src/infra/geocoder/geoapify-places";
import { GEOAPIFY_PLACE_CATEGORIES } from "../src/infra/geocoder/geoapify-categories";

const VENDORED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/infra/geocoder/geoapify-categories.ts",
);

/**
 * Fetch Geoapify's full supported-category list. Geoapify conveniently
 * returns the whole list in the 400 error body for an unknown category,
 * so one throwaway request gives us the source of truth.
 */
async function fetchSupportedCategories(apiKey: string): Promise<string[]> {
  const url =
    `https://api.geoapify.com/v2/places?filter=rect:0,0,0.01,0.01` +
    `&categories=__unknown__&apiKey=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as { message?: string };
  const message = body.message ?? "";
  const marker = "supported categories are:";
  const idx = message.indexOf(marker);
  if (idx === -1) {
    throw new Error(`Unexpected Geoapify response: ${message.slice(0, 200)}`);
  }
  return message
    .slice(idx + marker.length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

function writeVendoredFile(categories: string[]): void {
  const body = `/**
 * Vendored allowlist of valid Geoapify Places category strings.
 *
 * Source: the error payload Geoapify returns when given an unknown
 * category (GET /v2/places with categories=__unknown__) lists every
 * supported category. Snapshotted here so scripts/check-geoapify-categories.ts
 * can validate our CATEGORY_TO_GEOAPIFY mapping with no network call.
 *
 * Regenerate with: npm run check:geoapify -- --refresh
 * (requires GEOAPIFY_API_KEY). Last refreshed: snapshot of ${categories.length} categories.
 */
export const GEOAPIFY_PLACE_CATEGORIES: ReadonlySet<string> = new Set([
${categories.map((c) => `  ${JSON.stringify(c)},`).join("\n")}
]);
`;
  writeFileSync(VENDORED_PATH, body);
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");

  if (refresh) {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      console.error("✖ --refresh needs GEOAPIFY_API_KEY in the environment.");
      process.exit(1);
    }
    const categories = await fetchSupportedCategories(apiKey);
    writeVendoredFile(categories);
    console.log(`✓ Refreshed vendored taxonomy: ${categories.length} categories.`);
  }

  const invalid: Array<{ slug: string; category: string }> = [];
  for (const [slug, categories] of Object.entries(CATEGORY_TO_GEOAPIFY)) {
    for (const category of categories) {
      if (!GEOAPIFY_PLACE_CATEGORIES.has(category)) {
        invalid.push({ slug, category });
      }
    }
  }

  if (invalid.length > 0) {
    console.error("✖ CATEGORY_TO_GEOAPIFY contains unknown Geoapify categories:");
    for (const { slug, category } of invalid) {
      console.error(`    ${slug} → ${category}`);
    }
    console.error(
      "\nGeoapify 400s the whole request on any unknown category, " +
        "silently degrading nearby search. Fix the mapping or run " +
        "`npm run check:geoapify -- --refresh` if the taxonomy changed.",
    );
    process.exit(1);
  }

  const count = Object.values(CATEGORY_TO_GEOAPIFY).flat().length;
  console.log(`✓ All ${count} mapped Geoapify categories are valid.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

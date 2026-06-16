/**
 * One-off backfill: copy each user's OAuth avatar from `auth.users`
 * (raw_user_meta_data → avatar_url / picture) into `profiles.avatar_url`
 * wherever the profile column is still NULL.
 *
 * Why a script and not per-user self-heal: a user's Google avatar lives in
 * their auth metadata, which the app can only read from THAT user's own
 * session. The runtime self-heal (app layout) therefore fills each member
 * in only when they next open the app. This script runs with full DB access
 * (same connection as migrations), so it reads every user's metadata at once
 * and populates the whole group immediately — handy right after deploy so
 * other members' avatars show in the feed without waiting for them to log in.
 *
 * Dry-run by default (prints what would change). Pass `--apply` to write.
 *   npm run db:backfill-avatars            # dry-run
 *   npm run db:backfill-avatars -- --apply
 *
 * Idempotent + safe: guarded `WHERE avatar_url IS NULL`, so it never
 * clobbers a custom uploaded avatar and re-running reports 0 changes.
 */
import { sql } from "drizzle-orm";
import { db } from "../src/infra/db/client";

const APPLY = process.argv.includes("--apply");

async function main() {
  const candidates = await db.execute<{
    id: string;
    display_name: string;
    avatar_url: string;
  }>(sql`
    SELECT p.id,
           p.display_name,
           COALESCE(
             u.raw_user_meta_data->>'avatar_url',
             u.raw_user_meta_data->>'picture'
           ) AS avatar_url
      FROM profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE p.avatar_url IS NULL
       AND COALESCE(
             u.raw_user_meta_data->>'avatar_url',
             u.raw_user_meta_data->>'picture'
           ) IS NOT NULL
  `);

  for (const c of candidates) {
    console.log(`${c.display_name} (${c.id}) -> ${c.avatar_url}`);
  }

  if (APPLY && candidates.length > 0) {
    await db.execute(sql`
      UPDATE profiles p
         SET avatar_url = COALESCE(
               u.raw_user_meta_data->>'avatar_url',
               u.raw_user_meta_data->>'picture'
             )
        FROM auth.users u
       WHERE u.id = p.id
         AND p.avatar_url IS NULL
         AND COALESCE(
               u.raw_user_meta_data->>'avatar_url',
               u.raw_user_meta_data->>'picture'
             ) IS NOT NULL
    `);
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry-run"} — ${candidates.length} ${
      APPLY ? "profili zaktualizowanych" : "profili do uzupełnienia"
    }.`,
  );
  if (!APPLY && candidates.length > 0) {
    console.log("Uruchom z `-- --apply`, żeby zapisać zmiany.");
  }

  // Drizzle's pg pool keeps the process alive otherwise.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

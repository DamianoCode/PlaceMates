import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

// One pooled client per process. On Vercel serverless, `max: 1` avoids
// exhausting the Supabase transaction pooler across warm lambdas.
const client = postgres(url, {
  max: 1,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;

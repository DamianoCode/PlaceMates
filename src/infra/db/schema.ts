import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// PostGIS geography(Point, 4326). Stored as WKT on write, GeoJSON-ish
// reads are done via ST_AsGeoJSON in queries — raw column returns a hex
// EWKB string which we treat as opaque here.
export const geographyPoint = customType<{
  data: { lng: number; lat: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver({ lng, lat }) {
    return `SRID=4326;POINT(${lng} ${lat})`;
  },
});

// `rating_schema` shape:
//   [{ key: "taste", label: "Smak", min: 1, max: 5 }, ...]
export type RatingDimension = {
  key: string;
  label: string;
  min: number;
  max: number;
};

// Mirror of auth.users — we only keep display data. Keep in sync via
// a trigger (added in a post-migration SQL, see drizzle/migrations/).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_members_user_idx").on(t.userId),
  ],
);

export const groupInvites = pgTable("group_invites", {
  token: text("token").primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// group_id NULL = built-in (global). Otherwise custom to that group.
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    ratingSchema: jsonb("rating_schema").$type<RatingDimension[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // slug unique within a group; built-ins (group_id NULL) unique globally.
    // Postgres treats NULLs as distinct in unique indexes by default — we need
    // a partial index + a regular unique for the group-scoped case.
    uniqueIndex("categories_builtin_slug_uk")
      .on(t.slug)
      .where(sql`${t.groupId} IS NULL`),
    uniqueIndex("categories_group_slug_uk")
      .on(t.groupId, t.slug)
      .where(sql`${t.groupId} IS NOT NULL`),
  ],
);

// Canonical places: provider-agnostic identity for real-world lookups.
// External canonical (POI search / import) has (provider, external_id);
// local canonical (user pin-drop) has both NULL. Partial unique index
// on (provider, external_id) WHERE provider IS NOT NULL enforces dedupe
// only for external entries — local pin-drops are always distinct.
export const canonicalPlaces = pgTable(
  "canonical_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider"),
    externalId: text("external_id"),
    name: text("name").notNull(),
    location: geographyPoint("location").notNull(),
    // Our own category slug (e.g. "ice-cream"), not the raw OSM value,
    // so ranking filters compose with the rest of the app.
    categoryHint: text("category_hint"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  // Partial unique + GIST index added in raw SQL migration.
);

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    location: geographyPoint("location").notNull(),
    address: text("address"),
    osmId: text("osm_id"),
    canonicalPlaceId: uuid("canonical_place_id").references(
      () => canonicalPlaces.id,
      { onDelete: "set null" },
    ),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("places_group_idx").on(t.groupId),
    index("places_category_idx").on(t.categoryId),
    index("places_canonical_idx").on(t.canonicalPlaceId),
    // GIST index added in raw SQL migration (Drizzle has no GIST builder yet).
  ],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    visitedAt: timestamp("visited_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
  },
  (t) => [
    index("visits_place_idx").on(t.placeId),
    index("visits_user_idx").on(t.userId),
  ],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    dimensions: jsonb("dimensions").$type<Record<string, number>>().notNull(),
    overall: numeric("overall", { precision: 3, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ratings_place_user_uk").on(t.placeId, t.userId),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    // Cover / wizytówka — at most one true per place, enforced in the
    // service layer (clear others before setting).
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("photos_place_idx").on(t.placeId)],
);

export const wishlist = pgTable(
  "wishlist",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.userId] }),
    // Hot path: `wishlistedIds(userId)` filters by user. The PK
    // starts with place_id so a pure `WHERE user_id` query can't
    // use it — fell back to seq scan before this index.
    index("wishlist_user_idx").on(t.userId),
  ],
);

// Shared "do odwiedzenia" list at the GROUP level — every member
// sees and can edit it. Coexists with the personal `wishlist`
// (private to one user) so a place can be on either, both, or
// neither — the two lists answer different questions.
//
// Each pin is recorded once per (place, group) — duplicates within
// the same group collapse via the primary key. `addedBy` lets the
// UI attribute "added by Asia" without changing who owns the entry.
export const groupWishlist = pgTable(
  "group_wishlist",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.groupId] }),
    index("group_wishlist_group_idx").on(t.groupId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.userId] }),
    // Same pattern as wishlist — `favoriteIds(userId)` needs a
    // user-leading index since PK starts with place_id.
    index("favorites_user_idx").on(t.userId),
  ],
);

// Menu-like items (dishes, products, services) tied to a place. Every
// group member can add them; each user can give each item one score +
// note and attach photos.
export const placeItems = pgTable(
  "place_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("place_items_place_idx").on(t.placeId)],
);

export const itemRatings = pgTable(
  "item_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => placeItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // 1.0 – 5.0 with half-point resolution; numeric(2,1) covers that
    // without float rounding surprises.
    score: numeric("score", { precision: 2, scale: 1 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("item_ratings_item_user_uk").on(t.itemId, t.userId)],
);

export const itemPhotos = pgTable(
  "item_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => placeItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    // Cover / wizytówka — at most one true per item, enforced in the
    // service layer (clear others before setting). Same pattern as
    // photos.is_cover for places.
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("item_photos_item_idx").on(t.itemId)],
);

export const publicShares = pgTable("public_shares", {
  slug: text("slug").primaryKey(),
  ratingId: uuid("rating_id")
    .notNull()
    .references(() => ratings.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// Trip planner ----------------------------------------------------------
//
// A trip is a group-owned, ordered itinerary of places to visit. Stops
// can be marked as "completed" by any group member while the trip is
// underway — supports the "checking off as we go" UX.
//
// Lifecycle is implicit: a trip is "active" if it has any uncompleted
// stops AND (no planned date OR planned date is in the future). Past
// trips with everything done land in the archive section. We don't
// keep an explicit status field because every transition can be
// reconstructed from `completed_at` + `planned_for`.

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Optional target date — NULL means "open-ended planning". */
    plannedFor: timestamp("planned_for", { mode: "date", withTimezone: false }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trips_group_idx").on(t.groupId, t.plannedFor)],
);

// Push notifications -----------------------------------------------------
//
// One row per (user, browser/device). The Web Push protocol delivers
// to a unique `endpoint` per subscription; if the user reinstalls the
// PWA or revokes permission and grants again, we'll get a fresh
// subscription with a new endpoint and add another row. Old/dead
// endpoints get pruned when web-push returns 404/410.

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    /** Base64url-encoded public key from PushSubscription.getKey('p256dh'). */
    p256dh: text("p256dh").notNull(),
    /** Base64url-encoded auth secret from PushSubscription.getKey('auth'). */
    auth: text("auth").notNull(),
    /** UA string at time of subscribe — handy for "Twoje urządzenia"
     *  display in /me later. Optional. */
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Same endpoint shouldn't appear twice for the same user.
    // Different users CAN share an endpoint in theory (browser
    // re-cycling), but in practice it never happens — push services
    // mint a new endpoint per subscription.
    uniqueIndex("push_subscriptions_user_endpoint_uk").on(
      t.userId,
      t.endpoint,
    ),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

/**
 * Per-user notification preferences. Separate from `profiles` so the
 * mirrored auth.users trigger doesn't have to know about it. One row
 * per user; missing row = all defaults (everything on).
 */
export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  /** Ktoś z grupy ocenił miejsce, które user dodał. */
  rating: boolean("rating").notNull().default(true),
  /** Ktoś z grupy odhaczył stop w wspólnym planie. */
  stopCompleted: boolean("stop_completed").notNull().default(true),
  /** Ktoś z grupy dodał nowe miejsce. */
  newPlace: boolean("new_place").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Routing cache ----------------------------------------------------------
//
// Materialized routes from OpenRouteService — one row per
// (trip, profile). Recomputed when stops change (reorder / add /
// remove → cache invalidated explicitly). TTL 7 days as belt-and-
// suspenders in case some mutation path forgets to invalidate
// (e.g., place location edited via /places/[id]/edit doesn't yet
// know about trip routes; the staleness corrects itself within a
// week).
//
// One trip can have multiple cached profiles (auto/bike/walking) —
// composite PK rather than a surrogate id keeps upserts trivial.

export const tripRoutes = pgTable(
  "trip_routes",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    /** ORS profile slug: 'driving-car' | 'cycling-regular' | 'foot-walking'. */
    profile: text("profile").notNull(),
    /** GeoJSON LineString returned by ORS — JSONB so PostGIS isn't
     *  needed for read-only display. */
    geometry: jsonb("geometry").$type<GeoJSON.LineString>().notNull(),
    distanceM: integer("distance_m").notNull(),
    durationS: integer("duration_s").notNull(),
    /** Per-stop-pair leg stats from ORS. segments[i] = route from
     *  stop i to stop i+1. Used by TripMapInfoCard to show
     *  "Od poprzedniego: 3.2 km · 8 min" for each stop. Empty
     *  array for legacy rows from before this column existed. */
    segments: jsonb("segments")
      .$type<Array<{ distanceM: number; durationS: number }>>()
      .notNull()
      .default([]),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.profile] })],
);

export const tripStops = pgTable(
  "trip_stops",
  {
    /**
     * Own surrogate id rather than a composite (trip_id, place_id) PK.
     * Drag-drop reorder bulk-updates `sort_order` and an optimistic
     * client-side reshuffle is far easier when each row has a stable
     * id that doesn't depend on its content.
     */
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /**
     * Position within the trip. Sparse on purpose — bulk reorders
     * rewrite the whole sequence, so we don't need fractional indices
     * (yet). Ints are easier to reason about in optimistic UI.
     */
    sortOrder: integer("sort_order").notNull(),
    /** Optional time-of-day for this stop ("11:30 — kawa u Boska"). */
    plannedAtTime: text("planned_at_time"),
    /** Free-form note for this stop. */
    note: text("note"),
    /**
     * Group-level completion. Any member can toggle. NULL = pending,
     * timestamp = "we did this stop". `completedBy` keeps attribution
     * for the UI ("Asia odhaczyła") without needing to dig through
     * activity logs.
     */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trip_stops_trip_idx").on(t.tripId, t.sortOrder),
    // A place can't appear twice in the same trip — would confuse the
    // "checking off" UX (which one am I marking?).
    uniqueIndex("trip_stops_trip_place_uk").on(t.tripId, t.placeId),
    // Reverse lookup: `tripsContainingPlace(placeId)` for the
    // /places/[id] "in plans" affordance. The unique above starts
    // with trip_id so it can't serve a pure WHERE place_id query.
    index("trip_stops_place_idx").on(t.placeId),
  ],
);

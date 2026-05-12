CREATE TABLE "trip_routes" (
	"trip_id" uuid NOT NULL,
	"profile" text NOT NULL,
	"geometry" jsonb NOT NULL,
	"distance_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_routes_trip_id_profile_pk" PRIMARY KEY("trip_id","profile")
);
--> statement-breakpoint
ALTER TABLE "trip_routes" ADD CONSTRAINT "trip_routes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
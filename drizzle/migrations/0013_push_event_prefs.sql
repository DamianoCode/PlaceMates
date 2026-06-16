ALTER TABLE "notification_prefs" ADD COLUMN "photo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD COLUMN "trip" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD COLUMN "member" boolean DEFAULT true NOT NULL;
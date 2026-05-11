CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_stops_place_idx" ON "trip_stops" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist" USING btree ("user_id");
-- One-off Supabase setup for photo uploads. Run in Supabase SQL editor
-- or psql against your project.
--
-- Creates a public bucket "place-photos" if missing and attaches policies
-- that allow authenticated users to upload / read their own photos, plus
-- public read (so getPublicUrl works without signed URLs).

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

-- Public read: anyone can GET objects in this bucket (safe because the
-- app only exposes URLs through its authenticated place detail page).
drop policy if exists "place-photos read" on storage.objects;
create policy "place-photos read"
  on storage.objects for select
  using (bucket_id = 'place-photos');

-- Authenticated insert, scoped to a path prefix owned by the user:
-- "place-photos/<placeId>/<userId>/<timestamp>.<ext>".
drop policy if exists "place-photos insert" on storage.objects;
create policy "place-photos insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Owner-only delete.
drop policy if exists "place-photos delete" on storage.objects;
create policy "place-photos delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

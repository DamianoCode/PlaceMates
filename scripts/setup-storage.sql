-- One-off Supabase setup for photo + avatar uploads. Run in Supabase
-- SQL editor or psql against your project.
--
-- Re-running the script is safe — buckets/policies are idempotent.

---------------------------------------------------------------------
-- Bucket: place-photos (per-place images, public read)
---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

drop policy if exists "place-photos read" on storage.objects;
create policy "place-photos read"
  on storage.objects for select
  using (bucket_id = 'place-photos');

-- Authenticated insert scoped to "<placeId>/<userId>/..." so callers
-- can only write under their own user id.
drop policy if exists "place-photos insert" on storage.objects;
create policy "place-photos insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "place-photos delete" on storage.objects;
create policy "place-photos delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

---------------------------------------------------------------------
-- Bucket: avatars (one image per user, public read)
---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars read" on storage.objects;
create policy "avatars read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated insert/update/delete scoped to "<userId>/...". The
-- app uses upsert:true so update flows through as UPDATE — both
-- verbs need to be allowed.
drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update" on storage.objects;
create policy "avatars update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete" on storage.objects;
create policy "avatars delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

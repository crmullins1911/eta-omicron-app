-- Event photos / flyers (Events tab → + or Edit → "Add a photo"). Run once in the Supabase SQL editor. Safe to run again.
-- Paste the CONTENTS of this file into the editor (not the file name).

-- 1) Each event can have one photo. Stores the file's path in the event-photos bucket.
alter table public.events add column if not exists image_url text;

-- 2) A private bucket for event photos (10 MB per file, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do nothing;

-- 3) Signed-in brothers can see event photos.
drop policy if exists "Members can view event photos" on storage.objects;
create policy "Members can view event photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-photos');

-- 4) Only officers can upload, replace or remove event photos.
drop policy if exists "Officers can upload event photos" on storage.objects;
create policy "Officers can upload event photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos' and public.current_member_is_officer());

drop policy if exists "Officers can update event photos" on storage.objects;
create policy "Officers can update event photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-photos' and public.current_member_is_officer());

drop policy if exists "Officers can delete event photos" on storage.objects;
create policy "Officers can delete event photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos' and public.current_member_is_officer());

-- 5) Website visitors can see the photo of an event that's shown on the public website (and no other).
drop policy if exists "Public can view photos of website events" on storage.objects;
create policy "Public can view photos of website events"
  on storage.objects for select to anon
  using (
    bucket_id = 'event-photos'
    and exists (select 1 from public.events e where e.image_url = storage.objects.name and e.on_website)
  );

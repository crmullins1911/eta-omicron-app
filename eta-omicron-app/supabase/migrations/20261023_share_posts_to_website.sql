-- Share chosen feed posts to the public website (etaomicron.org News page).
-- Run once in the Supabase SQL editor. Safe to run again.

-- 1) A per-post "on the website" switch. Off by default: nothing is public until an officer shares it.
alter table public.posts add column if not exists on_website boolean not null default false;

-- 2) Website visitors can read only shared posts.
drop policy if exists "Public can read website posts" on public.posts;
create policy "Public can read website posts"
  on public.posts for select to anon
  using (on_website = true);
grant select on public.posts to anon;

-- 3) Officers can share or unshare any post (the app's switch). Other columns are not affected:
--    this policy only decides WHO may update; the app only sends on_website.
drop policy if exists "Officers can share posts to website" on public.posts;
create policy "Officers can share posts to website"
  on public.posts for update to authenticated
  using (exists (select 1 from public.members m where m.auth_user_id = auth.uid() and m.is_officer))
  with check (exists (select 1 from public.members m where m.auth_user_id = auth.uid() and m.is_officer));

-- 4) Website visitors can view the photo of a shared post (and no other feed photo).
drop policy if exists "Public can view photos of website posts" on storage.objects;
create policy "Public can view photos of website posts"
  on storage.objects for select to anon
  using (
    bucket_id = 'feed-photos'
    and exists (select 1 from public.posts p where p.image_url = storage.objects.name and p.on_website)
  );

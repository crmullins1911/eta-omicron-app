-- Feed photos → website Media page (Feed tab → "Add to Media" under a photo post).
-- Run once in the Supabase SQL editor. Safe to run again.
-- Paste the CONTENTS of this file into the editor (not the file name).
--
-- Needs the website's media setup first (eta-omicron-website: supabase/migrations/20261028_officer_media_upload.sql),
-- which creates the media_items table, the public "media" bucket and the officer upload rules.
-- When an officer adds a feed photo to the Media page, the app copies the photo into the "media"
-- bucket and adds a media_items row that remembers which post it came from.

do $$
declare id_type text;
begin
  if to_regclass('public.media_items') is null then
    raise exception 'media_items table not found. Run the website migration 20261028_officer_media_upload.sql first, then run this file again.';
  end if;

  -- Same type as posts.id (uuid or bigint), so the link matches whatever the posts table uses.
  select format_type(a.atttypid, a.atttypmod) into id_type
    from pg_attribute a
   where a.attrelid = 'public.posts'::regclass and a.attname = 'id';

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'media_items' and column_name = 'post_id') then
    execute format(
      'alter table public.media_items add column post_id %s references public.posts(id) on delete set null',
      id_type
    );
  end if;
end
$$;

-- A post can be on the Media page only once.
create unique index if not exists media_items_post_id_key on public.media_items (post_id) where post_id is not null;

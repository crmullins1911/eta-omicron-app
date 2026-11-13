-- Let officers add events from the app (Events tab → +). Run once in the Supabase SQL editor. Safe to run again.
-- Uses the current_member_is_officer() helper from 20261109_real_dues_schedule.sql (re-created here in case
-- that file hasn't been run).

create or replace function public.current_member_is_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_officer from public.members where auth_user_id = auth.uid() limit 1), false)
$$;
grant execute on function public.current_member_is_officer() to authenticated;

-- (Doesn't turn row-level security on or off — if it's already off, officers can already add events
-- and this policy simply waits in place.)
grant insert on public.events to authenticated;

drop policy if exists "Officers can add events" on public.events;
create policy "Officers can add events"
  on public.events for insert to authenticated
  with check (public.current_member_is_officer());

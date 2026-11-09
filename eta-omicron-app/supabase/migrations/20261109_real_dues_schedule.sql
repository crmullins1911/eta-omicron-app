-- Real dues schedule (Nov 2026). Run once in the Supabase SQL editor. Safe to run again.
-- members.dues_amount is each brother's annual dues — what Pay Dues charges through Stripe.
-- The app recognises his category from that amount (see src/dues.js).

-- 1) New brothers start as General Member ($428.00).
alter table public.members alter column dues_amount set default 428.00;

-- 2) Move everyone still on the old placeholder ($75 or blank) to General Member.
--    Life members are then set to their category from the Dues tab (officer view).
update public.members
   set dues_amount = 428.00
 where dues_amount is null or dues_amount = 75;

-- 3) Officers can set any brother's dues category from the app.
--    The officer check runs through a helper so the policy doesn't read members inside a members policy.
create or replace function public.current_member_is_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_officer from public.members where auth_user_id = auth.uid() limit 1), false)
$$;
grant execute on function public.current_member_is_officer() to authenticated;

drop policy if exists "Officers can update members" on public.members;
create policy "Officers can update members"
  on public.members for update to authenticated
  using (public.current_member_is_officer())
  with check (public.current_member_is_officer());

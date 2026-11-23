-- Partial dues payments (Nov 2026). Run once in the Supabase SQL editor. Safe to run again.
--
-- How it fits the existing setup:
--   * dues_payments keeps its meaning: one row = "paid in full for that year". The Members tab,
--     Dues tab and the Command Center stats all keep reading it unchanged.
--   * dues_installments is new: every payment toward a year's dues, partial or full, through
--     Stripe, Square, or recorded by an officer (cash/check/CashApp/PayPal).
--   * square_checkouts is new: which brother and year each Square payment link is for, so the
--     Square webhook can tell dues payments apart from ticket sales and in-person swipes.
--   * When a brother's installments for a year reach his members.dues_amount, a trigger adds his
--     dues_payments row, so he flips to "Paid" everywhere.
--
-- BEFORE RUNNING: dues_payments must accept an insert of just (member_id, year). If it has other
-- required columns (e.g. a NOT NULL stripe_session_id or amount), the trigger below will fail
-- loudly rather than silently — give those columns defaults or tell the webmaster.

-- 1) The installments table. member_id copies the type of members.id, whatever it is.
do $$
declare id_type text;
begin
  select format_type(atttypid, atttypmod) into id_type
    from pg_attribute
   where attrelid = 'public.members'::regclass and attname = 'id';

  execute format($t$
    create table if not exists public.dues_installments (
      id                bigint generated always as identity primary key,
      member_id         %1$s not null references public.members(id) on delete cascade,
      year              int  not null,
      amount            numeric(10,2) not null check (amount > 0),
      method            text not null,
      stripe_session_id text unique,
      square_payment_id text unique,
      note              text,
      recorded_by       %1$s references public.members(id) on delete set null,
      created_at        timestamptz not null default now()
    )$t$, id_type);
end $$;

-- If an earlier copy of this file was already run, bring the table up to date.
alter table public.dues_installments add column if not exists square_payment_id text unique;
alter table public.dues_installments drop constraint if exists dues_installments_method_check;
alter table public.dues_installments add constraint dues_installments_method_check
  check (method in ('stripe','square','cash','check','cashapp','paypal'));

create index if not exists dues_installments_member_year on public.dues_installments (member_id, year);

-- 2) Who can see and add installments.
--    Brothers see their own; officers see everyone's and can record cash/check/CashApp/PayPal.
--    Stripe and Square installments are written only by their webhooks (service role, which skips RLS).
--    Nobody edits or deletes from the app — fix mistakes in the SQL editor, so the record stays honest.
alter table public.dues_installments enable row level security;
grant select, insert on public.dues_installments to authenticated;

create or replace function public.current_member_is_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_officer from public.members where auth_user_id = auth.uid() limit 1), false)
$$;
grant execute on function public.current_member_is_officer() to authenticated;

drop policy if exists "Brothers see own installments, officers see all" on public.dues_installments;
create policy "Brothers see own installments, officers see all"
  on public.dues_installments for select to authenticated
  using (
    public.current_member_is_officer()
    or member_id in (select id from public.members where auth_user_id = auth.uid())
  );

drop policy if exists "Officers record offline payments" on public.dues_installments;
create policy "Officers record offline payments"
  on public.dues_installments for insert to authenticated
  with check (
    public.current_member_is_officer()
    and method in ('cash','check','cashapp','paypal')
    and stripe_session_id is null
    and square_payment_id is null
    and recorded_by in (select id from public.members where auth_user_id = auth.uid())
  );

-- 3) Mark "paid in full" once installments cover the year's dues.
create or replace function public.dues_installment_settle()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owed numeric;
  paid numeric;
begin
  select coalesce(dues_amount, 428.00) into owed from members where id = new.member_id;
  select coalesce(sum(amount), 0) into paid
    from dues_installments where member_id = new.member_id and year = new.year;

  if paid >= owed - 0.005
     and not exists (select 1 from dues_payments where member_id = new.member_id and year = new.year) then
    insert into dues_payments (member_id, year) values (new.member_id, new.year);
  end if;
  return new;
end $$;

drop trigger if exists dues_installment_settle on public.dues_installments;
create trigger dues_installment_settle
  after insert on public.dues_installments
  for each row execute function public.dues_installment_settle();

-- 4) Balance for the current year, per brother. The checkout function reads this (with the
--    service role) to check that a payment amount isn't more than what he still owes.
--    security_invoker makes the view follow the RLS rules above for app users.
create or replace view public.dues_balances with (security_invoker = true) as
select
  m.id                                              as member_id,
  extract(year from now())::int                     as year,
  coalesce(m.dues_amount, 428.00)                   as owed,
  coalesce(i.paid_so_far, 0)                        as paid_so_far,
  (dp.member_id is not null)                        as paid_in_full,
  case when dp.member_id is not null then 0
       else greatest(coalesce(m.dues_amount, 428.00) - coalesce(i.paid_so_far, 0), 0)
  end                                               as balance
from public.members m
left join (
  select member_id, sum(amount) as paid_so_far
    from public.dues_installments
   where year = extract(year from now())::int
   group by member_id
) i on i.member_id = m.id
left join (
  select distinct member_id
    from public.dues_payments
   where year = extract(year from now())::int
) dp on dp.member_id = m.id;

grant select on public.dues_balances to authenticated;

-- 5) Square payment links. Written and read only by the Square functions (service role);
--    RLS is on with no policies, so app users can't see or change them.
do $$
declare id_type text;
begin
  select format_type(atttypid, atttypmod) into id_type
    from pg_attribute
   where attrelid = 'public.members'::regclass and attname = 'id';

  execute format($t$
    create table if not exists public.square_checkouts (
      order_id          text primary key,
      payment_link_id   text not null,
      member_id         %1$s not null references public.members(id) on delete cascade,
      kind              text not null default 'dues' check (kind in ('dues')),
      year              int  not null,
      amount            numeric(10,2) not null check (amount > 0),
      created_at        timestamptz not null default now(),
      completed_at      timestamptz
    )$t$, id_type);
end $$;

alter table public.square_checkouts enable row level security;

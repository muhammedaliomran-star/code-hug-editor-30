-- Phase 0 (security review): close critical gaps. SQL only, no app changes.
-- Self-contained: defines its own trigger helper so a missing function
-- can never abort the whole script (which would roll back the drops above).
create or replace function public.sync_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.sync_set_updated_at() from public;
grant execute on function public.sync_set_updated_at() to authenticated;
grant execute on function public.sync_set_updated_at() to service_role;
--
-- 1. shipments: drop the permissive MVP policy. RLS is permissive-OR:
--    as long as "Allow authenticated full access to shipments" exists,
--    ANY authenticated user can read/write/delete ANYONE's shipments,
--    regardless of the restrictive "Users manage own shipments" policy.
--    carriers/zones permissives were already dropped in 20260823030000;
--    shipments was missed (only the storefront policy was dropped there).
drop policy if exists "Allow authenticated full access to shipments"
  on public.shipments;

-- 2. user_roles: remove self-manage. The "Users manage own roles" FOR ALL
--    policy lets any authenticated user INSERT/UPDATE/DELETE their own
--    role rows — i.e. grant themselves 'owner' — defeating every
--    has_role('owner') gate (admin_settings, team_invites, server fns).
--    "Users can view own roles" (SELECT) stays untouched.
--    Role assignment from now on: owner-gated server functions / service_role.
drop policy if exists "Users manage own roles"
  on public.user_roles;

-- Bootstrap: the very first owner. Without this, nobody could ever become
-- owner after the self-manage policy is gone (chicken-and-egg for new
-- installs). The check MUST bypass RLS, hence SECURITY DEFINER — a plain
-- policy subquery would only see the caller's own rows and could be fooled.
create or replace function public.no_owner_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.user_roles where role = 'owner');
$$;

revoke all on function public.no_owner_exists() from public;
grant execute on function public.no_owner_exists() to authenticated;

drop policy if exists "Bootstrap first owner" on public.user_roles;
create policy "Bootstrap first owner" on public.user_roles
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and role = 'owner'::public.app_role
    and public.no_owner_exists()
  );

-- 3. shifts: phantom table. staff-sync.ts pushes/pulls shifts via Supabase
--    (pushShift/pushCashShift/pushCashierShift + pullStaffFromCloud), but no
--    CREATE TABLE exists in any migration — so cloud shift sync silently
--    fails, backup/restore lists reference a missing table, and the atomic
--    restore_backup() would roll back on `insert into public.shifts`.
--    Create it with the exact columns the sync payloads use + standard
--    owner-scoped RLS + updated_at trigger + sync index.
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shift_number integer not null default 0,
  cashier_name text,
  opened_at timestamptz,
  closed_at timestamptz,
  opening_balance numeric not null default 0,
  expected_cash numeric not null default 0,
  actual_cash numeric not null default 0,
  cash_sales numeric not null default 0,
  electronic_sales numeric not null default 0,
  installment_sales numeric not null default 0,
  expenses numeric not null default 0,
  purchases numeric not null default 0,
  returns numeric not null default 0,
  variance numeric not null default 0,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The table may already exist live without some columns (created
-- out-of-band). Add every column the sync payloads use, idempotently.
alter table public.shifts add column if not exists user_id uuid;
alter table public.shifts add column if not exists shift_number integer not null default 0;
alter table public.shifts add column if not exists cashier_name text;
alter table public.shifts add column if not exists opened_at timestamptz;
alter table public.shifts add column if not exists closed_at timestamptz;
alter table public.shifts add column if not exists opening_balance numeric not null default 0;
alter table public.shifts add column if not exists expected_cash numeric not null default 0;
alter table public.shifts add column if not exists actual_cash numeric not null default 0;
alter table public.shifts add column if not exists cash_sales numeric not null default 0;
alter table public.shifts add column if not exists electronic_sales numeric not null default 0;
alter table public.shifts add column if not exists installment_sales numeric not null default 0;
alter table public.shifts add column if not exists expenses numeric not null default 0;
alter table public.shifts add column if not exists purchases numeric not null default 0;
alter table public.shifts add column if not exists returns numeric not null default 0;
alter table public.shifts add column if not exists variance numeric not null default 0;
alter table public.shifts add column if not exists status text not null default 'open';
alter table public.shifts add column if not exists notes text;
alter table public.shifts add column if not exists created_at timestamptz not null default now();
alter table public.shifts add column if not exists updated_at timestamptz not null default now();

alter table public.shifts enable row level security;

drop policy if exists "Users manage own shifts" on public.shifts;
create policy "Users manage own shifts" on public.shifts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at_shifts on public.shifts;
create trigger set_updated_at_shifts
  before update on public.shifts
  for each row execute function public.sync_set_updated_at();

create index if not exists idx_shifts_user_opened on public.shifts (user_id, opened_at desc);
create index if not exists idx_shifts_updated_at on public.shifts (updated_at);

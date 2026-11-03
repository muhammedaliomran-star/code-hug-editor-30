-- =============================================================
-- Phase 0 (audit remediation) — PIN hardening + shop_settings leak
-- =============================================================
-- This migration MUST be applied last (after BATCH_3 / 20260913040000).
-- It replaces the vulnerable PIN RPCs, so re-running those older scripts
-- afterwards would reintroduce the hole.
--
-- WHAT WAS WRONG
-- --------------
-- verify_admin_pin / verify_manager_pin / get_admin_pin_hash /
-- set_admin_pin / set_manager_pin all took `_user_id uuid` from the CALLER
-- and never compared it to auth.uid(). Combined with SECURITY DEFINER that
-- meant any authenticated user could:
--   * read another merchant's PIN hash   -> get_admin_pin_hash(<uuid>)
--   * brute-force it with no lockout     -> verify_*(<uuid>, pin)
--   * overwrite it                       -> set_manager_pin(<uuid>, pin)
-- Hashes were md5() with no salt: a 4-6 digit PIN is reversible instantly.
--
-- WHAT THIS DOES
-- --------------
--   1. removes the `anon` SELECT grant/policy on shop_settings
--      (the whole table of every merchant was world-readable)
--   2. removes the `_user_id` parameters — identity comes from auth.uid()
--   3. replaces md5() with bcrypt (pgcrypto)
--   4. adds per-account lockout: 5 failures -> 15 minutes
--   5. keeps legacy md5 rows working and upgrades them transparently
--      on the first successful verification (no forced PIN reset)
--   6. drops get_admin_pin_hash() entirely — nothing in the app calls it
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- 1. shop_settings: stop exposing every merchant to anonymous visitors
-- -------------------------------------------------------------
-- The public receipt page goes through the `getPublicReceipt` server
-- function, which uses the service_role client and bypasses RLS/grant
-- restrictions entirely. Nothing in the app needs anonymous access.
drop policy if exists "Public can read shop settings for receipts"
  on public.shop_settings;

revoke select on public.shop_settings from anon;
revoke all on public.shop_settings from anon;

-- -------------------------------------------------------------
-- 2. Columns for bcrypt + lockout
-- -------------------------------------------------------------
alter table public.admin_settings
  add column if not exists pin_algo text not null default 'md5',
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

alter table public.shop_settings
  add column if not exists manager_pin_algo text not null default 'md5',
  add column if not exists manager_pin_failed_attempts integer not null default 0,
  add column if not exists manager_pin_locked_until timestamptz;

-- -------------------------------------------------------------
-- 3. Drop the caller-supplied-identity versions
-- -------------------------------------------------------------
-- DROP (not just revoke): a leftover overload would keep accepting the
-- old `{_user_id, _pin}` shape and the vulnerability would survive.
drop function if exists public.get_admin_pin_hash(uuid);
drop function if exists public.verify_admin_pin(uuid, text);
drop function if exists public.verify_manager_pin(uuid, text);
drop function if exists public.set_admin_pin(uuid, text);
drop function if exists public.set_manager_pin(uuid, text);

-- -------------------------------------------------------------
-- 4. Admin PIN
-- -------------------------------------------------------------
create or replace function public.verify_admin_pin(_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  rec public.admin_settings%rowtype;
  ok boolean := false;
  attempts integer := 0;
begin
  -- No caller-supplied identity: the JWT decides who we are looking at.
  if uid is null then
    return false;
  end if;
  -- Deliberately no has_role() gate here: the admin_settings row is itself
  -- owner-only (its RLS policy + set_admin_pin both require 'owner'), so a
  -- role check would only risk locking out a legacy account whose
  -- user_roles row was never seeded.
  if _pin is null or btrim(_pin) = '' then
    return false;
  end if;

  select * into rec from public.admin_settings where user_id = uid;
  if not found then
    return false;
  end if;

  -- Locked out?
  if rec.pin_locked_until is not null and rec.pin_locked_until > now() then
    return false;
  end if;

  if coalesce(rec.pin_algo, 'md5') = 'bcrypt' then
    ok := rec.admin_pin_hash = crypt(btrim(_pin), rec.admin_pin_hash);
  else
    -- Legacy unsalted md5 row: verify once, then re-hash with bcrypt.
    ok := rec.admin_pin_hash = md5(btrim(_pin));
    if ok then
      update public.admin_settings
         set admin_pin_hash = crypt(btrim(_pin), gen_salt('bf', 10)),
             pin_algo = 'bcrypt'
       where user_id = uid;
    end if;
  end if;

  if ok then
    update public.admin_settings
       set pin_failed_attempts = 0,
           pin_locked_until = null
     where user_id = uid
       and (pin_failed_attempts <> 0 or pin_locked_until is not null);
    return true;
  end if;

  attempts := coalesce(rec.pin_failed_attempts, 0) + 1;
  update public.admin_settings
     set pin_failed_attempts = case when attempts >= 5 then 0 else attempts end,
         pin_locked_until =
           case when attempts >= 5 then now() + interval '15 minutes' else null end
   where user_id = uid;

  return false;
end;
$$;

create or replace function public.set_admin_pin(_new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_role(uid, 'owner') then
    raise exception 'Only owners can change admin PIN';
  end if;
  if _new_pin is null or btrim(_new_pin) !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  insert into public.admin_settings (
    user_id, admin_pin_hash, pin_algo, pin_failed_attempts, pin_locked_until
  ) values (
    uid, crypt(btrim(_new_pin), gen_salt('bf', 10)), 'bcrypt', 0, null
  )
  on conflict (user_id) do update
    set admin_pin_hash = excluded.admin_pin_hash,
        pin_algo = 'bcrypt',
        pin_failed_attempts = 0,
        pin_locked_until = null,
        updated_at = now();
end;
$$;

-- -------------------------------------------------------------
-- 5. Manager PIN
-- -------------------------------------------------------------
create or replace function public.verify_manager_pin(_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  rec record;
  ok boolean := false;
  attempts integer := 0;
begin
  if uid is null then
    return false;
  end if;
  if _pin is null or btrim(_pin) = '' then
    return false;
  end if;

  select manager_pin,
         coalesce(manager_pin_algo, 'md5') as algo,
         coalesce(manager_pin_failed_attempts, 0) as failed,
         manager_pin_locked_until as locked_until
    into rec
    from public.shop_settings
   where user_id = uid;

  if not found then
    return false;
  end if;
  if rec.manager_pin is null then
    -- No PIN configured must never mean "access granted".
    return false;
  end if;

  if rec.locked_until is not null and rec.locked_until > now() then
    return false;
  end if;

  if rec.algo = 'bcrypt' then
    ok := rec.manager_pin = crypt(btrim(_pin), rec.manager_pin);
  else
    ok := rec.manager_pin = md5(btrim(_pin));
    if ok then
      update public.shop_settings
         set manager_pin = crypt(btrim(_pin), gen_salt('bf', 10)),
             manager_pin_algo = 'bcrypt'
       where user_id = uid;
    end if;
  end if;

  if ok then
    update public.shop_settings
       set manager_pin_failed_attempts = 0,
           manager_pin_locked_until = null
     where user_id = uid
       and (manager_pin_failed_attempts <> 0 or manager_pin_locked_until is not null);
    return true;
  end if;

  attempts := rec.failed + 1;
  update public.shop_settings
     set manager_pin_failed_attempts = case when attempts >= 5 then 0 else attempts end,
         manager_pin_locked_until =
           case when attempts >= 5 then now() + interval '15 minutes' else null end
   where user_id = uid;

  return false;
end;
$$;

create or replace function public.set_manager_pin(_new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_role(uid, 'owner') then
    raise exception 'Only owners can change manager PIN';
  end if;
  if _new_pin is null or btrim(_new_pin) !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  update public.shop_settings
     set manager_pin = crypt(btrim(_new_pin), gen_salt('bf', 10)),
         manager_pin_algo = 'bcrypt',
         manager_pin_failed_attempts = 0,
         manager_pin_locked_until = null,
         updated_at = now()
   where user_id = uid;

  if not found then
    raise exception 'Shop settings not found for this account';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 6. Grants: no anon, no public, authenticated only
-- -------------------------------------------------------------
revoke all on function public.verify_admin_pin(text) from public, anon;
revoke all on function public.set_admin_pin(text) from public, anon;
revoke all on function public.verify_manager_pin(text) from public, anon;
revoke all on function public.set_manager_pin(text) from public, anon;

grant execute on function public.verify_admin_pin(text) to authenticated;
grant execute on function public.set_admin_pin(text) to authenticated;
grant execute on function public.verify_manager_pin(text) to authenticated;
grant execute on function public.set_manager_pin(text) to authenticated;

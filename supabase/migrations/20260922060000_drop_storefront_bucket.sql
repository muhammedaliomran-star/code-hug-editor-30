-- Phase 1 (security review): remove the orphaned storefront storage surface.
-- The storefront feature was deleted (tables + functions + code), but its
-- public bucket and 4 storage.objects policies survived. No live code reads
-- this bucket (verified: zero references in src/).

-- 1. Drop the orphaned policies
drop policy if exists "Public storefront product images are readable"
  on storage.objects;
drop policy if exists "Merchants upload storefront product images"
  on storage.objects;
drop policy if exists "Merchants update storefront product images"
  on storage.objects;
drop policy if exists "Merchants delete storefront product images"
  on storage.objects;

-- 2. NOTE: Supabase blocks direct DELETEs on storage.objects
-- (storage.protect_delete) — and a failure here would roll back the whole
-- batch. Dropping the 4 policies above is sufficient: with no SELECT policy
-- the orphaned objects become completely inaccessible. Delete the bucket
-- itself from Dashboard > Storage UI if desired (uses the Storage API).

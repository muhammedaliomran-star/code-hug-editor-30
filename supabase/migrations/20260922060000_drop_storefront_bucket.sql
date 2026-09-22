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

-- 2. Empty then delete the bucket (bucket delete requires it to be empty)
delete from storage.objects
where bucket_id = 'storefront-product-images';

delete from storage.buckets
where id = 'storefront-product-images';

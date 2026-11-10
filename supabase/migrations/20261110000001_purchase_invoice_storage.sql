-- Storage used by paper purchase-invoice attachments.
insert into storage.buckets (id, name, public)
values ('purchase-invoices', 'purchase-invoices', false)
on conflict (id) do update set public = false;

drop policy if exists "Users upload purchase invoices" on storage.objects;
create policy "Users upload purchase invoices"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read purchase invoices" on storage.objects;
create policy "Users read purchase invoices"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update purchase invoices" on storage.objects;
create policy "Users update purchase invoices"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete purchase invoices" on storage.objects;
create policy "Users delete purchase invoices"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

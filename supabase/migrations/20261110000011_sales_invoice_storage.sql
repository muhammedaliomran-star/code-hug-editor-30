-- Optional image/PDF attachment for sales invoices.
alter table public.invoices
  add column if not exists invoice_attachment_path text;

insert into storage.buckets (id, name, public)
values ('sales-invoices', 'sales-invoices', false)
on conflict (id) do nothing;

drop policy if exists "Users upload own sales invoice attachments" on storage.objects;
create policy "Users upload own sales invoice attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'sales-invoices' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users read own sales invoice attachments" on storage.objects;
create policy "Users read own sales invoice attachments"
on storage.objects for select to authenticated
using (bucket_id = 'sales-invoices' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own sales invoice attachments" on storage.objects;
create policy "Users delete own sales invoice attachments"
on storage.objects for delete to authenticated
using (bucket_id = 'sales-invoices' and (storage.foldername(name))[1] = auth.uid()::text);

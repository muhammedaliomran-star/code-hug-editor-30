-- Normalize purchase invoice attachments while keeping purchases.attachment_path
-- for backward compatibility with older clients.
create table if not exists public.purchase_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  storage_path text not null,
  original_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists purchase_attachments_purchase_idx
  on public.purchase_attachments(user_id, purchase_id, created_at);

alter table public.purchase_attachments enable row level security;
drop policy if exists "Users manage own purchase attachments" on public.purchase_attachments;
create policy "Users manage own purchase attachments" on public.purchase_attachments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.purchase_attachments to authenticated;
grant all on public.purchase_attachments to service_role;

-- Backfill legacy pipe-separated paths once. The unique guard prevents duplicates
-- when a migration is re-run in a hosted environment.
insert into public.purchase_attachments(user_id, purchase_id, storage_path, original_name)
select p.user_id, p.id, trim(path), split_part(trim(path), '/', -1)
from public.purchases p
cross join lateral unnest(string_to_array(coalesce(p.attachment_path, ''), '|')) as paths(path)
where nullif(trim(path), '') is not null
  and not exists (
    select 1 from public.purchase_attachments a
    where a.purchase_id = p.id and a.storage_path = trim(path)
  );

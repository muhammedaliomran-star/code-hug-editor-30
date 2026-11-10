-- Reversible operational archiving for purchase invoices.
alter table public.purchases
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id),
  add column if not exists archive_reason text;

create index if not exists purchases_user_archived_idx
  on public.purchases(user_id, archived, purchase_date desc);

create or replace function public.archive_purchase(
  p_purchase_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.purchases
    where id = p_purchase_id and user_id = auth.uid()
  ) then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;

  update public.purchases
  set archived = true,
      archived_at = now(),
      archived_by = auth.uid(),
      archive_reason = nullif(trim(p_reason), '')
  where id = p_purchase_id and user_id = auth.uid();
end;
$$;

create or replace function public.unarchive_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.purchases
    where id = p_purchase_id and user_id = auth.uid()
  ) then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;

  update public.purchases
  set archived = false,
      archived_at = null,
      archived_by = null,
      archive_reason = null
  where id = p_purchase_id and user_id = auth.uid();
end;
$$;

grant execute on function public.archive_purchase(uuid, text) to authenticated;
grant execute on function public.unarchive_purchase(uuid) to authenticated;

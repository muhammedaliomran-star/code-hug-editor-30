-- Sales invoices: archive and recycle bin without reversing accounting effects.
-- Archiving/removing a sale only hides it from operational views; stock, payments,
-- returns and cashbox history remain auditable and unchanged.

alter table public.invoices
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id),
  add column if not exists archive_reason text,
  add column if not exists deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists delete_reason text;

create index if not exists invoices_user_archived_idx
  on public.invoices(user_id, archived, created_at desc);
create index if not exists invoices_user_deleted_idx
  on public.invoices(user_id, deleted, created_at desc);

create or replace function public.archive_sale_invoice(p_invoice_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.invoices
     set archived = true, archived_at = now(), archived_by = auth.uid(),
         archive_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_invoice_id and user_id = auth.uid() and not deleted;
  if not found then raise exception 'الفاتورة غير موجودة أو موجودة في سلة المحذوفات'; end if;
end;
$$;

create or replace function public.restore_sale_invoice(p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.invoices
     set archived = false, archived_at = null, archived_by = null, archive_reason = null
   where id = p_invoice_id and user_id = auth.uid() and not deleted;
  if not found then raise exception 'الفاتورة المؤرشفة غير موجودة'; end if;
end;
$$;

create or replace function public.soft_delete_sale_invoice(p_invoice_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.invoices
     set deleted = true, deleted_at = now(), deleted_by = auth.uid(),
         delete_reason = nullif(trim(coalesce(p_reason, '')), ''),
         archived = false, archived_at = null, archived_by = null
   where id = p_invoice_id and user_id = auth.uid() and not deleted;
  if not found then raise exception 'الفاتورة غير موجودة أو موجودة بالفعل في سلة المحذوفات'; end if;
end;
$$;

create or replace function public.restore_deleted_sale_invoice(p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.invoices
     set deleted = false, deleted_at = null, deleted_by = null, delete_reason = null,
         archived = false, archived_at = null, archived_by = null, archive_reason = null
   where id = p_invoice_id and user_id = auth.uid() and deleted;
  if not found then raise exception 'الفاتورة غير موجودة في سلة المحذوفات'; end if;
end;
$$;

revoke all on function public.archive_sale_invoice(uuid, text) from public, anon;
revoke all on function public.restore_sale_invoice(uuid) from public, anon;
revoke all on function public.soft_delete_sale_invoice(uuid, text) from public, anon;
revoke all on function public.restore_deleted_sale_invoice(uuid) from public, anon;
grant execute on function public.archive_sale_invoice(uuid, text) to authenticated;
grant execute on function public.restore_sale_invoice(uuid) to authenticated;
grant execute on function public.soft_delete_sale_invoice(uuid, text) to authenticated;
grant execute on function public.restore_deleted_sale_invoice(uuid) to authenticated;

-- Reversible purchase deletion. Physical rows stay available for restore.
alter table public.purchases
  add column if not exists deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists delete_reason text;

create index if not exists purchases_user_deleted_idx
  on public.purchases(user_id, deleted, purchase_date desc);

drop function if exists public.delete_purchase_with_inventory(uuid);
create or replace function public.delete_purchase_with_inventory(
  p_purchase_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases;
  v_old record;
  v_stock public.stock_items;
begin
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;
  if v_purchase.deleted then
    raise exception 'الفاتورة موجودة بالفعل في سلة المحذوفات';
  end if;

  if v_purchase.status = 'posted' then
    for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
      select * into v_stock
      from public.stock_items
      where user_id = auth.uid() and name = v_old.name
      for update;

      if not found or v_stock.quantity < v_old.quantity then
        raise exception 'المخزون لا يسمح بحذف الفاتورة: %', v_old.name;
      end if;

      update public.stock_items
      set quantity = quantity - v_old.quantity, updated_at = now()
      where id = v_stock.id;

      insert into public.stock_movements (
        user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes
      ) values (
        auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost,
        p_purchase_id, 'نقل فاتورة الشراء إلى سلة المحذوفات'
      );
    end loop;
  end if;

  update public.purchases
  set deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = nullif(trim(p_reason), '')
  where id = p_purchase_id and user_id = auth.uid();
end;
$$;

create or replace function public.restore_purchase_from_trash(
  p_purchase_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases;
  v_item record;
  v_stock public.stock_items;
begin
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;
  if not v_purchase.deleted then
    raise exception 'الفاتورة ليست في سلة المحذوفات';
  end if;

  if v_purchase.status = 'posted' then
    for v_item in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
      select * into v_stock
      from public.stock_items
      where user_id = auth.uid() and name = v_item.name
      for update;

      if found then
        update public.stock_items
        set quantity = quantity + v_item.quantity,
            last_unit_cost = v_item.unit_cost,
            updated_at = now()
        where id = v_stock.id;
      else
        insert into public.stock_items (
          user_id, name, quantity, last_unit_cost, sale_price
        ) values (
          auth.uid(), v_item.name, v_item.quantity, v_item.unit_cost, 0
        ) returning * into v_stock;
      end if;

      insert into public.stock_movements (
        user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes
      ) values (
        auth.uid(), v_stock.id, 'purchase', v_item.quantity, v_item.unit_cost,
        p_purchase_id, 'استعادة فاتورة شراء من سلة المحذوفات'
      );
    end loop;
  end if;

  update public.purchases
  set deleted = false,
      deleted_at = null,
      deleted_by = null,
      delete_reason = null
  where id = p_purchase_id and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_purchase_with_inventory(uuid, text) to authenticated;
grant execute on function public.restore_purchase_from_trash(uuid) to authenticated;

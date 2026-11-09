-- Atomic stock adjustment: read + update + log in a single transaction.
-- Replaces the non-atomic 3-step adjustStock in src/lib/db.ts.
create or replace function public.adjust_stock_atomic(
  p_stock_item_id uuid,
  p_delta numeric,
  p_reason text,
  p_notes text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current numeric;
  v_next numeric;
  v_applied numeric;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'أدخل كمية التعديل'; end if;
  if p_reason is null or trim(p_reason) = '' then raise exception 'سبب التعديل مطلوب'; end if;

  select quantity into v_current
    from public.stock_items
   where id = p_stock_item_id and user_id = v_user
   for update;
  if not found then raise exception 'الصنف غير موجود'; end if;

  v_next := greatest(0, v_current + p_delta);
  v_applied := v_next - v_current;

  update public.stock_items
     set quantity = v_next, updated_at = now()
   where id = p_stock_item_id and user_id = v_user;

  insert into public.stock_adjustments (user_id, stock_item_id, delta, reason, notes)
    values (v_user, p_stock_item_id, v_applied, p_reason, nullif(trim(coalesce(p_notes, '')), ''));

  -- mirror in stock_movements ledger
  insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
    select v_user, p_stock_item_id, 'adjustment', v_applied, last_unit_cost, null, p_reason
      from public.stock_items
     where id = p_stock_item_id and user_id = v_user;

  return v_next;
end;
$$;

revoke all on function public.adjust_stock_atomic(uuid, numeric, text, text) from public, anon;
grant execute on function public.adjust_stock_atomic(uuid, numeric, text, text) to authenticated;

-- =============================================================
-- Phase 4 (audit remediation) — auto recompute invoice paid status
-- =============================================================
-- recalculate_invoice_paid() already exists (20260827130000) and is
-- called by the client after record/update/delete payment. But if a
-- payment row is inserted/updated/deleted by another path (sync, RPC,
-- manual SQL, or a future caller that forgets to call it), the invoice's
-- `paid`/`status` drifts. Make it a trigger so the invariant holds
-- regardless of the write path.
--
-- Also: recompute on invoice_items changes is NOT needed (items don't
-- affect `paid`, only `total`).
-- =============================================================

create or replace function public.trg_recompute_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_paid(old.invoice_id);
    return old;
  else
    perform public.recalculate_invoice_paid(new.invoice_id);
    -- if the payment moved to another invoice, recompute the old one too
    if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
      perform public.recalculate_invoice_paid(old.invoice_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists payments_recompute_paid on public.payments;
create trigger payments_recompute_paid
  after insert or update or delete on public.payments
  for each row execute function public.trg_recompute_invoice_paid();

-- Allow the trigger (security definer) to call recalculate_invoice_paid
-- (already granted to authenticated; the trigger runs as the table owner).

-- -------------------------------------------------------------
-- Grants (trigger function itself needs no grant, but be explicit)
-- -------------------------------------------------------------
revoke all on function public.trg_recompute_invoice_paid() from public, anon;
grant execute on function public.trg_recompute_invoice_paid() to authenticated;

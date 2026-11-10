-- Allow the complete invoice lifecycle while payment status remains derived from amounts.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft', 'held', 'paid', 'pending', 'cancelled', 'returned_partial', 'returned_full'));

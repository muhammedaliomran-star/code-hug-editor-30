-- Extend Supabase Realtime publication to cover customers and invoice_items,
-- so the Daily page (and other consumers) receive live updates for them.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.invoice_items;
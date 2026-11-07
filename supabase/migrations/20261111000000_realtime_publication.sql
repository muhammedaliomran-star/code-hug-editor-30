-- Enable Supabase Realtime for the tables consumed by the Daily page.
-- postgres_changes subscriptions only deliver events for tables that belong to
-- the supabase_realtime publication.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.return_records;
alter publication supabase_realtime add table public.daily_notes;
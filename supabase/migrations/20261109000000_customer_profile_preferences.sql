-- Customer profile preferences used by the new customer dialog.
alter table public.customers
  add column if not exists customer_segment text not null default 'regular',
  add column if not exists assigned_staff_id text,
  add column if not exists preferred_contact text not null default 'whatsapp',
  add column if not exists preferred_payment_method text not null default 'cash',
  add column if not exists debt_alert_threshold bigint not null default 0,
  add column if not exists due_notifications boolean not null default true,
  add column if not exists tags text[] not null default '{}';

comment on column public.customers.customer_segment is 'Customer classification: regular, vip, wholesale, retail, or new';
comment on column public.customers.assigned_staff_id is 'Local staff member id responsible for this customer';

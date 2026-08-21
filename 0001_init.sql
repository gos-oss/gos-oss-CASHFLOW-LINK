-- Cashflow 13 semanas — esquema inicial
-- Ejecutar en el SQL editor de Supabase, o vía `Supabase:apply_migration`.

create extension if not exists "pgcrypto";

create table if not exists public.cf_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  status text not null default 'proyectado' check (status in ('proyectado', 'real')),
  saldo_inicial numeric not null default 0,
  saldo_credimas numeric not null default 0,
  saldo_bancos numeric not null default 0,
  income jsonb not null default '{}'::jsonb,
  expense jsonb not null default '{}'::jsonb,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cf_weeks_week_start_idx on public.cf_weeks (week_start);

create table if not exists public.cf_custom_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  group_type text not null check (group_type in ('income', 'expense')),
  created_at timestamptz not null default now()
);

create or replace function public.cf_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cf_weeks_updated on public.cf_weeks;
create trigger trg_cf_weeks_updated
before update on public.cf_weeks
for each row execute function public.cf_set_updated_at();

-- RLS: herramienta interna de un solo equipo. Se habilita acceso completo
-- vía la clave "anon" (sin login). Si en el futuro se agrega autenticación,
-- reemplazar estas policies por reglas atadas a auth.uid().
alter table public.cf_weeks enable row level security;
alter table public.cf_custom_categories enable row level security;

drop policy if exists "cf_weeks_full_access" on public.cf_weeks;
create policy "cf_weeks_full_access" on public.cf_weeks
  for all using (true) with check (true);

drop policy if exists "cf_custom_categories_full_access" on public.cf_custom_categories;
create policy "cf_custom_categories_full_access" on public.cf_custom_categories
  for all using (true) with check (true);

-- =========================================================================
-- CASHFLOW LINK — Esquema integral de base de datos
-- Ejecutar en el SQL Editor de Supabase (o PostgreSQL)
-- =========================================================================

create extension if not exists "pgcrypto";

-- 1. Flujo de fondos y movimientos por semana / fecha
create table if not exists public.cashflow_weeks (
  id text primary key,
  week_start text not null,
  status text not null default 'proyectado',
  income jsonb not null default '{}'::jsonb,
  expense jsonb not null default '{}'::jsonb,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cashflow_weeks_start on public.cashflow_weeks (week_start);

-- 2. Configuraciones, arqueos de saldos y tipos de cambio (tc_)
create table if not exists public.cashflow_settings (
  id text primary key,
  fecha_corte text,
  saldo_efectivo numeric default 0,
  saldo_banco numeric default 0,
  tipo_cambio numeric default 1,
  updated_at timestamptz default now()
);
create index if not exists idx_cashflow_settings_corte on public.cashflow_settings (fecha_corte);

-- 3. Presupuesto anual y mapeo de categorías
create table if not exists public.cashflow_plan (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 4. Indicadores de la construcción CAC
create table if not exists public.cf_cac_indicadores (
  indicador text primary key,
  valor numeric not null,
  variacion numeric,
  mes text,
  updated_at timestamptz default now()
);

-- 5. Histórico de precios de Hormigón H-21
create table if not exists public.cf_h21_precios (
  id_mes text primary key,
  etiqueta text,
  valor numeric not null,
  updated_at timestamptz default now()
);

-- 6. Trigger automático para actualizar updated_at
create or replace function public.cf_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cashflow_weeks_updated on public.cashflow_weeks;
create trigger trg_cashflow_weeks_updated
before update on public.cashflow_weeks
for each row execute function public.cf_set_updated_at();

-- 7. Políticas de Seguridad (RLS) habilitadas con acceso completo para clave anónima
alter table public.cashflow_weeks enable row level security;
alter table public.cashflow_settings enable row level security;
alter table public.cashflow_plan enable row level security;
alter table public.cf_cac_indicadores enable row level security;
alter table public.cf_h21_precios enable row level security;

drop policy if exists "cashflow_weeks_full_access" on public.cashflow_weeks;
create policy "cashflow_weeks_full_access" on public.cashflow_weeks for all using (true) with check (true);

drop policy if exists "cashflow_settings_full_access" on public.cashflow_settings;
create policy "cashflow_settings_full_access" on public.cashflow_settings for all using (true) with check (true);

drop policy if exists "cashflow_plan_full_access" on public.cashflow_plan;
create policy "cashflow_plan_full_access" on public.cashflow_plan for all using (true) with check (true);

drop policy if exists "cf_cac_indicadores_full_access" on public.cf_cac_indicadores;
create policy "cf_cac_indicadores_full_access" on public.cf_cac_indicadores for all using (true) with check (true);

drop policy if exists "cf_h21_precios_full_access" on public.cf_h21_precios;
create policy "cf_h21_precios_full_access" on public.cf_h21_precios for all using (true) with check (true);

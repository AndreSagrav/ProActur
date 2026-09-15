-- ================================================================
-- ProActur AI - Esquema de Base de Datos para Supabase
-- Ejecuta este script en el SQL Editor de tu panel de Supabase:
-- https://supabase.com/dashboard/project/ssbulukhivrmynwqwtxo/sql
-- ================================================================

-- 1. Tabla principal de reuniones
create table if not exists public.meetings (
  id text primary key,
  title text not null,
  summary text,
  key_topics jsonb default '[]'::jsonb,
  key_decisions jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  proactive_advice jsonb default '[]'::jsonb,
  transcript text,
  tags jsonb default '[]'::jsonb,
  source text default 'audio',
  audio_size bigint,
  notion_sync jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Índice para ordenamiento rápido por fecha
create index if not exists idx_meetings_created_at on public.meetings (created_at desc);

-- 3. Habilitar Row Level Security (RLS)
alter table public.meetings enable row level security;

-- 4. Política de acceso completa para usuarios anónimos y autenticados (con service role o anon)
create policy "Acceso total a reuniones" on public.meetings
  for all
  using (true)
  with check (true);

-- 5. Trigger opcional para actualizar updated_at automáticamente
create or replace function public.handle_updated_at()
returns trigger as \$\$
begin
  new.updated_at = now();
  return new;
end;
\$\$ language plpgsql;

drop trigger if exists set_meetings_updated_at on public.meetings;
create trigger set_meetings_updated_at
  before update on public.meetings
  for each row
  execute function public.handle_updated_at();

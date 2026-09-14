-- ================================================================
-- Proactor AI - Tabla de Eventos / Agenda
-- Ejecuta en: https://supabase.com/dashboard/project/ssbulukhivrmynwqwtxo/sql
-- ================================================================

create table if not exists public.events (
  id text primary key,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  location text,
  color text default '#6366f1',
  meeting_id text references public.meetings(id) on delete set null,
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_events_start_time on public.events (start_time);
create index if not exists idx_events_meeting_id on public.events (meeting_id);

alter table public.events enable row level security;
create policy "Acceso total a eventos" on public.events
  for all using (true) with check (true);

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
  before update on public.events
  for each row
  execute function public.handle_updated_at();

-- ================================================================
-- ProActur AI - Tabla de Notas / Libreta
-- Ejecuta en: https://supabase.com/dashboard/project/ssbulukhivrmynwqwtxo/sql
-- ================================================================

create table if not exists public.notes (
  id text primary key,
  title text not null,
  content_text text,
  content_strokes jsonb,
  thumbnail_url text,
  mode text default 'keyboard',
  is_favorite boolean default false,
  is_locked boolean default false,
  tags jsonb default '[]'::jsonb,
  color text default '#6366f1',
  meeting_id text references public.meetings(id) on delete set null,
  event_id text references public.events(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notes_created_at on public.notes (created_at desc);
create index if not exists idx_notes_meeting_id on public.notes (meeting_id);
create index if not exists idx_notes_event_id on public.notes (event_id);
create index if not exists idx_notes_is_favorite on public.notes (is_favorite) where is_favorite = true;

create index if not exists idx_notes_fts on public.notes
  using gin (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content_text, '')));

alter table public.notes enable row level security;
create policy "Acceso total a notas" on public.notes
  for all using (true) with check (true);

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row
  execute function public.handle_updated_at();

-- ==============================================================================
-- PROACTUR AI - ESQUEMA INTEGRAL DE BASE DE DATOS EN LA NUBE (SUPABASE)
-- Ejecutar en el SQL Editor de tu panel de Supabase:
-- https://supabase.com/dashboard/project/ssbulukhivrmynwqwtxo/sql
-- ==============================================================================

-- 1. TABLA DE REUNIONES Y MINUTAS (Verificar existencia)
CREATE TABLE IF NOT EXISTS public.meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  key_topics JSONB DEFAULT '[]'::jsonb,
  key_decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  proactive_advice JSONB DEFAULT '[]'::jsonb,
  transcript TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'audio',
  audio_size BIGINT,
  notion_sync JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA DE EVENTOS Y AGENDA
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  color TEXT DEFAULT '#6366f1',
  meeting_id TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA DE NOTAS Y CUADERNO EJECUTIVO
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  paper_style TEXT DEFAULT 'blank',
  meeting_id TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA DE CUENTAS E INSTRUMENTOS BANCARIOS (FINANZAS)
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'debito' | 'credito' | 'efectivo'
  balance NUMERIC(15,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'MXN',
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA DE TRANSACCIONES Y MOVIMIENTOS CONTABLES
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'gasto' | 'ingreso'
  category TEXT NOT NULL,
  note TEXT,
  amount NUMERIC(15,2) NOT NULL,
  date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABLA DE TAREAS Y ACUERDOS
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'high' | 'medium' | 'low'
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending' | 'completed'
  source TEXT DEFAULT 'manual', -- 'meeting' | 'assistant' | 'manual'
  meeting_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD (RLS) - ACCESO TOTAL MULTIDISPOSITIVO (PC, TABLET, MÓVIL)
-- ==============================================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total meetings" ON public.meetings;
CREATE POLICY "Acceso total meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total events" ON public.events;
CREATE POLICY "Acceso total events" ON public.events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total notes" ON public.notes;
CREATE POLICY "Acceso total notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total finance_accounts" ON public.finance_accounts;
CREATE POLICY "Acceso total finance_accounts" ON public.finance_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total finance_transactions" ON public.finance_transactions;
CREATE POLICY "Acceso total finance_transactions" ON public.finance_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total tasks" ON public.tasks;
CREATE POLICY "Acceso total tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- SEMILLA INICIAL DE CUENTAS (SOLO SI ESTÁ VACÍA)
-- ==============================================================================
INSERT INTO public.finance_accounts (id, name, type, balance, currency, color)
VALUES
  ('acc_main', 'Cuenta Principal (Débito)', 'debito', 14250.00, 'MXN', '#10b981'),
  ('acc_cash', 'Efectivo en Caja', 'efectivo', 1800.00, 'MXN', '#f59e0b'),
  ('acc_card', 'Tarjeta de Crédito Corporativa', 'credito', -3200.00, 'MXN', '#6366f1')
ON CONFLICT (id) DO NOTHING;

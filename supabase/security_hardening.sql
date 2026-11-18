-- ==============================================================================
-- PROACTUR AI: ENDURECIMIENTO DE SEGURIDAD Y MIGRACIÓN TOTAL A SUPABASE
-- Ejecutar en Supabase -> SQL Editor
-- ==============================================================================

-- 1. Tabla dedicada para configuración segura y logs (reemplaza server/data/*.json)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar Row Level Security (RLS) en TODAS las tablas
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas abiertas anónimas ("USING (true)")
DROP POLICY IF EXISTS "Acceso total meetings" ON public.meetings;
DROP POLICY IF EXISTS "Acceso total events" ON public.events;
DROP POLICY IF EXISTS "Acceso total notes" ON public.notes;
DROP POLICY IF EXISTS "Acceso total finance_accounts" ON public.finance_accounts;
DROP POLICY IF EXISTS "Acceso total finance_transactions" ON public.finance_transactions;
DROP POLICY IF EXISTS "Acceso total tasks" ON public.tasks;
DROP POLICY IF EXISTS "Permitir todo en notes" ON public.notes;
DROP POLICY IF EXISTS "Acceso autenticado app_settings" ON public.app_settings;

-- 4. Cerrar acceso directo anónimo (el backend usa SUPABASE_SERVICE_ROLE_KEY que omite RLS de forma segura)
CREATE POLICY "Solo autenticados meetings" ON public.meetings
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo autenticados events" ON public.events
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo autenticados notes" ON public.notes
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo autenticados finance_accounts" ON public.finance_accounts
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo autenticados finance_transactions" ON public.finance_transactions
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo autenticados tasks" ON public.tasks
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- app_settings solo accesible desde el backend (service_role); denegado a clientes directos
CREATE POLICY "Solo backend service_role app_settings" ON public.app_settings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

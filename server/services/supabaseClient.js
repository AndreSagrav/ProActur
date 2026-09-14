const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseInstance = null;

function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const url = config.SUPABASE_URL;
  const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return supabaseInstance;
}

async function checkSupabaseStatus() {
  const client = getSupabaseClient();
  if (!client) {
    return { configured: false, tableReady: false, message: 'SUPABASE_URL o KEY no configuradas' };
  }

  try {
    const { data, error } = await client.from('meetings').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        return {
          configured: true,
          tableReady: false,
          message: "Conectado a Supabase, pero la tabla 'meetings' no ha sido creada aún."
        };
      }
      return {
        configured: true,
        tableReady: false,
        message: `Error consultando Supabase: ${error.message}`
      };
    }

    return {
      configured: true,
      tableReady: true,
      message: "Supabase conectado y tabla 'meetings' lista."
    };
  } catch (err) {
    return {
      configured: true,
      tableReady: false,
      message: `Error de red con Supabase: ${err.message}`
    };
  }
}

/**
 * Keep-Alive ping para evitar que Supabase free tier pause el proyecto por inactividad.
 * Ejecuta una consulta ligera y mide la latencia de respuesta.
 */
async function keepAliveSupabase() {
  const client = getSupabaseClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      configured: false,
      message: 'Supabase no esta configurado en variables de entorno.',
      latencyMs: 0,
      timestamp: new Date().toISOString()
    };
  }

  try {
    // Consulta de bajo costo que activa Postgres
    const { error, count } = await client
      .from('meetings')
      .select('id', { count: 'exact', head: true });

    const latencyMs = Date.now() - startTime;

    if (error && error.code !== 'PGRST205') {
      return {
        success: false,
        configured: true,
        message: `Error en probe de Supabase: ${error.message}`,
        latencyMs,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      configured: true,
      message: 'Supabase activo y respondiendo correctamente (Keep-Alive exitoso)',
      latencyMs,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      message: `Fallo de conexion Keep-Alive: ${err.message}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getSupabaseClient,
  checkSupabaseStatus,
  keepAliveSupabase
};
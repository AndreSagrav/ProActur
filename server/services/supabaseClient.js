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

module.exports = {
  getSupabaseClient,
  checkSupabaseStatus
};

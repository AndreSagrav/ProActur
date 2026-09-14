const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'meetings.json')
  : path.join(__dirname, '..', 'data', 'meetings.json');

class StorageService {
  constructor() {
    this.ensureLocalFileExists();
    this.useSupabase = true;
  }

  ensureLocalFileExists() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (err) {
      // Silencioso en entornos serverless donde el sistema de archivos es read-only
    }
  }

  // Mapear de formato JS (camelCase) a Supabase (snake_case)
  toSupabaseRow(m) {
    return {
      id: m.id,
      title: m.title || 'Reunión sin título',
      summary: m.summary || '',
      key_topics: m.keyTopics || [],
      key_decisions: m.keyDecisions || [],
      action_items: m.actionItems || [],
      proactive_advice: m.proactiveAdvice || [],
      transcript: m.transcript || '',
      tags: m.tags || [],
      source: m.source || 'audio',
      audio_size: m.audioSize || 0,
      notion_sync: m.notionSync || null,
      created_at: m.createdAt || new Date().toISOString()
    };
  }

  // Mapear de Supabase (snake_case) a formato JS (camelCase)
  fromSupabaseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      keyTopics: row.key_topics || [],
      keyDecisions: row.key_decisions || [],
      actionItems: row.action_items || [],
      proactiveAdvice: row.proactive_advice || [],
      transcript: row.transcript || '',
      tags: row.tags || [],
      source: row.source || 'audio',
      audioSize: row.audio_size || 0,
      notionSync: row.notion_sync || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // --- Fallback Local (meetings.json) ---
  getLocalMeetings() {
    try {
      this.ensureLocalFileExists();
      if (fs.existsSync(DATA_FILE)) {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(content || '[]');
      }
    } catch (err) {
      // Silencioso
    }
    return [];
  }

  saveLocalMeeting(meeting) {
    try {
      const meetings = this.getLocalMeetings();
      const idx = meetings.findIndex(m => m.id === meeting.id);
      if (idx >= 0) {
        meetings[idx] = { ...meetings[idx], ...meeting };
      } else {
        meetings.unshift(meeting);
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(meetings, null, 2), 'utf8');
    } catch (err) {
      // Silencioso en Vercel
    }
  }

  deleteLocalMeeting(id) {
    try {
      let meetings = this.getLocalMeetings();
      meetings = meetings.filter(m => m.id !== id);
      fs.writeFileSync(DATA_FILE, JSON.stringify(meetings, null, 2), 'utf8');
    } catch (err) {
      // Silencioso en Vercel
    }
  }

  // --- Métodos Públicos Híbridos (Async) ---

  async getAllMeetings() {
    const supabase = getSupabaseClient();
    if (supabase && this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(r => this.fromSupabaseRow(r));
        }

        if (error && error.code === 'PGRST205') {
          console.warn("[Storage] Tabla 'meetings' no existe en Supabase aún. Usando persistencia local.");
        } else if (error) {
          console.warn('[Storage] Error consultando Supabase:', error.message);
        }
      } catch (err) {
        console.warn('[Storage] Fallback a local por error Supabase:', err.message);
      }
    }

    return this.getLocalMeetings();
  }

  async getMeetingById(id) {
    const supabase = getSupabaseClient();
    if (supabase && this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return this.fromSupabaseRow(data);
        }
      } catch (err) {
        // Silencioso fallback
      }
    }

    const localList = this.getLocalMeetings();
    return localList.find(m => m.id === id) || null;
  }

  async saveMeeting(meeting) {
    const meetingId = meeting.id || 'meet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const normalized = {
      ...meeting,
      id: meetingId,
      createdAt: meeting.createdAt || new Date().toISOString()
    };

    // Intentar backup local
    this.saveLocalMeeting(normalized);

    // Guardar en Supabase Cloud
    const supabase = getSupabaseClient();
    if (supabase && this.useSupabase) {
      try {
        const row = this.toSupabaseRow(normalized);
        const { error } = await supabase
          .from('meetings')
          .upsert(row, { onConflict: 'id' });

        if (error) {
          console.warn('[Storage] Error al guardar en Supabase:', error.message);
        } else {
          console.log(`[Storage] Reunión ${meetingId} sincronizada con Supabase exitosamente.`);
        }
      } catch (err) {
        console.warn('[Storage] Error de red Supabase:', err.message);
      }
    }

    return normalized;
  }

  async updateMeeting(id, updates) {
    const current = await this.getMeetingById(id);
    if (!current) return null;

    const merged = { ...current, ...updates, id };

    this.saveLocalMeeting(merged);

    const supabase = getSupabaseClient();
    if (supabase && this.useSupabase) {
      try {
        const updatePayload = {};
        if (updates.actionItems !== undefined) updatePayload.action_items = updates.actionItems;
        if (updates.title !== undefined) updatePayload.title = updates.title;
        if (updates.summary !== undefined) updatePayload.summary = updates.summary;
        if (updates.keyDecisions !== undefined) updatePayload.key_decisions = updates.keyDecisions;
        if (updates.notionSync !== undefined) updatePayload.notion_sync = updates.notionSync;

        await supabase
          .from('meetings')
          .update(updatePayload)
          .eq('id', id);
      } catch (err) {
        console.warn('[Storage] Error actualizando reunión en Supabase:', err.message);
      }
    }

    return merged;
  }

  async deleteMeeting(id) {
    this.deleteLocalMeeting(id);

    const supabase = getSupabaseClient();
    if (supabase && this.useSupabase) {
      try {
        await supabase
          .from('meetings')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('[Storage] Error eliminando reunión en Supabase:', err.message);
      }
    }

    return true;
  }
}

module.exports = new StorageService();

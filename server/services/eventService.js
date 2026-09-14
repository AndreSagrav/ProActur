const { getSupabaseClient } = require('./supabaseClient');

class EventService {
  toSupabaseRow(e) {
    return {
      id: e.id,
      title: e.title || 'Evento sin titulo',
      description: e.description || '',
      start_time: e.startTime,
      end_time: e.endTime || null,
      location: e.location || '',
      color: e.color || '#6366f1',
      meeting_id: e.meetingId || null,
      tags: e.tags || [],
      created_at: e.createdAt || new Date().toISOString()
    };
  }

  fromSupabaseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location || '',
      color: row.color || '#6366f1',
      meetingId: row.meeting_id || null,
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getAllEvents(month, year) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      let query = supabase.from('events').select('*').order('start_time', { ascending: true });

      if (month !== undefined && year !== undefined) {
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
        query = query.gte('start_time', startDate).lte('start_time', endDate);
      }

      const { data, error } = await query;
      if (error) { console.warn('[Events] Error:', error.message); return []; }
      return (data || []).map(r => this.fromSupabaseRow(r));
    } catch (err) {
      console.warn('[Events] Fallback error:', err.message);
      return [];
    }
  }

  async getEventById(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) return null;
      return this.fromSupabaseRow(data);
    } catch (err) {
      return null;
    }
  }

  async createEvent(eventData) {
    const supabase = getSupabaseClient();
    const eventId = eventData.id || 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const normalized = { ...eventData, id: eventId, createdAt: new Date().toISOString() };

    if (!supabase) return normalized;

    try {
      const row = this.toSupabaseRow(normalized);
      const { error } = await supabase.from('events').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[Events] Error creando:', error.message);
      else console.log(`[Events] Evento ${eventId} creado.`);
    } catch (err) {
      console.warn('[Events] Error de red:', err.message);
    }

    return normalized;
  }

  async updateEvent(id, updates) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const payload = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.startTime !== undefined) payload.start_time = updates.startTime;
      if (updates.endTime !== undefined) payload.end_time = updates.endTime;
      if (updates.location !== undefined) payload.location = updates.location;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.meetingId !== undefined) payload.meeting_id = updates.meetingId;
      if (updates.tags !== undefined) payload.tags = updates.tags;

      const { data, error } = await supabase.from('events').update(payload).eq('id', id).select().single();
      if (error) { console.warn('[Events] Error actualizando:', error.message); return null; }
      return this.fromSupabaseRow(data);
    } catch (err) {
      console.warn('[Events] Error de red:', err.message);
      return null;
    }
  }

  async deleteEvent(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) { console.warn('[Events] Error eliminando:', error.message); return false; }
      return true;
    } catch (err) {
      return false;
    }
  }

  async linkMeeting(eventId, meetingId) {
    return this.updateEvent(eventId, { meetingId });
  }
}

module.exports = new EventService();

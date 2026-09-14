const { getSupabaseClient } = require('./supabaseClient');

class NoteService {
  toSupabaseRow(n) {
    return {
      id: n.id,
      title: n.title || 'Nota sin titulo',
      content_text: n.contentText || '',
      content_strokes: n.contentStrokes || null,
      thumbnail_url: n.thumbnailUrl || null,
      mode: n.mode || 'keyboard',
      is_favorite: n.isFavorite || false,
      is_locked: n.isLocked || false,
      tags: n.tags || [],
      color: n.color || '#6366f1',
      meeting_id: n.meetingId || null,
      event_id: n.eventId || null,
      created_at: n.createdAt || new Date().toISOString()
    };
  }

  fromSupabaseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      contentText: row.content_text || '',
      contentStrokes: row.content_strokes || null,
      thumbnailUrl: row.thumbnail_url || null,
      mode: row.mode || 'keyboard',
      isFavorite: row.is_favorite || false,
      isLocked: row.is_locked || false,
      tags: row.tags || [],
      color: row.color || '#6366f1',
      meetingId: row.meeting_id || null,
      eventId: row.event_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getAllNotes(filters = {}) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      let query = supabase.from('notes').select('*').order('updated_at', { ascending: false });

      if (filters.favorite) query = query.eq('is_favorite', true);
      if (filters.meetingLinked) query = query.not('meeting_id', 'is', null);
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,content_text.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) { console.warn('[Notes] Error:', error.message); return []; }
      return (data || []).map(r => this.fromSupabaseRow(r));
    } catch (err) {
      console.warn('[Notes] Fallback error:', err.message);
      return [];
    }
  }

  async getNoteById(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
      if (error) return null;
      return this.fromSupabaseRow(data);
    } catch (err) {
      return null;
    }
  }

  async createNote(noteData) {
    const supabase = getSupabaseClient();
    const noteId = noteData.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const normalized = { ...noteData, id: noteId, createdAt: new Date().toISOString() };

    if (!supabase) return normalized;

    try {
      const row = this.toSupabaseRow(normalized);
      const { error } = await supabase.from('notes').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[Notes] Error creando:', error.message);
      else console.log(`[Notes] Nota ${noteId} creada.`);
    } catch (err) {
      console.warn('[Notes] Error de red:', err.message);
    }

    return normalized;
  }

  async updateNote(id, updates) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const payload = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.contentText !== undefined) payload.content_text = updates.contentText;
      if (updates.contentStrokes !== undefined) payload.content_strokes = updates.contentStrokes;
      if (updates.thumbnailUrl !== undefined) payload.thumbnail_url = updates.thumbnailUrl;
      if (updates.mode !== undefined) payload.mode = updates.mode;
      if (updates.isFavorite !== undefined) payload.is_favorite = updates.isFavorite;
      if (updates.isLocked !== undefined) payload.is_locked = updates.isLocked;
      if (updates.tags !== undefined) payload.tags = updates.tags;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.meetingId !== undefined) payload.meeting_id = updates.meetingId;
      if (updates.eventId !== undefined) payload.event_id = updates.eventId;

      const { data, error } = await supabase.from('notes').update(payload).eq('id', id).select().single();
      if (error) { console.warn('[Notes] Error actualizando:', error.message); return null; }
      return this.fromSupabaseRow(data);
    } catch (err) {
      console.warn('[Notes] Error de red:', err.message);
      return null;
    }
  }

  async deleteNote(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) { console.warn('[Notes] Error eliminando:', error.message); return false; }
      return true;
    } catch (err) {
      return false;
    }
  }

  async toggleFavorite(id) {
    const note = await this.getNoteById(id);
    if (!note) return null;
    return this.updateNote(id, { isFavorite: !note.isFavorite });
  }
}

module.exports = new NoteService();

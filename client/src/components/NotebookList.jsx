import { useState, useEffect } from 'react';
import {
  Search, Plus, Star, Link2, Clock, PenTool, Keyboard, Lock, Trash2, Filter
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todas', icon: null },
  { key: 'favorite', label: 'Favoritas', icon: Star },
  { key: 'meeting', label: 'Con reunion', icon: Link2 },
  { key: 'recent', label: 'Recientes', icon: Clock },
];

export default function NotebookList({ onSelectNote, onNewNote }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  async function fetchNotes() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeFilter !== 'all' && activeFilter !== 'recent') params.set('filter', activeFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const url = `${API}/api/notes${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[NotebookList] Error:', err);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchNotes(); }, [activeFilter, searchQuery]);

  async function toggleFavorite(e, noteId) {
    e.stopPropagation();
    try {
      await fetch(`${API}/api/notes/${noteId}/favorite`, { method: 'PATCH' });
      fetchNotes();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteNote(e, noteId) {
    e.stopPropagation();
    if (!confirm('Eliminar esta nota?')) return;
    try {
      await fetch(`${API}/api/notes/${noteId}`, { method: 'DELETE' });
      fetchNotes();
    } catch (err) {
      console.error(err);
    }
  }

  const modeIcon = (mode) => {
    if (mode === 'handwriting') return <PenTool className="w-3 h-3 text-amber-400" />;
    if (mode === 'mixed') return <><Keyboard className="w-3 h-3 text-indigo-400" /><PenTool className="w-3 h-3 text-amber-400" /></>;
    return <Keyboard className="w-3 h-3 text-slate-500" />;
  };

  // Extracto de texto plano
  const getPreview = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').substring(0, 100) + (html.length > 100 ? '...' : '');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span className="text-base">📓</span>
            Mi Libreta
          </h3>
          <button
            onClick={onNewNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all ${
                activeFilter === f.key
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {f.icon && <f.icon className="w-3 h-3" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 mt-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Cargando notas...</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <div className="text-3xl mb-2">📓</div>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'No se encontraron notas.' : 'No hay notas todavia. Crea una para empezar.'}
            </p>
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              onClick={() => onSelectNote(note)}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800/60 transition-all cursor-pointer group relative overflow-hidden"
            >
              {/* Color indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: note.color || '#6366f1' }} />

              <div className="pl-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {modeIcon(note.mode)}
                    <span className="text-[11px] text-slate-400">
                      {new Date(note.updatedAt || note.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    {note.meetingId && <Link2 className="w-3 h-3 text-indigo-400" title="Vinculada a reunion" />}
                    {note.isLocked && <Lock className="w-3 h-3 text-amber-400" />}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => toggleFavorite(e, note.id)}
                      className={`p-1 rounded ${note.isFavorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${note.isFavorite ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => deleteNote(e, note.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                  {note.title}
                </h4>

                {note.contentText && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {getPreview(note.contentText)}
                  </p>
                )}

                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {note.tags.slice(0, 3).map(t => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold border"
                        style={{ borderColor: (note.color || '#6366f1') + '40', color: note.color || '#6366f1', backgroundColor: (note.color || '#6366f1') + '10' }}
                      >
                        {t}
                      </span>
                    ))}
                    {note.tags.length > 3 && <span className="text-[9px] text-slate-500">+{note.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

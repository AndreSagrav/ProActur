import { useState, useEffect } from 'react';
import {
  Search, Plus, Star, Link2, Clock, PenTool, Keyboard, Lock, Trash2, Filter, Palette, Sparkles, BookOpen
} from 'lucide-react';
import { CANVAS_STYLES, getCanvasStyle } from '../utils/canvasStyles';

const API = import.meta.env.VITE_API_URL || '';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todas las Libretas', icon: BookOpen },
  { key: 'favorite', label: 'Favoritas', icon: Star },
  { key: 'handwriting', label: 'Lápiz / Dibujo', icon: PenTool },
  { key: 'meeting', label: 'Con Reunión', icon: Link2 },
  { key: 'recent', label: 'Recientes', icon: Clock },
];

export default function NotebookList({ onSelectNote, onNewNote }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCanvasFilter, setSelectedCanvasFilter] = useState(null);
  const [showCanvasPicker, setShowCanvasPicker] = useState(false);

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
    if (!confirm('¿Deseas eliminar esta libreta?')) return;
    try {
      await fetch(`${API}/api/notes/${noteId}`, { method: 'DELETE' });
      fetchNotes();
    } catch (err) {
      console.error(err);
    }
  }

  const modeBadge = (mode) => {
    if (mode === 'handwriting') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <PenTool className="w-3 h-3" /> Lápiz
        </span>
      );
    }
    if (mode === 'mixed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <PenTool className="w-3 h-3" /> Mixto
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
        <Keyboard className="w-3 h-3" /> Teclado
      </span>
    );
  };

  const getPreview = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').substring(0, 110) + (html.length > 110 ? '...' : '');
  };

  // Filtrado adicional si se selecciona un estilo de canvas
  const filteredNotes = selectedCanvasFilter
    ? notes.filter(n => (n.color === selectedCanvasFilter || n.coverStyle === selectedCanvasFilter))
    : notes;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Action Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              Libretas y Lienzos Canvas
            </h2>
            <p className="text-xs text-slate-400">
              Colecciones visuales, notas manuscritas con lápiz y texto inteligente
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Boton Crear Libreta */}
            <button
              onClick={() => onNewNote()}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Libreta</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Rows */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en tus libretas..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTER_OPTIONS.map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                    activeFilter === f.key
                      ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas Styles Ribbon Bar */}
        <div className="pt-2 border-t border-slate-800/70 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            Estilos Canvas:
          </span>
          <button
            onClick={() => setSelectedCanvasFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
              selectedCanvasFilter === null
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos
          </button>
          {CANVAS_STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => setSelectedCanvasFilter(selectedCanvasFilter === style.id ? null : style.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-all ${
                selectedCanvasFilter === style.id
                  ? 'border-white text-white shadow-md scale-105'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: style.accentColor + '20',
                borderColor: selectedCanvasFilter === style.id ? style.accentColor : 'transparent'
              }}
              title={style.desc}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.accentColor }} />
              <span>{style.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Colorful Canvas Notebooks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {loading ? (
          <div className="col-span-full p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Cargando libretas canvas...</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl backdrop-blur">
            <div className="text-4xl mb-3">🎨</div>
            <h3 className="text-base font-bold text-slate-200">No hay libretas en esta vista</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No se encontraron libretas con ese criterio de búsqueda.'
                : 'Crea tu primera libreta con diseños de canvas artísticos y vistosos.'}
            </p>
            <button
              onClick={() => onNewNote()}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md"
            >
              + Crear Primera Libreta
            </button>
          </div>
        ) : (
          filteredNotes.map(note => {
            const canvas = getCanvasStyle(note.color || note.coverStyle);
            const dateStr = new Date(note.updatedAt || note.createdAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short'
            });

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note)}
                className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/20 flex flex-col border border-slate-800/90"
                style={{
                  minHeight: '260px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
                }}
              >
                {/* Book Spine (Lomo de encuadernación en relieve a la izquierda) */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-3.5 z-20 shadow-inner ${canvas.spineColor}`}
                  title="Encuadernación de lienzo"
                />

                {/* Cloth Ribbon Bookmark (Cinta marcapáginas cayendo desde la parte superior) */}
                <div
                  className={`absolute right-6 top-0 w-3 h-9 z-20 shadow-md rounded-b-sm transform group-hover:h-11 transition-all ${canvas.ribbonColor}`}
                />

                {/* Canvas Artistic Cover Background */}
                <div
                  className={`h-28 w-full bg-gradient-to-br ${canvas.bgGradient} relative p-4 pl-6 flex flex-col justify-between overflow-hidden`}
                >
                  {/* Subtle Canvas Pattern Overlay */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />

                  {/* Top Badges */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-black/40 text-white backdrop-blur-sm uppercase tracking-wider border border-white/20">
                      {canvas.badge}
                    </span>

                    {/* Actions: Favorite & Delete */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => toggleFavorite(e, note.id)}
                        className={`p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors ${
                          note.isFavorite ? 'text-amber-300' : 'text-white/80 hover:text-amber-300'
                        }`}
                        title={note.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorita'}
                      >
                        <Star className={`w-3.5 h-3.5 ${note.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      <button
                        onClick={(e) => deleteNote(e, note.id)}
                        className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/80 hover:text-red-300 hover:bg-red-500/40 transition-colors"
                        title="Eliminar libreta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Canvas Style Name */}
                  <div className="relative z-10 text-[11px] font-medium text-white/90 drop-shadow">
                    {canvas.name}
                  </div>
                </div>

                {/* Notebook Body / Content Plaque */}
                <div className="flex-1 bg-slate-900/95 p-4 pl-6 flex flex-col justify-between border-t border-white/10">
                  <div className="space-y-2">
                    {/* Header line: Mode & Date */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        {modeBadge(note.mode)}
                        {note.meetingId && (
                          <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                            <Link2 className="w-3 h-3" /> Reunión
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{dateStr}</span>
                    </div>

                    {/* Notebook Title */}
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {note.title || 'Libreta sin título'}
                    </h3>

                    {/* Preview snippet */}
                    {note.contentText && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {getPreview(note.contentText)}
                      </p>
                    )}
                  </div>

                  {/* Bottom Tags */}
                  <div className="pt-3 flex flex-wrap items-center gap-1.5 mt-auto">
                    {note.tags && note.tags.length > 0 ? (
                      note.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                          style={{
                            backgroundColor: canvas.accentColor + '15',
                            borderColor: canvas.accentColor + '40',
                            color: canvas.accentColor
                          }}
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Sin etiquetas</span>
                    )}

                    {note.tags && note.tags.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-bold">
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  X, Calendar, Clock, MapPin, Tag, Palette, Link2, Save, Trash2, Loader2
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const EVENT_COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Orange', value: '#f97316' },
];

export default function EventModal({ isOpen, onClose, event, initialDate, meetings = [], onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [meetingId, setMeetingId] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(event?.id);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setColor(event.color || '#6366f1');
      setLocation(event.location || '');
      setMeetingId(event.meetingId || '');
      setTags(event.tags || []);
      if (event.startTime) {
        const s = new Date(event.startTime);
        setStartDate(s.toISOString().split('T')[0]);
        setStartTime(s.toTimeString().slice(0, 5));
      }
      if (event.endTime) {
        const e2 = new Date(event.endTime);
        setEndDate(e2.toISOString().split('T')[0]);
        setEndTime(e2.toTimeString().slice(0, 5));
      }
    } else if (initialDate) {
      const d = initialDate instanceof Date ? initialDate : new Date(initialDate);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(d.toISOString().split('T')[0]);
      setTitle('');
      setDescription('');
      setColor('#6366f1');
      setLocation('');
      setMeetingId('');
      setTags([]);
    }
  }, [event, initialDate]);

  async function handleSave() {
    if (!title.trim() || !startDate) return;
    setSaving(true);

    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = endDate ? new Date(`${endDate}T${endTime}:00`).toISOString() : null;

    const payload = {
      title: title.trim(),
      description,
      startTime: startISO,
      endTime: endISO,
      location,
      color,
      meetingId: meetingId || null,
      tags,
    };

    try {
      const url = isEditing ? `${API}/api/events/${event.id}` : `${API}/api/events`;
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saved = await res.json();
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('[EventModal] Error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event?.id || !confirm('Eliminar este evento?')) return;
    try {
      await fetch(`${API}/api/events/${event.id}`, { method: 'DELETE' });
      onSaved?.(null);
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titulo del evento..."
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
          />

          {/* Date/Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Inicio</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors" />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 mt-1.5 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors" />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 mt-1.5 transition-colors" />
            </div>
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ubicacion o link de videollamada..."
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripcion (opcional)..."
            rows={3}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none transition-colors"
          />

          {/* Color Picker */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 block flex items-center gap-1">
              <Palette className="w-3 h-3" /> Color
            </label>
            <div className="flex gap-2">
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full transition-all hover:scale-110 ${
                    color === c.value ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-slate-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Link Meeting */}
          {meetings.length > 0 && (
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Vincular a reunion
              </label>
              <select
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">Sin vincular</option>
                {meetings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({new Date(m.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  {t}
                  <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="+ Tag"
                className="bg-transparent text-[10px] text-slate-300 outline-none w-16 placeholder-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800/60 bg-slate-900/50">
          {isEditing ? (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !startDate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isEditing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

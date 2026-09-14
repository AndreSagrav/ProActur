import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Save, Star, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Link, Image, Keyboard, PenTool,
  Tag, X, Loader2, Paperclip
} from 'lucide-react';
import HandwritingCanvas from './HandwritingCanvas';

const API = import.meta.env.VITE_API_URL || '';

const NOTE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#8b5cf6', '#ec4899'
];

export default function NoteEditor({ note, onSave, onClose, linkedMeeting, meetings = [] }) {
  const [title, setTitle] = useState(note?.title || '');
  const [mode, setMode] = useState(note?.mode || 'keyboard');
  const [contentText, setContentText] = useState(note?.contentText || '');
  const [contentStrokes, setContentStrokes] = useState(note?.contentStrokes || []);
  const [isFavorite, setIsFavorite] = useState(note?.isFavorite || false);
  const [tags, setTags] = useState(note?.tags || []);
  const [color, setColor] = useState(note?.color || '#6366f1');
  const [meetingId, setMeetingId] = useState(note?.meetingId || linkedMeeting?.id || '');
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const editorRef = useRef(null);
  const autoSaveTimer = useRef(null);

  const isNew = !note?.id;

  // Auto-save debounced
  useEffect(() => {
    if (isNew) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave(true);
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [contentText, contentStrokes, title, tags, isFavorite]);

  // Exec command para rich text
  function execCmd(cmd, value = null) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    updateContent();
  }

  function updateContent() {
    if (editorRef.current) {
      setContentText(editorRef.current.innerHTML);
    }
  }

  function insertHeading(level) {
    document.execCommand('formatBlock', false, `h${level}`);
    editorRef.current?.focus();
    updateContent();
  }

  async function handleSave(silent = false) {
    if (!title.trim()) return;
    if (!silent) setSaving(true);

    const noteData = {
      ...(note || {}),
      title: title.trim(),
      contentText: mode === 'keyboard' ? (editorRef.current?.innerHTML || contentText) : contentText,
      contentStrokes: mode === 'handwriting' ? contentStrokes : (note?.contentStrokes || null),
      mode,
      isFavorite,
      tags,
      color,
      meetingId: meetingId || null,
    };

    try {
      const url = note?.id ? `${API}/api/notes/${note.id}` : `${API}/api/notes`;
      const method = note?.id ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });

      const saved = await res.json();
      if (!silent && onSave) onSave(saved);
    } catch (err) {
      console.error('[NoteEditor] Error guardando:', err);
    }

    if (!silent) setSaving(false);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
    setShowTagInput(false);
  }

  function removeTag(t) {
    setTags(tags.filter(tag => tag !== t));
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-2 rounded-xl transition-all ${isFavorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
          >
            <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Title + Meta */}
      <div className="px-4 pt-4 pb-2 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titulo de la nota..."
          className="w-full bg-transparent text-xl font-bold text-slate-100 placeholder-slate-600 outline-none border-none"
        />

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{note?.createdAt ? new Date(note.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nueva nota'}</span>

          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-4 h-4 rounded-full border-2 border-slate-600 hover:border-slate-400 transition-colors"
              style={{ backgroundColor: color }}
            />
            {showColorPicker && (
              <div className="absolute top-6 left-0 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl p-2 flex gap-1.5 z-20 shadow-xl">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setShowColorPicker(false); }}
                    className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${color === c ? 'ring-2 ring-white/50 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
              style={{ borderColor: color + '40', color: color, backgroundColor: color + '15' }}
            >
              {t}
              <button onClick={() => removeTag(t)} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          {showTagInput ? (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setShowTagInput(false); }}
              onBlur={addTag}
              autoFocus
              placeholder="Tag..."
              className="bg-slate-800/60 border border-slate-700 rounded-full px-2 py-0.5 text-[10px] text-slate-200 outline-none w-20"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-500 border border-dashed border-slate-700 hover:border-slate-500 hover:text-slate-300 transition-colors"
            >
              <Tag className="w-2.5 h-2.5" /> Tag
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-slate-800/60">
        <button
          onClick={() => setMode('keyboard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all border-b-2 ${
            mode === 'keyboard' ? 'text-indigo-400 border-indigo-500' : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Keyboard className="w-4 h-4" /> Teclado
        </button>
        <button
          onClick={() => setMode('handwriting')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all border-b-2 ${
            mode === 'handwriting' ? 'text-indigo-400 border-indigo-500' : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <PenTool className="w-4 h-4" /> Escritura
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {mode === 'keyboard' ? (
          <>
            {/* Rich Text Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-800/40 bg-slate-900/40 overflow-x-auto">
              {[
                { icon: Bold, cmd: 'bold', label: 'Negrita' },
                { icon: Italic, cmd: 'italic', label: 'Cursiva' },
                { icon: Underline, cmd: 'underline', label: 'Subrayado' },
                { icon: Strikethrough, cmd: 'strikeThrough', label: 'Tachado' },
              ].map(b => (
                <button
                  key={b.cmd}
                  onClick={() => execCmd(b.cmd)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                  title={b.label}
                >
                  <b.icon className="w-4 h-4" />
                </button>
              ))}

              <div className="w-px h-5 bg-slate-700/50 mx-1" />

              <button onClick={() => execCmd('insertUnorderedList')} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors" title="Lista">
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => execCmd('insertOrderedList')} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors" title="Lista numerada">
                <ListOrdered className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-slate-700/50 mx-1" />

              <button onClick={() => insertHeading(1)} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">H1</button>
              <button onClick={() => insertHeading(2)} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">H2</button>

              <div className="w-px h-5 bg-slate-700/50 mx-1" />

              <button
                onClick={() => {
                  const url = prompt('URL del enlace:');
                  if (url) execCmd('createLink', url);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                title="Insertar enlace"
              >
                <Link className="w-4 h-4" />
              </button>
            </div>

            {/* Editor */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={updateContent}
              dangerouslySetInnerHTML={{ __html: contentText }}
              className="flex-1 overflow-y-auto px-4 py-4 text-sm text-slate-200 leading-relaxed outline-none prose prose-invert prose-sm max-w-none
                [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-100 [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-200 [&_h2]:mt-3 [&_h2]:mb-2
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-1
                [&_a]:text-indigo-400 [&_a]:underline
                [&_hr]:border-slate-700 [&_hr]:my-4"
              data-placeholder="Escribe tus notas aqui..."
              style={{ minHeight: 300 }}
            />
          </>
        ) : (
          <div className="flex-1 p-3 overflow-hidden">
            <HandwritingCanvas
              strokes={contentStrokes}
              onStrokesChange={setContentStrokes}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Meeting Link Bar */}
      {(meetingId || linkedMeeting) && (
        <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
            <span>Vinculada a:</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-semibold">
              {linkedMeeting?.title || meetings.find(m => m.id === meetingId)?.title || 'Reunion vinculada'}
            </span>
            <button onClick={() => setMeetingId('')} className="text-slate-500 hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

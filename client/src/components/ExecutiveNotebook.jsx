import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool, Keyboard, Sparkles, CheckCircle2, Table, GitBranch,
  Save, Trash2, X, Undo, Redo, ChevronDown, ChevronUp, BookOpen,
  CornerDownRight, Eraser, Highlighter, Edit3, Type, Check, Wand2
} from 'lucide-react';

const PAPER_STYLES = [
  { id: 'lined',       label: 'Oxford Marfil (Renglones)',  icon: '✍️' },
  { id: 'grid',        label: 'Cuadrícula 5mm (Técnico)',    icon: '⊞' },
  { id: 'dots',        label: 'Bullet Journal (Puntos)',    icon: '⁖' },
  { id: 'dark-velvet', label: 'Black Obsidian (Nocturno)',   icon: '✦' },
];

const INK_COLORS = [
  { id: 'black',    label: 'Negro Azabache', hex: '#111827' },
  { id: 'blue',     label: 'Azul Real',      hex: '#1e3a8a' },
  { id: 'emerald',  label: 'Verde Esmeralda',hex: '#065f46' },
  { id: 'burgundy', label: 'Burdeos',        hex: '#831843' },
  { id: 'amber',    label: 'Sepia Dorado',   hex: '#b45309' },
];

const PEN_WIDTHS = [
  { id: 'fine',   label: 'Fino',   val: 1.6 },
  { id: 'medium', label: 'Medio',  val: 2.8 },
  { id: 'broad',  label: 'Grueso', val: 4.5 },
];

export default function ExecutiveNotebook({
  initialContent = '',
  onContentChange,
  activeMeeting = null,
  isRecordingActive = false,
  recordingTime = 0,
  onSaveToNotes,
  onClose,
}) {
  // Estado del documento
  const [paperStyle, setPaperStyle] = useState('lined');
  const [toolMode, setToolMode]     = useState('fountain'); // 'fountain' | 'ballpoint' | 'highlighter' | 'eraser' | 'text'
  const [text, setText]             = useState(initialContent);
  const [ink, setInk]               = useState(INK_COLORS[0]);
  const [penWidth, setPenWidth]     = useState(2.8);
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [subjectTitle, setSubjectTitle] = useState(activeMeeting?.title || '');

  // Barra abatible (Collapsible Floating Toolbar)
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

  // Objetos ricos
  const [tables, setTables]   = useState([]);
  const [mindmaps, setMindmaps] = useState([]);

  // Motor de dibujo con canvas nativo de alta precisión
  const canvasRef   = useRef(null);
  const isDrawing   = useRef(false);
  const curPoints   = useRef([]);
  const [strokes, setStrokes] = useState([]);
  const [undoStack, setUndoStack] = useState([]);

  const containerRef = useRef(null);
  const textareaRef  = useRef(null);

  // Sincronizar texto
  useEffect(() => {
    if (onContentChange) onContentChange(text);
  }, [text, onContentChange]);

  // Bloquear scroll de fondo
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // ── Renderizado de un trazo con curvas suaves y físicas reales ─────
  const drawStrokePath = useCallback((ctx, stroke) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = stroke.width || 24;
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = stroke.color.startsWith('#')
        ? hexToRgba(stroke.color, 0.35)
        : stroke.color;
      ctx.lineWidth = 16;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
    }

    const pts = stroke.points;

    if (pts.length === 1) {
      // Punto o toque único (i, j, acentos)
      ctx.beginPath();
      const p = pts[0];
      const r = stroke.tool === 'eraser' ? 12 : stroke.tool === 'highlighter' ? 8 : (p.dynamicWidth || stroke.width) / 2;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Curvas Bézier suavizadas a través de puntos medios (Catmull-Rom / Streamline)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.lineWidth = pts[i].dynamicWidth || stroke.width;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }

    const last = pts[pts.length - 1];
    ctx.lineWidth = last.dynamicWidth || stroke.width;
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  // ── Redibujar todo el buffer del canvas ────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    strokes.forEach(s => drawStrokePath(ctx, s));
    ctx.restore();
  }, [strokes, drawStrokePath]);

  // ── Dimensionamiento milimétrico del Canvas (Retina 1:1) ───────────
  const initCanvasResolution = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width);
    const h = Math.max(Math.floor(rect.height), 1200);

    const neededW = Math.floor(w * dpr);
    const neededH = Math.floor(h * dpr);

    if (canvas.width !== neededW || canvas.height !== neededH) {
      canvas.width = neededW;
      canvas.height = neededH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    initCanvasResolution();
    window.addEventListener('resize', initCanvasResolution);
    return () => window.removeEventListener('resize', initCanvasResolution);
  }, [initCanvasResolution]);

  useEffect(() => {
    redrawCanvas();
  }, [strokes, redrawCanvas]);

  // ── Obtener coordenadas precisas 1:1 sin desfasamiento ─────────────
  const getPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, dynamicWidth: penWidth, time: Date.now() };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.5;
    const now = Date.now();

    let dynamicWidth = penWidth;
    if (toolMode === 'fountain') {
      // Física de pluma caligráfica viva: velocidad + presión
      if (curPoints.current.length > 0) {
        const last = curPoints.current[curPoints.current.length - 1];
        const dist = Math.hypot(x - last.x, y - last.y);
        const dt = Math.max(now - last.time, 1);
        const vel = dist / dt;
        dynamicWidth = penWidth * (0.7 + pressure * 0.5 - Math.min(vel * 0.05, 0.3));
      } else {
        dynamicWidth = penWidth * (0.8 + pressure * 0.4);
      }
      dynamicWidth = Math.max(0.8, Math.min(dynamicWidth, penWidth * 1.7));
    } else if (toolMode === 'ballpoint') {
      dynamicWidth = penWidth * (0.9 + pressure * 0.2);
    } else if (toolMode === 'highlighter') {
      dynamicWidth = 16;
    } else if (toolMode === 'eraser') {
      dynamicWidth = 24;
    }

    return { x, y, dynamicWidth, time: now };
  };

  // ── Handlers de puntero con captura continua y renderizado 60fps ───
  const handlePointerDown = (e) => {
    if (toolMode === 'text') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    isDrawing.current = true;
    const pt = getPoint(e);
    curPoints.current = [pt];

    // Dibuja el punto inicial en pantalla sin multiplicar escala
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawStrokePath(ctx, {
      tool: toolMode,
      color: ink.hex,
      width: penWidth,
      points: [pt]
    });
    ctx.restore();
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current || toolMode === 'text') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pt = getPoint(e);
    const pts = curPoints.current;
    pts.push(pt);

    // Dibujado instantáneo del segmento suavizado con punto medio
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (toolMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 24;
    } else if (toolMode === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = hexToRgba(ink.hex, 0.35);
      ctx.lineWidth = 16;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = ink.hex;
      ctx.lineWidth = pt.dynamicWidth || penWidth;
    }

    if (pts.length >= 3) {
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];
      const p0 = pts[pts.length - 3];
      const xc1 = (p0.x + p1.x) / 2;
      const yc1 = (p0.y + p1.y) / 2;
      const xc2 = (p1.x + p2.x) / 2;
      const yc2 = (p1.y + p2.y) / 2;

      ctx.beginPath();
      ctx.moveTo(xc1, yc1);
      ctx.quadraticCurveTo(p1.x, p1.y, xc2, yc2);
      ctx.stroke();
    } else if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && e.pointerId) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    if (curPoints.current.length > 0) {
      const newStroke = {
        id: Date.now() + Math.random(),
        tool: toolMode,
        color: ink.hex,
        width: penWidth,
        points: [...curPoints.current]
      };
      setStrokes(prev => [...prev, newStroke]);
      setUndoStack([]);
      curPoints.current = [];
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setUndoStack(prev => [...prev, last]);
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const next = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, next]);
  };

  const handleClearAllStrokes = () => {
    if (strokes.length === 0) return;
    if (window.confirm('¿Deseas limpiar todos los trazos manuscritos de la hoja?')) {
      setUndoStack(strokes);
      setStrokes([]);
    }
  };

  // ── CORRECCIÓN ORTOGRÁFICA Y CALIGRÁFICA EN TIEMPO REAL CON IA ────
  const correctSpellingAndStyle = async () => {
    if (!text.trim() || isCorrecting) return;
    setIsCorrecting(true);
    setSaveMsg('✨ Perfeccionando ortografía y redacción...');

    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Actúa como un corrector ortográfico y estilístico ejecutivo en español de máximo nivel.
Corrige inmediatamente todas las faltas de ortografía, tildes omitidas, puntuación y concordancia en el siguiente texto tomado en una libreta de notas.
PRESERVA exactamente el formato y significado original del usuario sin añadir saludos, explicaciones ni notas introductorias. Devuelve ÚNICAMENTE el texto corregido.

TEXTO:
${text}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          const cleanAnswer = data.answer.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
          setText(cleanAnswer);
          setSaveMsg('✓ Ortografía y redacción perfeccionadas');
        }
      }
    } catch (err) {
      console.warn('[Spellcheck error]', err);
      setSaveMsg('Error al conectar con corrector');
    } finally {
      setIsCorrecting(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  // ── Estructurar con IA ─────────────────────────────────────────────
  const structureWithAi = async () => {
    if (!text.trim() || isStructuring) return;
    setIsStructuring(true);
    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'Organiza y sintetiza las siguientes notas tomadas en el cuaderno ejecutivo: "' + text + '"'
        })
      });
      const data = await res.json();
      if (data.answer) {
        setText(prev => prev + '\n\n--- SÍNTESIS Y PLAN DE ACCIÓN IA ---\n' + data.answer);
      }
    } catch (e) {
      console.warn('Error IA:', e);
    } finally {
      setIsStructuring(false);
    }
  };

  // ── Tablas ─────────────────────────────────────────────────────────
  const insertTable = () => {
    setTables(prev => [...prev, {
      id: Date.now(),
      title: 'Matriz de Acuerdos',
      headers: ['Concepto', 'Responsable', 'Plazo', 'Estado'],
      rows: [['', '', '', ''], ['', '', '', '']]
    }]);
  };
  const removeTable = (id) => setTables(prev => prev.filter(t => t.id !== id));
  const addTableRow = (id) => {
    setTables(prev => prev.map(t =>
      t.id === id ? { ...t, rows: [...t.rows, ['', '', '', '']] } : t
    ));
  };
  const updateCell = (id, ri, ci, val) => {
    setTables(prev => prev.map(t => {
      if (t.id !== id) return t;
      const rows = [...t.rows];
      rows[ri] = [...rows[ri]];
      rows[ri][ci] = val;
      return { ...t, rows };
    }));
  };

  // ── Mapas Mentales ─────────────────────────────────────────────────
  const insertMindmap = () => {
    setMindmaps(prev => [...prev, {
      id: Date.now(),
      topic: subjectTitle || 'Estrategia Central',
      branches: [
        { id: 1, title: 'Pilar 1', items: ['Punto clave'] },
        { id: 2, title: 'Pilar 2', items: ['Acción directa'] },
        { id: 3, title: 'Pilar 3', items: ['Resultados'] },
      ]
    }]);
  };
  const removeMindmap = (id) => setMindmaps(prev => prev.filter(m => m.id !== id));

  // ── Guardar Nota ───────────────────────────────────────────────────
  const handleSave = () => {
    if (onSaveToNotes) {
      onSaveToNotes({
        title: subjectTitle ? 'Cuaderno: ' + subjectTitle : 'Nota ' + new Date().toLocaleDateString(),
        content: text,
        paperStyle,
        tables,
        mindmaps,
        hasHandwriting: strokes.length > 0,
      });
    }
    setSaveMsg('✓ Guardado en tu archivo de notas');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const paperClass = {
    lined:        'nb-paper-lined',
    grid:         'nb-paper-grid',
    dots:         'nb-paper-dots',
    'dark-velvet': 'nb-paper-dark',
  }[paperStyle] || 'nb-paper-lined';

  const isDark = paperStyle === 'dark-velvet';

  return (
    <div className="nb-fullscreen-overlay">
      <div className="nb-ambient-bg" />

      {/* =============================================================== */}
      {/* BARRA DE HERRAMIENTAS ABATIBLE (Collapsible Floating Island)    */}
      {/* =============================================================== */}
      <div className={`nb-floating-island-container ${isToolbarCollapsed ? 'nb-island-collapsed' : ''}`}>
        {!isToolbarCollapsed ? (
          <div className="nb-floating-island">
            {/* Izquierda: Salir, Título y Grabación */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="nb-island-btn text-rose-400 hover:bg-rose-500/10"
                title="Cerrar libreta y volver"
              >
                <X className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={subjectTitle}
                onChange={e => setSubjectTitle(e.target.value)}
                placeholder="Título de la nota..."
                className="nb-island-title-input"
              />

              {isRecordingActive && (
                <div className="nb-mini-rec-pill" title="Grabando en segundo plano">
                  <span className="nb-rec-dot" />
                  <span className="font-mono text-[11px]">
                    {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            <div className="nb-island-sep" />

            {/* Centro: Instrumentos de Escritura */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setToolMode('fountain')}
                className={`nb-tool-chip ${toolMode === 'fountain' ? 'nb-chip-active' : ''}`}
                title="Pluma Fuente (Caligrafía con variación de presión)"
              >
                <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Pluma</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('ballpoint')}
                className={`nb-tool-chip ${toolMode === 'ballpoint' ? 'nb-chip-active' : ''}`}
                title="Bolígrafo Fino (Trazo uniforme y certero)"
              >
                <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Bolígrafo</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('highlighter')}
                className={`nb-tool-chip ${toolMode === 'highlighter' ? 'nb-chip-active' : ''}`}
                title="Resaltador Ámbar"
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Resaltar</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('eraser')}
                className={`nb-tool-chip ${toolMode === 'eraser' ? 'nb-chip-active' : ''}`}
                title="Borrador suave"
              >
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Goma</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode('text');
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className={`nb-tool-chip ${toolMode === 'text' ? 'nb-chip-active' : ''}`}
                title="Teclado (Mecanografía sobre renglones)"
              >
                <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Teclado</span>
              </button>

              <button
                type="button"
                onClick={() => setPaperStyle(paperStyle === 'lined' ? 'dark-velvet' : 'lined')}
                className={`nb-tool-chip ${paperStyle === 'lined' ? 'border-amber-400/50 text-amber-200' : ''}`}
                title={paperStyle === 'lined' ? 'Actualmente en Papel Marfil Clásico. Haz clic para cambiar a Modo Obsidiana Nocturno' : 'Actualmente en Modo Nocturno. Haz clic para cambiar a Papel Marfil Clásico'}
              >
                <span>{paperStyle === 'lined' ? '📜 Marfil' : '✦ Obsidiana'}</span>
              </button>
            </div>

            <div className="nb-island-sep" />

            {/* Tintas y Grosores */}
            {toolMode !== 'eraser' && (
              <div className="flex items-center gap-1.5">
                {INK_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setInk(c)}
                    className={`nb-ink-circle ${ink.id === c.id ? 'nb-ink-selected' : ''}`}
                    style={{ backgroundColor: isDark && c.id === 'black' ? '#f1f5f9' : c.hex }}
                    title={c.label}
                  />
                ))}

                {toolMode !== 'text' && (
                  <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-700/60">
                    {PEN_WIDTHS.map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setPenWidth(w.val)}
                        className={`nb-width-dot ${penWidth === w.val ? 'nb-width-dot-active' : ''}`}
                        title={`Grosor ${w.label}`}
                      >
                        <span style={{ width: `${w.val * 2 + 1}px`, height: `${w.val * 2 + 1}px` }} className="rounded-full bg-current" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="nb-island-sep" />

            {/* Inteligencia Artificial y Herramientas */}
            <div className="flex items-center gap-1">
              {/* Botón de Corrección Ortográfica en Vivo */}
              <button
                type="button"
                onClick={correctSpellingAndStyle}
                disabled={isCorrecting || !text.trim()}
                className="nb-action-btn bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                title="Corregir ortografía, tildes y sintaxis con IA en 1 segundo"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline font-bold">{isCorrecting ? 'Corrigiendo...' : 'Corregir Ortografía'}</span>
              </button>

              <button
                type="button"
                onClick={structureWithAi}
                disabled={isStructuring || !text.trim()}
                className="nb-action-btn bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/40"
                title="Estructurar y generar plan de acción con IA"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">{isStructuring ? 'Procesando...' : 'Sello IA'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="nb-action-btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md"
                title="Guardar nota"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Guardar</span>
              </button>

              {/* Botón para ABATIR la barra hacia arriba */}
              <button
                type="button"
                onClick={() => setIsToolbarCollapsed(true)}
                className="nb-island-btn text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 ml-1"
                title="Abatir barra para escribir a pantalla completa sin obstáculos"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Pestaña Abatida Compacta (Mini Pill) */
          <div className="nb-island-minimized">
            <button
              type="button"
              onClick={() => setIsToolbarCollapsed(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all"
              title="Desplegar barra de herramientas"
            >
              <PenTool className="w-3.5 h-3.5 text-amber-400" />
              <span>Desplegar Herramientas</span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded-full bg-amber-500 text-slate-950 shadow-lg hover:bg-amber-400 transition-all active:scale-95"
              title="Guardar nota rápida"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-all active:scale-95"
              title="Cerrar libreta"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {saveMsg && (
        <div className="nb-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveMsg}</span>
        </div>
      )}

      {/* =============================================================== */}
      {/* ÁREA DE ESCRITURA INMERSIVA: PAPEL OXFORD CON RENGLONES LIMPIOS */}
      {/* =============================================================== */}
      <div className="nb-clean-desk">
        <div className={'nb-paper ' + paperClass} ref={containerRef}>
          {/* Margen rojo clásico de cuaderno escolar/ejecutivo */}
          {(paperStyle === 'lined' || paperStyle === 'dark-velvet') && (
            <div className="nb-margin-line" />
          )}

          {/* Encabezado sutil integrado directamente sobre el primer renglón */}
          <div className={'nb-paper-top-info ' + (isDark ? 'nb-paper-header-dark' : '')}>
            <span className="nb-paper-date">{dateStr}</span>
            {subjectTitle && <span className="nb-paper-subject font-serif">{subjectTitle}</span>}
          </div>

          {/* Tablas o Esquemas incrustados */}
          {tables.length > 0 && (
            <div className="nb-rich-objects">
              {tables.map(tbl => (
                <div key={tbl.id} className={'nb-embedded-table ' + (isDark ? 'nb-embed-dark' : '')}>
                  <div className="nb-embed-header">
                    <div className="nb-embed-title-row">
                      <Table className="w-3.5 h-3.5 text-indigo-400" />
                      <input type="text" defaultValue={tbl.title} className="nb-embed-title-input" />
                    </div>
                    <div className="nb-embed-actions">
                      <button type="button" onClick={() => addTableRow(tbl.id)} className="nb-embed-btn">+ Fila</button>
                      <button type="button" onClick={() => removeTable(tbl.id)} className="nb-embed-close"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <table className="nb-table">
                    <thead>
                      <tr>
                        {tbl.headers.map((h, i) => <th key={i}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {tbl.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>
                              <input
                                type="text"
                                value={cell}
                                onChange={e => updateCell(tbl.id, ri, ci, e.target.value)}
                                className="nb-cell-input"
                                placeholder="..."
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Superficie de Escritura de Alta Precisión */}
          <div className="nb-writing-surface">
            {/* Capa de Mecanografía con Corrección Ortográfica Nativa */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder=""
              spellCheck="true"
              lang="es"
              className={'nb-textarea ' + (isDark ? 'nb-textarea-dark' : '')}
              style={{
                color: isDark && ink.id === 'black' ? '#e2e8f0' : ink.hex,
                pointerEvents: toolMode === 'text' ? 'auto' : 'none',
              }}
            />

            {/* Capa de Tinta Digital Caligráfica de Alta Fidelidad */}
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="nb-canvas-overlay"
              style={{
                pointerEvents: toolMode === 'text' ? 'none' : 'auto',
                cursor: toolMode === 'eraser'
                  ? 'cell'
                  : toolMode === 'highlighter'
                  ? 'crosshair'
                  : 'crosshair',
              }}
            />
          </div>

          {/* Pie de Página */}
          <div className={'nb-paper-footer ' + (isDark ? 'nb-footer-dark' : '')}>
            <span>PROACTUR NOTEBOOK · OXFORD FINO</span>
            <span className="font-mono">CALIGRAFÍA 120 G/M²</span>
          </div>
        </div>
      </div>
    </div>
  );
}

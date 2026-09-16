import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool, Keyboard, Sparkles, CheckCircle2, Table, GitBranch,
  Save, Trash2, X, Undo, Redo, ChevronDown, BookOpen,
  CornerDownRight, Eraser, Highlighter, Edit3, Type
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
  { id: 'fine',   label: 'Fino',   val: 1.5 },
  { id: 'medium', label: 'Medio',  val: 2.5 },
  { id: 'broad',  label: 'Grueso', val: 4.2 },
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
  // Document state
  const [paperStyle, setPaperStyle] = useState('lined');
  const [toolMode, setToolMode]     = useState('fountain'); // 'fountain' | 'ballpoint' | 'highlighter' | 'eraser' | 'text'
  const [text, setText]             = useState(initialContent);
  const [ink, setInk]               = useState(INK_COLORS[0]);
  const [penWidth, setPenWidth]     = useState(2.5);
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [isStructuring, setIsStructuring] = useState(false);
  const [subjectTitle, setSubjectTitle] = useState(activeMeeting?.title || '');

  // Rich objects
  const [tables, setTables]   = useState([]);
  const [mindmaps, setMindmaps] = useState([]);

  // Drawing state
  const canvasRef   = useRef(null);
  const isDrawing   = useRef(false);
  const curStroke   = useRef([]);
  const [strokes, setStrokes] = useState([]);
  const [undoStack, setUndoStack] = useState([]);

  const containerRef = useRef(null);
  const textareaRef  = useRef(null);

  // Synchronize text changes
  useEffect(() => {
    if (onContentChange) onContentChange(text);
  }, [text, onContentChange]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Helper to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // ── Render a single stroke ─────────────────────────────────────────
  const drawSingleStroke = useCallback((ctx, stroke) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = stroke.width || 22;
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = stroke.color.startsWith('#')
        ? hexToRgba(stroke.color, 0.35)
        : stroke.color;
      ctx.lineWidth = 15;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    if (stroke.points.length === 1) {
      // Single tap / dot
      const p = stroke.points[0];
      ctx.beginPath();
      if (stroke.tool === 'eraser') {
        ctx.arc(p.x, p.y, (stroke.width || 22) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (stroke.tool === 'highlighter') {
        ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.arc(p.x, p.y, (p.dynamicWidth || stroke.width) / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // Smooth curve interpolation through midpoints
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.lineWidth = p1.dynamicWidth || stroke.width;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    const last = stroke.points[stroke.points.length - 1];
    ctx.lineWidth = last.dynamicWidth || stroke.width;
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  // ── Redraw entire canvas buffer ────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    strokes.forEach(s => drawSingleStroke(ctx, s));
    ctx.restore();
  }, [strokes, drawSingleStroke]);

  // ── Canvas Sizing with Retina Resolution ───────────────────────────
  const initCanvasResolution = useCallback(() => {
    const canvas = canvasRef.current;
    const paper = containerRef.current;
    if (!canvas || !paper) return;

    const rect = paper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width);
    const h = Math.max(Math.floor(rect.height), 1200);

    // Only re-dimension if size actually changed to avoid clearing during drawing
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

  // ── Pointer Coordinates (Pixel-perfect 1:1) ────────────────────────
  const getPointerPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, dynamicWidth: penWidth, time: Date.now() };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.5;
    const now = Date.now();

    let dynamicWidth = penWidth;
    if (toolMode === 'fountain') {
      // Dynamic calligraphy ink based on pressure & speed
      if (curStroke.current.length > 0) {
        const last = curStroke.current[curStroke.current.length - 1];
        const dist = Math.hypot(x - last.x, y - last.y);
        const dt = Math.max(now - last.time, 1);
        const vel = dist / dt;
        dynamicWidth = penWidth * (0.65 + pressure * 0.5 - Math.min(vel * 0.04, 0.25));
      } else {
        dynamicWidth = penWidth * (0.8 + pressure * 0.4);
      }
      dynamicWidth = Math.max(0.8, Math.min(dynamicWidth, penWidth * 1.8));
    } else if (toolMode === 'ballpoint') {
      dynamicWidth = penWidth * (0.85 + pressure * 0.3);
    } else if (toolMode === 'highlighter') {
      dynamicWidth = 15;
    } else if (toolMode === 'eraser') {
      dynamicWidth = 22;
    }

    return { x, y, dynamicWidth, time: now };
  };

  // ── Pointer Event Handlers ─────────────────────────────────────────
  const handlePointerDown = (e) => {
    if (toolMode === 'text') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    isDrawing.current = true;
    const pt = getPointerPoint(e);
    curStroke.current = [pt];

    // Immediate visual response
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawSingleStroke(ctx, {
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

    const pt = getPointerPoint(e);
    const pts = curStroke.current;
    pts.push(pt);

    // Incremental segment drawing
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);

    if (pts.length >= 2) {
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (toolMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = 22;
      } else if (toolMode === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = hexToRgba(ink.hex, 0.35);
        ctx.lineWidth = 15;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = ink.hex;
        ctx.lineWidth = p2.dynamicWidth || penWidth;
      }

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && e.pointerId) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    if (curStroke.current.length > 0) {
      const finishedStroke = {
        id: Date.now() + Math.random(),
        tool: toolMode,
        color: ink.hex,
        width: penWidth,
        points: [...curStroke.current]
      };
      setStrokes(prev => [...prev, finishedStroke]);
      setUndoStack([]); // Clear redo
      curStroke.current = [];
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
    if (window.confirm('¿Deseas borrar todos los trazos de tinta manuscrita de esta página?')) {
      setUndoStack(strokes);
      setStrokes([]);
    }
  };

  // ── Tablas ─────────────────────────────────────────────────────────
  const insertTable = () => {
    setTables(prev => [...prev, {
      id: Date.now(),
      title: 'Matriz de Acuerdos Ejecutivos',
      headers: ['Concepto / Decisión', 'Responsable', 'Plazo', 'Estado'],
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
      topic: subjectTitle || 'Estrategia Principal',
      branches: [
        { id: 1, title: 'Pilar Operativo', items: ['Acción prioritaria', 'Recursos'] },
        { id: 2, title: 'Impacto Comercial', items: ['Clientes clave', 'Entregables'] },
        { id: 3, title: 'Próximos Pasos', items: ['Seguimiento semana', 'Validación'] },
      ]
    }]);
  };
  const removeMindmap = (id) => setMindmaps(prev => prev.filter(m => m.id !== id));

  // ── IA Estructuración ──────────────────────────────────────────────
  const structureWithAi = async () => {
    if (!text.trim()) return;
    setIsStructuring(true);
    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'Organiza y sintetiza las siguientes notas tomadas en vivo en el cuaderno: "' + text + '"'
        })
      });
      const data = await res.json();
      if (data.answer) {
        setText(prev => prev + '\n\n--- SÍNTESIS Y ACCIONES IA ---\n' + data.answer);
      }
    } catch (e) {
      console.warn('Error IA:', e);
    } finally {
      setIsStructuring(false);
    }
  };

  // ── Guardar ────────────────────────────────────────────────────────
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
    setSaveMsg('Guardado con éxito');
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

      {/* Barra de Encabezado Ejecutiva */}
      <div className="nb-topbar">
        <div className="nb-topbar-left">
          <button
            type="button"
            onClick={onClose}
            className="nb-btn-icon nb-btn-close"
            title="Cerrar cuaderno y volver"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="nb-title-area">
            <input
              type="text"
              value={subjectTitle}
              onChange={e => setSubjectTitle(e.target.value)}
              placeholder="Asunto o Título de la Nota..."
              className="nb-title-input"
            />
            <span className="nb-date">{dateStr}</span>
          </div>
        </div>

        {/* Indicador de Grabación en 2do Plano */}
        {isRecordingActive && (
          <div className="nb-recording-pill" title="La grabación continúa en segundo plano">
            <span className="nb-rec-dot" />
            <span className="nb-rec-text">
              {'Grabando (' + Math.floor(recordingTime / 60) + ':' + String(recordingTime % 60).padStart(2, '0') + ')'}
            </span>
          </div>
        )}

        <div className="nb-topbar-right">
          <button
            type="button"
            onClick={structureWithAi}
            disabled={isStructuring || !text.trim()}
            className="nb-btn-action nb-btn-ai"
            title="Pulir ortografía, redacción y estructurar con IA"
          >
            <Sparkles className="w-4 h-4" />
            <span className="nb-btn-label">{isStructuring ? 'Procesando...' : 'Pulir con IA'}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="nb-btn-action nb-btn-save"
            title="Guardar nota en el repositorio permanente"
          >
            <Save className="w-4 h-4" />
            <span className="nb-btn-label">Guardar</span>
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className="nb-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveMsg}</span>
        </div>
      )}

      {/* Lienzo del Cuaderno */}
      <div className="nb-desk-area">
        {/* Lomo y Encuadernación con Anillas */}
        <div className="nb-spine">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="nb-spiral-ring" />
          ))}
        </div>

        {/* Hoja de Papel */}
        <div className={'nb-paper ' + paperClass} ref={containerRef}>
          {/* Margen rojo clásico en papel Oxford */}
          {(paperStyle === 'lined' || paperStyle === 'dark-velvet') && (
            <div className="nb-margin-line" />
          )}

          {/* Encabezado del Cuaderno */}
          <div className={'nb-paper-header ' + (isDark ? 'nb-paper-header-dark' : '')}>
            <span className="nb-paper-date">{dateStr}</span>
            {subjectTitle && <span className="nb-paper-subject">{subjectTitle}</span>}
          </div>

          {/* Barra Flotante de Instrumentos de Escritura */}
          <div className={'nb-paper-toolbar ' + (isDark ? 'nb-toolbar-dark' : '')}>
            {/* Modos de Instrumento */}
            <div className="nb-tool-group">
              <button
                type="button"
                onClick={() => setToolMode('fountain')}
                className={'nb-tool-btn ' + (toolMode === 'fountain' ? 'nb-tool-active' : '')}
                title="Pluma Fuente (Caligrafía con variación de presión y velocidad)"
              >
                <PenTool className="w-4 h-4" />
                <span className="text-[11px] font-bold hidden sm:inline">Pluma</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('ballpoint')}
                className={'nb-tool-btn ' + (toolMode === 'ballpoint' ? 'nb-tool-active' : '')}
                title="Bolígrafo Fino (Trazo certero y uniforme)"
              >
                <Edit3 className="w-4 h-4" />
                <span className="text-[11px] font-bold hidden sm:inline">Bolígrafo</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('highlighter')}
                className={'nb-tool-btn ' + (toolMode === 'highlighter' ? 'nb-tool-active' : '')}
                title="Resaltador / Marcador Ámbar"
              >
                <Highlighter className="w-4 h-4 text-amber-500" />
                <span className="text-[11px] font-bold hidden sm:inline">Resaltar</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('eraser')}
                className={'nb-tool-btn ' + (toolMode === 'eraser' ? 'nb-tool-active' : '')}
                title="Goma de Borrar trazos"
              >
                <Eraser className="w-4 h-4 text-rose-400" />
                <span className="text-[11px] font-bold hidden sm:inline">Borrador</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode('text');
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className={'nb-tool-btn ' + (toolMode === 'text' ? 'nb-tool-active' : '')}
                title="Teclado (Escribir mecanografiado sobre renglones)"
              >
                <Keyboard className="w-4 h-4" />
                <span className="text-[11px] font-bold hidden sm:inline">Teclado</span>
              </button>
            </div>

            <div className="nb-tool-divider" />

            {/* Grosores de Trazo */}
            {toolMode !== 'text' && toolMode !== 'eraser' && (
              <>
                <div className="nb-tool-group">
                  {PEN_WIDTHS.map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setPenWidth(w.val)}
                      className={'nb-width-btn ' + (penWidth === w.val ? 'nb-width-active' : '')}
                      title={'Grosor: ' + w.label}
                    >
                      <span
                        className="rounded-full bg-current"
                        style={{ width: `${w.val * 2 + 1}px`, height: `${w.val * 2 + 1}px` }}
                      />
                    </button>
                  ))}
                </div>
                <div className="nb-tool-divider" />
              </>
            )}

            {/* Paleta de Tintas */}
            {toolMode !== 'eraser' && (
              <>
                <div className="nb-tool-group">
                  {INK_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setInk(c)}
                      className={'nb-ink-dot ' + (ink.id === c.id ? 'nb-ink-active' : '')}
                      style={{ backgroundColor: isDark && c.id === 'black' ? '#f1f5f9' : c.hex }}
                      title={'Tinta: ' + c.label}
                    />
                  ))}
                </div>
                <div className="nb-tool-divider" />
              </>
            )}

            {/* Selector de Papel */}
            <div className="nb-tool-group nb-paper-picker">
              <button
                type="button"
                onClick={() => setShowPaperMenu(!showPaperMenu)}
                className="nb-tool-btn"
                title="Elegir textura de papel"
              >
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold hidden md:inline">Papel</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showPaperMenu && (
                <div className="nb-paper-menu">
                  {PAPER_STYLES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPaperStyle(p.id); setShowPaperMenu(false); }}
                      className={'nb-paper-option ' + (paperStyle === p.id ? 'nb-paper-selected' : '')}
                    >
                      <span className="text-base">{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="nb-tool-divider" />

            {/* Inserción de Objetos */}
            <button type="button" onClick={insertTable} className="nb-tool-btn" title="Insertar Matriz de Acuerdos">
              <Table className="w-4 h-4" />
              <span className="text-xs hidden lg:inline">Tabla</span>
            </button>
            <button type="button" onClick={insertMindmap} className="nb-tool-btn" title="Insertar Mapa Mental">
              <GitBranch className="w-4 h-4" />
              <span className="text-xs hidden lg:inline">Esquema</span>
            </button>

            {/* Acciones de Tinta */}
            {strokes.length > 0 && (
              <>
                <div className="nb-tool-divider" />
                <button type="button" onClick={handleUndo} className="nb-tool-btn" title="Deshacer trazo">
                  <Undo className="w-4 h-4" />
                </button>
                {undoStack.length > 0 && (
                  <button type="button" onClick={handleRedo} className="nb-tool-btn" title="Rehacer trazo">
                    <Redo className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearAllStrokes}
                  className="nb-tool-btn nb-tool-danger"
                  title="Limpiar tinta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Tablas y Mapas Mentales Incrustados */}
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

            {mindmaps.map(mm => (
              <div key={mm.id} className={'nb-embedded-mindmap ' + (isDark ? 'nb-embed-dark' : '')}>
                <div className="nb-embed-header">
                  <div className="nb-embed-title-row">
                    <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                    <span className="nb-embed-topic">{mm.topic}</span>
                  </div>
                  <button type="button" onClick={() => removeMindmap(mm.id)} className="nb-embed-close">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="nb-mindmap-grid">
                  {mm.branches.map(b => (
                    <div key={b.id} className="nb-mindmap-branch">
                      <h5 className="nb-branch-title">
                        <CornerDownRight className="w-3 h-3 text-indigo-400" />
                        {b.title}
                      </h5>
                      <ul className="nb-branch-items">
                        {b.items.map((s, idx) => (
                          <li key={idx}><span className="nb-branch-bullet" />{s || '...'}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Área de Escritura: Coexistencia de Mecanografía y Tinta Caligráfica */}
          <div className="nb-writing-surface">
            {/* Capa de Texto Mecanografiado */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Empieza a escribir sobre los renglones..."
              spellCheck="true"
              className={'nb-textarea ' + (isDark ? 'nb-textarea-dark' : '')}
              style={{
                color: isDark && ink.id === 'black' ? '#e2e8f0' : ink.hex,
                pointerEvents: toolMode === 'text' ? 'auto' : 'none',
              }}
            />

            {/* Capa de Tinta Digital (Canvas Caligráfico de Alta Precisión) */}
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

          {/* Pie de Página de Lujo */}
          <div className={'nb-paper-footer ' + (isDark ? 'nb-footer-dark' : '')}>
            <span>PROACTUR EXECUTIVE NOTEBOOK</span>
            <span className="font-mono">CALIGRAFÍA 120 G/M²</span>
          </div>
        </div>
      </div>
    </div>
  );
}

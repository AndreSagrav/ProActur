import React, { useState, useRef, useEffect } from 'react';
import {
  PenTool, Keyboard, Sparkles, CheckCircle2, Table, GitBranch,
  Save, RotateCcw, ZoomIn, ZoomOut, FileText, Download,
  Trash2, Plus, ArrowRight, CornerDownRight, Check, Brain,
  ChevronDown, Layout, ShieldCheck, AlertCircle, RefreshCw, BookOpen, X
} from 'lucide-react';

const PAPER_STYLES = [
  { id: 'lined', name: 'Renglones Oxford', desc: 'Líneas finas milimétricas con margen izquierdo suave' },
  { id: 'grid', name: 'Cuadrícula Ejecutiva', desc: 'Malla sutil de 5mm ideal para tablas y bocetos' },
  { id: 'dots', name: 'Puntos Bullet Journal', desc: 'Puntos espaciados para diagramación y libertad creativa' },
  { id: 'ivory', name: 'Marfil Editorial', desc: 'Papel liso satinado anti-reflejo' },
  { id: 'dark-velvet', name: 'Dark OLED Velvet', desc: 'Negro azabache con guías de contraste suave' }
];

export default function ExecutiveNotebook({
  initialContent = '',
  onContentChange,
  activeMeeting = null,
  isRecordingActive = false,
  recordingTime = 0,
  onSyncWithMeeting,
  onSaveToNotes
}) {
  const [paperStyle, setPaperStyle] = useState('lined');
  const [inputMode, setInputMode] = useState('keyboard'); // 'keyboard' | 'stylus'
  const [notebookText, setNotebookText] = useState(initialContent);
  const [penColor, setPenColor] = useState('#6366f1'); // Indigo ink
  const [penWidth, setPenWidth] = useState(2.5);
  const [inkSmoothing, setInkSmoothing] = useState(true); // Caligrafía Inteligente
  
  // Elementos enriquecidos insertados (tablas y mapas mentales)
  const [insertedTables, setInsertedTables] = useState([]);
  const [mindmapNodes, setMindmapNodes] = useState([]);
  const [isAiStructuring, setIsAiStructuring] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  // Canvas y trazos manuscritos
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef([]);
  const [strokes, setStrokes] = useState([]);

  useEffect(() => {
    if (onContentChange) {
      onContentChange(notebookText);
    }
  }, [notebookText, onContentChange]);

  // Dibujar y suavizar trazos en el Canvas (Ink Beautifier con curvas Bézier)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      strokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;

        if (inkSmoothing && stroke.points.length > 2) {
          // Suavizado Bézier inteligente para caligrafía limpia
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length - 1; i++) {
            const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
            const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
        } else {
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
        }
        ctx.stroke();
      });
    };

    render();
  }, [strokes, inkSmoothing]);

  // Manejadores de dibujo
  const startDrawing = (e) => {
    if (inputMode !== 'stylus') return;
    isDrawingRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    currentStrokeRef.current = [{ x, y }];
  };

  const draw = (e) => {
    if (!isDrawingRef.current || inputMode !== 'stylus') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    currentStrokeRef.current.push({ x, y });

    // Previsualización directa
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pts = currentStrokeRef.current;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length > 0) {
      setStrokes(prev => [...prev, {
        color: penColor,
        width: penWidth,
        points: currentStrokeRef.current
      }]);
      currentStrokeRef.current = [];
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
  };

  // Inserción de Tabla Ejecutiva
  const insertExecutiveTable = () => {
    const newTable = {
      id: Date.now(),
      title: 'Compromisos y Presupuesto',
      headers: ['Concepto / Acuerdo', 'Responsable', 'Plazo', 'Estado / Costo'],
      rows: [
        ['Lanzamiento de fase piloto', 'Equipo Técnico', 'Viernes 20', 'En Curso'],
        ['Revisión presupuestaria', 'Dirección', 'Lunes 23', 'Aprobado']
      ]
    };
    setInsertedTables(prev => [...prev, newTable]);
  };

  const removeTable = (tableId) => {
    setInsertedTables(prev => prev.filter(t => t.id !== tableId));
  };

  const addTableRow = (tableId) => {
    setInsertedTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          rows: [...t.rows, ['', '', '', '']]
        };
      }
      return t;
    }));
  };

  const updateTableCell = (tableId, rowIndex, colIndex, val) => {
    setInsertedTables(prev => prev.map(t => {
      if (t.id === tableId) {
        const newRows = [...t.rows];
        newRows[rowIndex] = [...newRows[rowIndex]];
        newRows[rowIndex][colIndex] = val;
        return { ...t, rows: newRows };
      }
      return t;
    }));
  };

  // Inserción de Mapa Mental
  const insertMindmap = () => {
    const newMindmap = {
      id: Date.now(),
      centralTopic: activeMeeting?.title || 'Estrategia Principal',
      branches: [
        { id: 1, title: 'Objetivos Clave', subitems: ['Entregas tempranas', 'Validación de usuario'] },
        { id: 2, title: 'Riesgos & Alertas', subitems: ['Tiempos de despliegue', 'Disponibilidad de API'] },
        { id: 3, title: 'Próximos Pasos', subitems: ['Reunión técnica', 'Envío de propuesta'] }
      ]
    };
    setMindmapNodes(prev => [...prev, newMindmap]);
  };

  const removeMindmap = (mindmapId) => {
    setMindmapNodes(prev => prev.filter(m => m.id !== mindmapId));
  };

  // Estructuración mágica de notas con IA
  const autoStructureWithAi = async () => {
    if (!notebookText.trim()) return;
    setIsAiStructuring(true);
    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Estructura las siguientes notas en formato de mapa mental y tabla de acuerdos concisa: "${notebookText}"`
        })
      });
      const data = await res.json();
      if (data.answer) {
        setNotebookText(prev => prev + '\n\n---\n### 💡 Estructura Estratégica Sugerida por IA:\n' + data.answer);
      }
    } catch (e) {
      console.warn('Error auto-estructurando con IA:', e);
    } finally {
      setIsAiStructuring(false);
    }
  };

  const handleSaveNote = () => {
    if (onSaveToNotes) {
      onSaveToNotes({
        title: activeMeeting?.title ? `Notas: ${activeMeeting.title}` : `Libreta Ejecutiva ${new Date().toLocaleDateString()}`,
        content: notebookText,
        paperStyle,
        tables: insertedTables,
        mindmaps: mindmapNodes
      });
    }
    setSaveSuccessMessage('¡Guardado exitosamente!');
    setTimeout(() => setSaveSuccessMessage(''), 3000);
  };

  // Fondo según el estilo de papel seleccionado
  const getPaperBackground = () => {
    switch (paperStyle) {
      case 'lined':
        return {
          background: 'linear-gradient(to bottom, transparent 31px, rgba(99, 102, 241, 0.12) 32px)',
          backgroundSize: '100% 32px',
          lineHeight: '32px'
        };
      case 'grid':
        return {
          backgroundImage: 'linear-gradient(to right, rgba(99, 102, 241, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          lineHeight: '24px'
        };
      case 'dots':
        return {
          backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.25) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          lineHeight: '28px'
        };
      case 'ivory':
        return {
          backgroundColor: '#0c0f17',
          lineHeight: '28px'
        };
      case 'dark-velvet':
        return {
          backgroundColor: '#020617',
          lineHeight: '28px'
        };
      default:
        return {};
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[720px]">
      {/* Barra Superior del Cuaderno Fino */}
      <div className="bg-slate-950/90 border-b border-slate-800/90 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                Cuaderno Ejecutivo Digital
              </h2>
              {isRecordingActive && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-black uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Grabando e IA Activa ({Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Escritura fina, caligrafía suave y diagramación ejecutiva inteligente
            </p>
          </div>
        </div>

        {/* Selector de Entrada: Teclado vs Stylus */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => setInputMode('keyboard')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                inputMode === 'keyboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Teclado</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('stylus')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                inputMode === 'stylus'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>Stylus / Lápiz</span>
            </button>
          </div>

          {/* Selector de Estilo de Papel */}
          <select
            value={paperStyle}
            onChange={(e) => setPaperStyle(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 shadow-sm"
          >
            {PAPER_STYLES.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de Herramientas de Inserción Enriquecida */}
      <div className="bg-slate-950/60 border-b border-slate-800/70 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center flex-wrap gap-2">
          {/* Insertar Tabla */}
          <button
            type="button"
            onClick={insertExecutiveTable}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-indigo-300 font-bold transition-all hover:border-indigo-500/50 shadow-sm"
          >
            <Table className="w-3.5 h-3.5 text-indigo-400" />
            <span>Insertar Tabla</span>
          </button>

          {/* Insertar Mapa Mental */}
          <button
            type="button"
            onClick={insertMindmap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-purple-300 font-bold transition-all hover:border-purple-500/50 shadow-sm"
          >
            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
            <span>Mapa Mental</span>
          </button>

          {/* Auto-estructurar con IA */}
          <button
            type="button"
            onClick={autoStructureWithAi}
            disabled={isAiStructuring || !notebookText.trim()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/40 text-slate-100 font-bold transition-all disabled:opacity-40 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{isAiStructuring ? 'Estructurando con IA...' : 'Organizar con IA'}</span>
          </button>
        </div>

        {/* Opciones de Caligrafía Inteligente cuando está en modo Stylus */}
        {inputMode === 'stylus' ? (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={inkSmoothing}
                onChange={(e) => setInkSmoothing(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Caligrafía Suave</span>
            </label>

            <div className="flex items-center gap-1">
              {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#f8fafc'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPenColor(c)}
                  className={`w-4 h-4 rounded-full border transition-all ${
                    penColor === c ? 'scale-125 ring-2 ring-white' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={clearCanvas}
              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              title="Limpiar trazos"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {saveSuccessMessage && (
              <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                <Check className="w-3.5 h-3.5" />
                {saveSuccessMessage}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Notas</span>
            </button>
          </div>
        )}
      </div>

      {/* Cuerpo Principal del Cuaderno Fino */}
      <div className="relative flex-1 p-6 sm:p-8 flex flex-col overflow-y-auto min-h-[500px]" style={getPaperBackground()}>
        {/* Margen vertical izquierdo característico de libreta ejecutiva fina */}
        <div className="absolute top-0 bottom-0 left-6 sm:left-12 w-[1px] bg-red-500/20 pointer-events-none" />

        {/* Tablas Insertadas */}
        {insertedTables.map(tbl => (
          <div key={tbl.id} className="mb-6 pl-4 sm:pl-10 relative group">
            <div className="bg-slate-950/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-indigo-400" />
                  <input
                    type="text"
                    defaultValue={tbl.title}
                    className="bg-transparent font-bold text-sm text-slate-200 focus:outline-none focus:text-indigo-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addTableRow(tbl.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg text-[11px] font-bold transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Fila
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTable(tbl.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      {tbl.headers.map((h, i) => (
                        <th key={i} className="py-2 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-3">
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => updateTableCell(tbl.id, rIdx, cIdx, e.target.value)}
                              className="bg-transparent text-slate-200 w-full focus:outline-none focus:text-white"
                              placeholder="..."
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {/* Mapas Mentales y Esquemas */}
        {mindmapNodes.map(mm => (
          <div key={mm.id} className="mb-6 pl-4 sm:pl-10 relative">
            <div className="bg-slate-950/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-sm text-purple-200">{mm.centralTopic}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeMindmap(mm.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {mm.branches.map(b => (
                  <div key={b.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                    <h4 className="font-bold text-xs text-indigo-300 mb-2 flex items-center gap-1.5">
                      <CornerDownRight className="w-3 h-3 text-indigo-400" />
                      {b.title}
                    </h4>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      {b.subitems.map((sub, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                          <span>{sub}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Entrada de Texto o Canvas según inputMode */}
        <div className="flex-1 relative pl-4 sm:pl-10">
          {inputMode === 'keyboard' ? (
            <textarea
              value={notebookText}
              onChange={(e) => setNotebookText(e.target.value)}
              placeholder="Escribe tus notas aquí con absoluta fluidez... Las notas alimentan automáticamente a la IA en segundo plano."
              spellCheck="true"
              className="w-full h-full min-h-[400px] bg-transparent text-slate-100 placeholder-slate-500 text-sm sm:text-base font-serif focus:outline-none resize-none"
              style={{
                lineHeight: paperStyle === 'lined' ? '32px' : '28px',
                fontFamily: 'Charter, Georgia, Cambria, "Times New Roman", serif'
              }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={900}
              height={500}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={endDrawing}
              className="w-full h-[500px] rounded-2xl bg-transparent cursor-crosshair touch-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import {
  PenTool, Keyboard, Sparkles, CheckCircle2, Table, GitBranch,
  Save, RotateCcw, ZoomIn, ZoomOut, FileText, Download,
  Trash2, Plus, ArrowRight, CornerDownRight, Check, Brain,
  ChevronDown, Layout, ShieldCheck, AlertCircle, RefreshCw, BookOpen, X,
  Bookmark, Eraser, Undo, Calendar, Hash, Type
} from 'lucide-react';

const PAPER_STYLES = [
  { id: 'lined', name: 'Renglones Oxford Marfil', desc: 'Papel crema con líneas finas y margen rojo clásico' },
  { id: 'grid', name: 'Cuadrícula Técnica 5mm', desc: 'Malla milimétrica ideal para tablas y presupuestos' },
  { id: 'dots', name: 'Puntos Bullet Journal', desc: 'Puntos sutiles para libertad creativa y mapas mentales' },
  { id: 'dark-velvet', name: 'Black Obsidian Velvet', desc: 'Papel negro de lujo con renglones de plata' }
];

const INK_COLORS = [
  { id: 'black', name: 'Negro Estilográfica', color: '#0f172a', class: 'bg-slate-900' },
  { id: 'blue', name: 'Azul Montblanc', color: '#1e3a8a', class: 'bg-blue-900' },
  { id: 'emerald', name: 'Verde Esmeralda', color: '#064e3b', class: 'bg-emerald-900' },
  { id: 'burgundy', name: 'Burdeos Ejecutivo', color: '#831843', class: 'bg-rose-950' }
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
  const [selectedInk, setSelectedInk] = useState(INK_COLORS[0]);
  const [penWidth, setPenWidth] = useState(2.5);
  const [inkSmoothing, setInkSmoothing] = useState(true);
  
  // Elementos enriquecidos impresos sobre la hoja
  const [insertedTables, setInsertedTables] = useState([]);
  const [mindmapNodes, setMindmapNodes] = useState([]);
  const [isAiStructuring, setIsAiStructuring] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [subjectTitle, setSubjectTitle] = useState(activeMeeting?.title || 'Estrategia y Acuerdos Ejecutivos');

  // Canvas para trazos manuscritos con stylus
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef([]);
  const [strokes, setStrokes] = useState([]);

  useEffect(() => {
    if (onContentChange) {
      onContentChange(notebookText);
    }
  }, [notebookText, onContentChange]);

  // Suavizado vectorial de curvas Bézier para caligrafía de lujo
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

  // Manejadores del lienzo
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

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = selectedInk.color;
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
        color: selectedInk.color,
        width: penWidth,
        points: currentStrokeRef.current
      }]);
      currentStrokeRef.current = [];
    }
  };

  const undoLastStroke = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    setStrokes([]);
  };

  // Inserción de Tabla Ejecutiva estilo papelería fina
  const insertExecutiveTable = () => {
    const newTable = {
      id: Date.now(),
      title: 'Matriz de Acuerdos y Responsables',
      headers: ['Concepto / Decisión', 'Responsable', 'Plazo de Entrega', 'Estado'],
      rows: [
        ['Despliegue de arquitectura piloto', 'Equipo Técnico', 'Viernes 20', 'En Curso'],
        ['Aprobación de presupuesto final', 'Dirección General', 'Lunes 23', 'Aprobado']
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
      centralTopic: subjectTitle || 'Estrategia Principal',
      branches: [
        { id: 1, title: 'Pilares Clave', subitems: ['Entregas de alto valor', 'Validación continua'] },
        { id: 2, title: 'Riesgos & Contingencias', subitems: ['Tiempos de ejecución', 'Dependencias externas'] },
        { id: 3, title: 'Próximos Pasos', subitems: ['Sincronización semanal', 'Envío de minuta firmada'] }
      ]
    };
    setMindmapNodes(prev => [...prev, newMindmap]);
  };

  const removeMindmap = (mindmapId) => {
    setMindmapNodes(prev => prev.filter(m => m.id !== mindmapId));
  };

  // Estructuración mágica con IA
  const autoStructureWithAi = async () => {
    if (!notebookText.trim()) return;
    setIsAiStructuring(true);
    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Organiza y estructura las siguientes notas de cuaderno de forma concisa y elegante en puntos estratégicos: "${notebookText}"`
        })
      });
      const data = await res.json();
      if (data.answer) {
        setNotebookText(prev => prev + "\n\n---\n✦ SÍNTESIS ESTRATÉGICA POR IA:\n" + data.answer);

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
        title: subjectTitle ? `Notas: ${subjectTitle}` : `Libreta Ejecutiva ${new Date().toLocaleDateString()}`,
        content: notebookText,
        paperStyle,
        tables: insertedTables,
        mindmaps: mindmapNodes
      });
    }
    setSaveSuccessMessage('¡Guardado en archivo de notas!');
    setTimeout(() => setSaveSuccessMessage(''), 3000);
  };

  const getSheetClass = () => {
    switch (paperStyle) {
      case 'grid': return 'luxury-sheet-grid';
      case 'dots': return 'luxury-sheet-dots';
      case 'dark-velvet': return 'luxury-sheet-dark';
      default: return 'luxury-sheet-ivory';
    }
  };

  const currentDateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* ============================================================== */}
      {/* BARRA DE HERRAMIENTAS EJECUTIVAS DE LA PAPELERÍA              */}
      {/* ============================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Lado Izquierdo: Identidad y Modo de Entrada */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-100 tracking-wider uppercase block">
                Atelier ProActur
              </span>
              <span className="text-[11px] text-amber-400 font-semibold block">
                Cuaderno Fino Moleskine
              </span>
            </div>
          </div>

          {/* Selector de Entrada: Teclado vs Stylus / Pluma */}
          <div className="inline-flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => setInputMode('keyboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inputMode === 'keyboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Tipografía</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('stylus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inputMode === 'stylus'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Pluma / Stylus</span>
            </button>
          </div>

          {/* Selector de Papel */}
          <select
            value={paperStyle}
            onChange={(e) => setPaperStyle(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs font-bold text-amber-200/90 rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 shadow-sm"
          >
            {PAPER_STYLES.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Lado Derecho: Paleta de Tinta, Acciones e Inserción */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Selector de Tinta para escritura */}
          {inputMode === 'keyboard' ? (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pr-1">Tinta:</span>
              {INK_COLORS.map(ink => (
                <button
                  key={ink.id}
                  type="button"
                  onClick={() => setSelectedInk(ink)}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    selectedInk.id === ink.id ? 'ring-2 ring-amber-400 scale-110 border-white' : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: ink.color }}
                  title={ink.name}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
              {INK_COLORS.map(ink => (
                <button
                  key={ink.id}
                  type="button"
                  onClick={() => setSelectedInk(ink)}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    selectedInk.id === ink.id ? 'ring-2 ring-amber-400 scale-110 border-white' : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: ink.color }}
                  title={ink.name}
                />
              ))}
              <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
              <button
                type="button"
                onClick={undoLastStroke}
                className="p-1 text-slate-400 hover:text-amber-300 transition-colors"
                title="Deshacer último trazo"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                title="Limpiar trazos manuscritos"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Insertar Tabla */}
          <button
            type="button"
            onClick={insertExecutiveTable}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-200/90 text-xs font-bold transition-all shadow-sm"
          >
            <Table className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Tabla</span>
          </button>

          {/* Insertar Mapa Mental */}
          <button
            type="button"
            onClick={insertMindmap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-purple-200/90 text-xs font-bold transition-all shadow-sm"
          >
            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Esquema</span>
          </button>

          {/* Organizar con IA */}
          <button
            type="button"
            onClick={autoStructureWithAi}
            disabled={isAiStructuring || !notebookText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/50 hover:to-amber-500/40 border border-amber-500/40 text-amber-200 text-xs font-bold transition-all disabled:opacity-40 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAiStructuring ? 'Organizando...' : 'Sello IA'}</span>
          </button>

          {/* Guardar */}
          <button
            type="button"
            onClick={handleSaveNote}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* EL ESCRITORIO DE CUERO Y LA HOJA ULTRA-REALISTA (MOLESKINE 3D)  */}
      {/* ============================================================== */}
      <div className="luxury-notebook-desk p-4 sm:p-8 md:p-12 rounded-3xl relative overflow-hidden flex justify-center">
        {/* Cinta Marcapáginas en Satín Carmesí */}
        <div className="absolute top-0 right-12 sm:right-24 w-8 h-28 bg-gradient-to-b from-rose-800 via-rose-700 to-rose-900 shadow-xl z-20 pointer-events-none rounded-b-md border-x border-rose-950/40 flex items-end justify-center pb-2">
          <div className="w-2 h-2 rounded-full bg-amber-400/80 shadow" />
        </div>

        {/* Lomo y Encuadernación del Cuaderno */}
        <div className="w-full max-w-4xl relative flex">
          {/* Anillos Metálicos de Espiral (Lado Izquierdo) */}
          <div className="w-6 sm:w-8 flex flex-col justify-around py-8 z-30 select-none pointer-events-none shrink-0">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="flex items-center -mr-2">
                <div className="w-5 sm:w-6 h-3 rounded-full spiral-ring transform -rotate-12" />
                <div className="w-2 h-2 rounded-full bg-slate-950/80 shadow-inner -ml-1" />
              </div>
            ))}
          </div>

          {/* ============================================================ */}
          {/* LA HOJA REAL CON SUS RENGLONES MILIMÉTRICOS Y MARGEN ROJO     */}
          {/* ============================================================ */}
          <div
            className={`flex-1 rounded-2xl relative flex flex-col min-h-[750px] transition-all duration-300 ${getSheetClass()}`}
            style={{
              fontFamily: 'Charter, Georgia, Cambria, "Times New Roman", serif'
            }}
          >
            {/* Encabezado Pre-impreso de Papelería Fina */}
            <div className="px-8 sm:px-14 pt-6 pb-4 border-b border-dashed border-slate-300/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-serif select-none">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-widest text-[10px] uppercase text-slate-400">FECHA:</span>
                <span className="text-slate-700 font-semibold italic capitalize">{currentDateStr}</span>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-sm ml-2">
                <span className="font-bold tracking-widest text-[10px] uppercase text-slate-400 shrink-0">ASUNTO:</span>
                <input
                  type="text"
                  value={subjectTitle}
                  onChange={(e) => setSubjectTitle(e.target.value)}
                  placeholder="Título de la sesión..."
                  className="bg-transparent text-slate-800 font-bold border-b border-slate-300/60 focus:outline-none focus:border-amber-600 w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                <span>PÁG. 01</span>
                {isRecordingActive && (
                  <span className="flex items-center gap-1 text-red-600 font-sans font-black uppercase text-[10px] animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    Grabando ({Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')})
                  </span>
                )}
              </div>
            </div>

            {/* Cuerpo de la Hoja con Renglones */}
            <div className="relative flex-1 px-8 sm:px-14 py-4 flex flex-col">
              {/* Margen Rojo Tradicional a la Izquierda */}
              <div className="absolute top-0 bottom-0 left-[62px] sm:left-[70px] w-[1px] bg-red-500/35 pointer-events-none" />

              {/* Tablas Insertadas como Papel Pegado */}
              {insertedTables.map(tbl => (
                <div key={tbl.id} className="mb-6 ml-6 relative z-10 animate-fade-in">
                  <div className="bg-white/95 border-2 border-slate-300 rounded-xl p-3 shadow-md backdrop-blur-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                      <div className="flex items-center gap-2">
                        <Table className="w-3.5 h-3.5 text-slate-700" />
                        <input
                          type="text"
                          defaultValue={tbl.title}
                          className="bg-transparent font-bold text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addTableRow(tbl.id)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border border-slate-300 transition-colors"
                        >
                          + Fila
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTable(tbl.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-300 font-bold text-[11px]">
                          {tbl.headers.map((h, i) => (
                            <th key={i} className="py-1 px-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tbl.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-200/80 hover:bg-slate-50/80">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="py-1 px-2">
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(e) => updateTableCell(tbl.id, rIdx, cIdx, e.target.value)}
                                  className="bg-transparent text-slate-800 w-full focus:outline-none focus:bg-white"
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
              ))}

              {/* Mapas Mentales Insertados */}
              {mindmapNodes.map(mm => (
                <div key={mm.id} className="mb-6 ml-6 relative z-10 animate-fade-in">
                  <div className="bg-white/95 border-2 border-purple-300 rounded-xl p-3 shadow-md backdrop-blur-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-200 mb-2">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-purple-700" />
                        <span className="font-bold text-xs text-purple-900">{mm.centralTopic}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMindmap(mm.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {mm.branches.map(b => (
                        <div key={b.id} className="bg-purple-50/70 border border-purple-200 rounded-lg p-2">
                          <h5 className="font-bold text-[11px] text-purple-900 mb-1 flex items-center gap-1">
                            <CornerDownRight className="w-2.5 h-2.5 text-purple-600" />
                            {b.title}
                          </h5>
                          <ul className="space-y-1 text-[10px] text-slate-700">
                            {b.subitems.map((s, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="w-1 h-1 rounded-full bg-purple-500 mt-1 shrink-0" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Área de Escritura: Textarea Alineado al Renglón o Canvas de Dibujo */}
              <div className="flex-1 relative pl-6 sm:pl-8 min-h-[500px]">
                {inputMode === 'keyboard' ? (
                  <textarea
                    value={notebookText}
                    onChange={(e) => setNotebookText(e.target.value)}
                    placeholder="Escribe tus notas aquí sobre los renglones... El texto se alinea con cada línea y se envía en tiempo real al análisis de la reunión."
                    spellCheck="true"
                    className="w-full h-full min-h-[480px] luxury-notebook-textarea"
                    style={{
                      color: selectedInk.color
                    }}
                  />
                ) : (
                  <canvas
                    ref={canvasRef}
                    width={850}
                    height={600}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                    className="w-full h-[600px] rounded-xl cursor-crosshair touch-none relative z-10"
                  />
                )}
              </div>
            </div>

            {/* Pie de Página con Marca de Papelería Fina */}
            <div className="px-8 sm:px-14 py-3 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 select-none font-serif">
              <span>PROACTUR NOTEBOOK ARCHIVE • EDICIÓN EJECUTIVA 2026</span>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                <span>PAPEL 120 G/M² ANTI-REFLEJO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

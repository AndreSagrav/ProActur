import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Pen, Highlighter, Eraser, Undo2, Redo2, Minus, Plus, Trash2,
  Circle, Square, Type, MoveRight, Grid3X3, GitBranch, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2
} from 'lucide-react';

const COLORS = [
  { name: 'Indigo', value: '#818cf8' },
  { name: 'Blanco', value: '#e2e8f0' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Rose', value: '#fb7185' },
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Orange', value: '#fb923c' },
];

const TOOLS = {
  PEN: 'pen',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  LINE: 'line',
  RECT: 'rect',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  TEXT: 'text',
  TABLE: 'table',
  TREE: 'tree',
};

export default function HandwritingCanvas({ strokes: initialStrokes, onStrokesChange, className = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState('#818cf8');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState(initialStrokes || []);
  const [redoStack, setRedoStack] = useState([]);
  const [showColors, setShowColors] = useState(false);
  const [showShapes, setShowShapes] = useState(false);
  const [shapeStart, setShapeStart] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [gridVisible, setGridVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const currentStroke = useRef([]);
  const lastPoint = useRef(null);
  const textInputRef = useRef(null);
  const [textPosition, setTextPosition] = useState(null);
  const [tableConfig, setTableConfig] = useState(null);
  const [treeConfig, setTreeConfig] = useState(null);

  // Redibujar todo el canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo premium
    ctx.fillStyle = '#0c1222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, pan.x * dpr, pan.y * dpr);

    // Grilla de puntos premium
    if (gridVisible) {
      const spacing = 24;
      const w = canvas.width / (dpr * zoom);
      const h = canvas.height / (dpr * zoom);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Dibujar todos los trazos guardados
    strokes.forEach(stroke => drawStroke(ctx, stroke));
  }, [strokes, zoom, pan, gridVisible]);

  function drawStroke(ctx, stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    if (stroke.type === 'text') {
      ctx.font = `${stroke.fontSize || 16}px 'Inter', sans-serif`;
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = 1;
      ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
      return;
    }

    if (stroke.type === 'rect') {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const p0 = stroke.points[0];
      const p1 = stroke.points[1];
      ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      ctx.globalAlpha = 1;
      return;
    }

    if (stroke.type === 'circle') {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
      const p0 = stroke.points[0];
      const p1 = stroke.points[1];
      const rx = Math.abs(p1.x - p0.x) / 2;
      const ry = Math.abs(p1.y - p0.y) / 2;
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (stroke.type === 'line' || stroke.type === 'arrow') {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      const p0 = stroke.points[0];
      const p1 = stroke.points[1];
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      if (stroke.type === 'arrow') {
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - headLen * Math.cos(angle - Math.PI / 6), p1.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - headLen * Math.cos(angle + Math.PI / 6), p1.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
      return;
    }

    if (stroke.type === 'table') {
      drawTable(ctx, stroke);
      return;
    }

    if (stroke.type === 'tree') {
      drawTree(ctx, stroke);
      return;
    }

    // Trazo libre (pen/highlighter/eraser)
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#0c1222' : stroke.color;
    ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      const w = stroke.tool === 'eraser' ? stroke.width * 4 : stroke.width * (0.5 + (p.pressure || 0.5));
      ctx.lineWidth = w;

      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        const prev = stroke.points[i - 1];
        const mx = (prev.x + p.x) / 2;
        const my = (prev.y + p.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawTable(ctx, stroke) {
    const { x, y, rows, cols, cellW, cellH } = stroke.tableData;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;

    const totalW = cols * cellW;
    const totalH = rows * cellH;

    // Fondo de header
    ctx.fillStyle = stroke.color.replace(')', ', 0.1)').replace('rgb', 'rgba');
    if (stroke.color.startsWith('#')) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    }
    ctx.fillRect(x, y, totalW, cellH);

    // Lineas horizontales
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * cellH);
      ctx.lineTo(x + totalW, y + r * cellH);
      ctx.stroke();
    }
    // Lineas verticales
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(x + c * cellW, y);
      ctx.lineTo(x + c * cellW, y + totalH);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTree(ctx, stroke) {
    const { x, y, depth, spread } = stroke.treeData;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;

    const nodeW = 100;
    const nodeH = 36;
    const vGap = 60;
    const hGap = spread || 140;

    function drawNode(nx, ny, label, level) {
      // Nodo con borde redondeado
      const r = 10;
      ctx.beginPath();
      ctx.roundRect(nx - nodeW / 2, ny - nodeH / 2, nodeW, nodeH, r);
      ctx.fillStyle = level === 0 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.8)';
      ctx.fill();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = level === 0 ? 2 : 1.5;
      ctx.stroke();

      // Texto
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `${level === 0 ? 'bold ' : ''}13px 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, nx, ny);
    }

    function drawBranch(fromX, fromY, toX, toY) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY + nodeH / 2);
      const midY = (fromY + nodeH / 2 + toY - nodeH / 2) / 2;
      ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY - nodeH / 2);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
    }

    // Raiz
    drawNode(x, y, 'Tema Principal', 0);

    const lvl1Count = Math.min(depth, 4);
    const startX = x - ((lvl1Count - 1) * hGap) / 2;

    for (let i = 0; i < lvl1Count; i++) {
      const nx = startX + i * hGap;
      const ny = y + vGap + nodeH;
      drawBranch(x, y, nx, ny);
      drawNode(nx, ny, `Rama ${i + 1}`, 1);

      if (depth > 1) {
        const subCount = 2;
        const subStartX = nx - ((subCount - 1) * (hGap * 0.5)) / 2;
        for (let j = 0; j < subCount; j++) {
          const sx = subStartX + j * (hGap * 0.5);
          const sy = ny + vGap + nodeH;
          drawBranch(nx, ny, sx, sy);
          drawNode(sx, sy, `Sub ${j + 1}`, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Resize canvas con ResizeObserver para adaptabilidad a rotacion de tabletas y cambio de ventana
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      redrawCanvas();
    };

    resize();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(container);
    }
    window.addEventListener('resize', resize);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [redrawCanvas, isFullscreen]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  // Sync external strokes
  useEffect(() => {
    if (initialStrokes && JSON.stringify(initialStrokes) !== JSON.stringify(strokes)) {
      setStrokes(initialStrokes);
    }
  }, [initialStrokes]);

  function getCanvasPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
      pressure: e.pressure || 0.5,
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);

    // Palm rejection: si es pen, ignora touch
    if (e.pointerType === 'touch' && tool !== TOOLS.ERASER) {
      const activePen = strokes.some(s => s._penActive);
      if (activePen) return;
    }

    const point = getCanvasPoint(e);

    if (tool === TOOLS.TEXT) {
      setTextPosition(point);
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (tool === TOOLS.TABLE) {
      const newStroke = {
        type: 'table',
        color,
        width: lineWidth,
        tool: 'table',
        tableData: { x: point.x, y: point.y, rows: 4, cols: 3, cellW: 120, cellH: 36 },
        points: [point],
      };
      const updated = [...strokes, newStroke];
      setStrokes(updated);
      setRedoStack([]);
      onStrokesChange?.(updated);
      return;
    }

    if (tool === TOOLS.TREE) {
      const newStroke = {
        type: 'tree',
        color,
        width: lineWidth,
        tool: 'tree',
        treeData: { x: point.x, y: point.y, depth: 3, spread: 160 },
        points: [point],
      };
      const updated = [...strokes, newStroke];
      setStrokes(updated);
      setRedoStack([]);
      onStrokesChange?.(updated);
      return;
    }

    if ([TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool)) {
      setShapeStart(point);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    currentStroke.current = [point];
    lastPoint.current = point;
  }

  function handlePointerMove(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getCanvasPoint(e);

    if ([TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool) && shapeStart) {
      // Preview de la forma
      redrawCanvas();
      const ctx = canvasRef.current.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, pan.x * dpr, pan.y * dpr);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.setLineDash([6, 4]);

      if (tool === TOOLS.RECT) {
        ctx.strokeRect(shapeStart.x, shapeStart.y, point.x - shapeStart.x, point.y - shapeStart.y);
      } else if (tool === TOOLS.CIRCLE) {
        const rx = Math.abs(point.x - shapeStart.x) / 2;
        const ry = Math.abs(point.y - shapeStart.y) / 2;
        const cx = (shapeStart.x + point.x) / 2;
        const cy = (shapeStart.y + point.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      return;
    }

    currentStroke.current.push(point);

    // Dibujo en tiempo real para trazos libres
    const ctx = canvasRef.current.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, pan.x * dpr, pan.y * dpr);
    ctx.strokeStyle = tool === TOOLS.ERASER ? '#0c1222' : color;
    ctx.globalAlpha = tool === TOOLS.HIGHLIGHTER ? 0.35 : 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = tool === TOOLS.ERASER ? lineWidth * 4 : lineWidth * (0.5 + (point.pressure || 0.5));

    ctx.beginPath();
    const prev = lastPoint.current;
    const mx = (prev.x + point.x) / 2;
    const my = (prev.y + point.y) / 2;
    ctx.moveTo(prev.x, prev.y);
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    ctx.stroke();
    ctx.globalAlpha = 1;

    lastPoint.current = point;
  }

  function handlePointerUp(e) {
    if (!isDrawing) return;
    setIsDrawing(false);

    if ([TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool) && shapeStart) {
      const endPoint = getCanvasPoint(e);
      const newStroke = {
        type: tool,
        color,
        width: lineWidth,
        tool,
        points: [shapeStart, endPoint],
      };
      const updated = [...strokes, newStroke];
      setStrokes(updated);
      setRedoStack([]);
      setShapeStart(null);
      onStrokesChange?.(updated);
      redrawCanvas();
      return;
    }

    if (currentStroke.current.length > 1) {
      const newStroke = {
        points: currentStroke.current,
        color,
        width: lineWidth,
        tool,
        type: 'freehand',
      };
      const updated = [...strokes, newStroke];
      setStrokes(updated);
      setRedoStack([]);
      onStrokesChange?.(updated);
    }
    currentStroke.current = [];
  }

  function handleTextSubmit(text) {
    if (!text || !textPosition) return;
    const newStroke = {
      type: 'text',
      color,
      fontSize: lineWidth * 6,
      text,
      tool: 'text',
      width: lineWidth,
      points: [textPosition],
    };
    const updated = [...strokes, newStroke];
    setStrokes(updated);
    setRedoStack([]);
    setTextPosition(null);
    onStrokesChange?.(updated);
  }

  function undo() {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStack(prev => [...prev, last]);
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    onStrokesChange?.(updated);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    const updated = [...strokes, last];
    setStrokes(updated);
    onStrokesChange?.(updated);
  }

  function clearAll() {
    setStrokes([]);
    setRedoStack([]);
    onStrokesChange?.([]);
  }

  const isShapeTool = [TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW, TOOLS.TABLE, TOOLS.TREE].includes(tool);

  const ToolBtn = ({ icon: Icon, value, label, active }) => (
    <button
      onClick={() => { setTool(value); setShowShapes(false); }}
      className={`p-2.5 rounded-xl transition-all duration-200 relative group ${
        active
          ? 'bg-indigo-600/30 text-indigo-300 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/40'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
      }`}
      title={label}
    >
      <Icon className="w-[18px] h-[18px]" />
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] text-slate-300 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700">
        {label}
      </span>
    </button>
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden rounded-xl border border-slate-800/60 bg-[#0c1222] cursor-crosshair"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0"
        />

        {/* Text Input Overlay */}
        {textPosition && (
          <div
            className="absolute z-20"
            style={{ left: textPosition.x * zoom + pan.x, top: textPosition.y * zoom + pan.y }}
          >
            <input
              ref={textInputRef}
              type="text"
              autoFocus
              placeholder="Escribe aqui..."
              className="bg-slate-800/90 border border-indigo-500/50 text-slate-100 text-sm px-3 py-1.5 rounded-lg outline-none min-w-[180px] backdrop-blur-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleTextSubmit(e.target.value); e.target.value = ''; }
                if (e.key === 'Escape') setTextPosition(null);
              }}
              onBlur={(e) => { handleTextSubmit(e.target.value); }}
            />
          </div>
        )}

        {/* Zoom indicator */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-2 py-1">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="text-slate-400 hover:text-slate-200 p-0.5">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 min-w-[32px] text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="text-slate-400 hover:text-slate-200 p-0.5">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3 bg-slate-700 mx-0.5" />
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="text-slate-400 hover:text-slate-200 p-0.5" title="Reset vista">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3 bg-slate-700 mx-0.5" />
          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="text-slate-400 hover:text-indigo-300 p-0.5"
            title={isFullscreen ? "Salir de pantalla completa" : "Modo Lienzo Completo (Tableta)"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-indigo-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Grid toggle */}
        <button
          onClick={() => setGridVisible(g => !g)}
          className={`absolute top-3 left-3 p-1.5 rounded-lg border transition-all ${
            gridVisible ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-slate-900/80 border-slate-700/50 text-slate-500'
          }`}
          title="Mostrar/ocultar grilla"
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Premium Toolbar */}
      <div className="mt-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2.5 shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1">
            <ToolBtn icon={Pen} value={TOOLS.PEN} label="Lapiz" active={tool === TOOLS.PEN} />
            <ToolBtn icon={Highlighter} value={TOOLS.HIGHLIGHTER} label="Resaltador" active={tool === TOOLS.HIGHLIGHTER} />
            <ToolBtn icon={Eraser} value={TOOLS.ERASER} label="Borrador" active={tool === TOOLS.ERASER} />
            <ToolBtn icon={Type} value={TOOLS.TEXT} label="Texto" active={tool === TOOLS.TEXT} />

            {/* Shapes dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowShapes(!showShapes)}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  isShapeTool ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="Formas y herramientas"
              >
                <Grid3X3 className="w-[18px] h-[18px]" />
              </button>

              {showShapes && (
                <div className="absolute bottom-full mb-2 left-0 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl p-2 shadow-2xl shadow-black/40 min-w-[180px] z-30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-2 mb-1.5">Formas</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { icon: Minus, value: TOOLS.LINE, label: 'Linea' },
                      { icon: MoveRight, value: TOOLS.ARROW, label: 'Flecha' },
                      { icon: Square, value: TOOLS.RECT, label: 'Rectangulo' },
                      { icon: Circle, value: TOOLS.CIRCLE, label: 'Circulo' },
                    ].map(s => (
                      <button
                        key={s.value}
                        onClick={() => { setTool(s.value); setShowShapes(false); }}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                          tool === s.value ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        <s.icon className="w-3.5 h-3.5" /> {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-700/50 mt-1.5 pt-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-2 mb-1.5">Estructuras</p>
                    <div className="grid grid-cols-1 gap-1">
                      <button
                        onClick={() => { setTool(TOOLS.TABLE); setShowShapes(false); }}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                          tool === TOOLS.TABLE ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        <Grid3X3 className="w-3.5 h-3.5" /> Tabla (4x3)
                      </button>
                      <button
                        onClick={() => { setTool(TOOLS.TREE); setShowShapes(false); }}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                          tool === TOOLS.TREE ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        <GitBranch className="w-3.5 h-3.5" /> Arbol de Estudio
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-700/50" />

          {/* Line Width */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setLineWidth(w => Math.max(1, w - 1))} className="text-slate-400 hover:text-slate-200 p-1">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/40">
              <div className="rounded-full bg-current" style={{ width: Math.min(lineWidth * 2, 16), height: Math.min(lineWidth * 2, 16), color }} />
            </div>
            <button onClick={() => setLineWidth(w => Math.min(20, w + 1))} className="text-slate-400 hover:text-slate-200 p-1">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-700/50" />

          {/* Colors */}
          <div className="relative">
            <button
              onClick={() => setShowColors(!showColors)}
              className="flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-slate-700/50 transition-all"
            >
              {COLORS.slice(0, 4).map(c => (
                <div
                  key={c.value}
                  className={`w-4 h-4 rounded-full transition-all ${color === c.value ? 'ring-2 ring-white/50 scale-125' : ''}`}
                  style={{ backgroundColor: c.value }}
                  onClick={(e) => { e.stopPropagation(); setColor(c.value); }}
                />
              ))}
            </button>

            {showColors && (
              <div className="absolute bottom-full mb-2 right-0 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3 shadow-2xl shadow-black/40 z-30">
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => { setColor(c.value); setShowColors(false); }}
                      className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                        color === c.value ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-slate-800 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-700/50" />

          {/* Undo / Redo / Clear */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={strokes.length === 0}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Deshacer"
            >
              <Undo2 className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Rehacer"
            >
              <Redo2 className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={clearAll}
              disabled={strokes.length === 0}
              className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Limpiar todo"
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

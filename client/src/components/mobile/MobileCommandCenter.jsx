import React, { useState, useEffect } from 'react';
import {
  Sparkles, Wallet, CheckSquare, Mic, Plus, Brain,
  ChevronRight, TrendingUp, TrendingDown, Clock, Calendar, FileText,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Layers, Download,
  Edit3, Trash2, CheckCircle2, AlertCircle, X
} from 'lucide-react';
import BottomSheet from './BottomSheet';

const API = import.meta.env.VITE_API_URL || '';

export default function MobileCommandCenter({
  meetings = [],
  onNavigate,
  onStartRecording,
  onNewNote,
  onOpenAssistant
}) {
  const [financeSummary, setFinanceSummary] = useState({
    balanceCRC: 0,
    balanceUSD: 0,
    creditDebtCRC: 0,
    creditDebtUSD: 0,
    monthIncome: 0,
    monthExpense: 0,
    monthCreditExpense: 0,
    budgetLimit: 0,
    accounts: [],
    recentTransactions: []
  });
  const [tasks, setTasks] = useState([]);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  // Formulario nueva tarea
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('high');
  const [newTaskDueDate, setNewTaskDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTaskNotes, setNewTaskNotes] = useState('');

  const fetchFinance = async () => {
    try {
      const res = await fetch(`${API}/api/finance/summary`);
      if (res.ok) setFinanceSummary(await res.json());
    } catch (_) {}
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API}/api/tasks`);
      if (res.ok) setTasks(await res.json());
    } catch (_) {}
  };

  useEffect(() => {
    fetchFinance();
    fetchTasks();
  }, []);

  const toggleTask = async (e, id) => {
    e.stopPropagation();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t));
    try {
      await fetch(`${API}/api/tasks/${id}/toggle`, { method: 'PATCH' });
      fetchTasks();
    } catch (_) {}
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
          dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : new Date().toISOString(),
          notes: newTaskNotes.trim()
        })
      });
      if (res.ok) {
        setNewTaskTitle('');
        setNewTaskNotes('');
        setShowTaskSheet(false);
        fetchTasks();
      }
    } catch (_) {}
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title?.trim()) return;
    try {
      const res = await fetch(`${API}/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTask.title.trim(),
          priority: editingTask.priority,
          dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString() : null,
          notes: (editingTask.notes || '').trim(),
          status: editingTask.status
        })
      });
      if (res.ok) {
        setEditingTask(null);
        fetchTasks();
      }
    } catch (_) {}
  };

  const handleDeleteTask = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEditingTask(null);
        fetchTasks();
      }
    } catch (_) {}
  };

  const formatTaskDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: 'Hoy', color: 'text-amber-400', isOverdue: false };
    if (diffDays === 1) return { label: 'Mañana', color: 'text-sky-400', isOverdue: false };
    if (diffDays < 0) return { label: `Vencida (${d.toLocaleDateString('es-CR', { month: 'short', day: 'numeric' })})`, color: 'text-rose-400', isOverdue: true };
    return { label: d.toLocaleDateString('es-CR', { month: 'short', day: 'numeric' }), color: 'text-slate-400', isOverdue: false };
  };

  const latestMeeting = meetings[0] || null;
  const pendingTasks = tasks.filter(t => t.status !== 'completed');

  return (
    <div className="space-y-4 animate-fade-in pb-12 select-none">
      {/* 1. Tarjeta Resumen Ejecutivo Consolidado (Datos Reales en USD / CRC) */}
      <div className="relative overflow-hidden p-5 rounded-2xl bg-slate-900/90 border border-white/[0.08] shadow-lg">
        <div className="space-y-3.5">
          {/* Fila Superior: Título & Estado Nube */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Centro de Control Directivo
            </span>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-300">Nube Supabase</span>
            </div>
          </div>

          {/* Saldo Neto Consolidado Real */}
          <div>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
              Saldo Disponible Líquido (Débito)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
                ₡{Number(financeSummary.balanceCRC ?? financeSummary.balance ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                CRC
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
              <span>Dólares:</span>
              <span className="text-slate-300 font-bold">${Number(financeSummary.balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
            </div>
          </div>

          {/* Indicadores de Flujo del Mes con Tratamiento Separado de Crédito */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Ingresos:</span>
              <span className="font-mono font-bold text-emerald-400">
                +₡{Number(financeSummary.monthIncome || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Egresos Débito:</span>
              <span className="font-mono font-bold text-rose-400">
                -₡{Number(financeSummary.monthExpense || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Tarjeta de Crédito (Tratamiento Diferenciado) */}
          {(Number(financeSummary.creditDebtCRC || 0) > 0 || Number(financeSummary.monthCreditExpense || 0) > 0) && (
            <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                  Tarjetas de Crédito:
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="font-bold text-purple-200">
                  ₡{Number(financeSummary.creditDebtCRC || 0).toLocaleString('es-CR')}
                </span>
                {Number(financeSummary.monthCreditExpense || 0) > 0 && (
                  <span className="text-[10px] text-purple-400/80 ml-1.5">
                    (Consumo mes: ₡{Number(financeSummary.monthCreditExpense).toLocaleString('es-CR')})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Banner Asistente Dobby (Voz y Automatización EDUS) */}
      {onOpenAssistant && (
        <div 
          onClick={onOpenAssistant}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/60 border border-indigo-500/30 hover:border-indigo-500/50 cursor-pointer shadow-md flex items-center justify-between gap-3 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white tracking-tight">Dobby</h4>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">Copiloto</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">Habla por voz o gestiona EDUS, agenda y finanzas</p>
            </div>
          </div>
          <button
            type="button"
            className="p-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shrink-0 shadow-sm"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Acciones Rápidas */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Grabar Reunión */}
        <button
          type="button"
          onClick={onStartRecording}
          className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/[0.08] active:scale-[0.98] transition-all text-left shadow-sm flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 leading-tight">Grabar Sesión</h4>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Minuta en tiempo real</p>
          </div>
        </button>

        {/* Finanzas */}
        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/[0.08] active:scale-[0.98] transition-all text-left shadow-sm flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 leading-tight">Finanzas</h4>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Cuentas y vouchers</p>
          </div>
        </button>

        {/* Nueva Tarea */}
        <button
          type="button"
          onClick={() => setShowTaskSheet(true)}
          className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/[0.08] active:scale-[0.98] transition-all text-left shadow-sm flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 leading-tight">Nueva Tarea</h4>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Registrar pendiente</p>
          </div>
        </button>

        {/* Cuaderno Canvas */}
        <button
          type="button"
          onClick={onNewNote}
          className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/[0.08] active:scale-[0.98] transition-all text-left shadow-sm flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 leading-tight">Libreta</h4>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Bitácora ejecutiva</p>
          </div>
        </button>
      </div>

      {/* 4. Compromisos & Tareas Prioritarias */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/[0.08] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Compromisos & Tareas ({pendingTasks.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowTaskSheet(true)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir</span>
          </button>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="py-5 text-center text-xs text-slate-500 space-y-1">
              <p>No hay tareas registradas en este momento.</p>
              <p className="text-[10px] text-slate-600">Presione "+ Añadir" para crear una con fecha y detalles.</p>
            </div>
          ) : (
            tasks.map(t => {
              const isDone = t.status === 'completed';
              const dateInfo = formatTaskDate(t.dueDate || t.due_date);
              return (
                <div
                  key={t.id}
                  onClick={() => setEditingTask(t)}
                  className={`p-3 rounded-xl border transition-all duration-150 active:scale-[0.99] flex items-center justify-between gap-3 cursor-pointer ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/40 opacity-40'
                      : 'bg-slate-950/80 hover:bg-slate-950 border-white/[0.05] hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => toggleTask(e, t.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        isDone
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-900/90 hover:border-slate-500'
                      }`}
                    >
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold leading-snug break-words ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {t.title}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        {dateInfo && (
                          <span className={`text-[10px] font-mono font-medium flex items-center gap-1 ${dateInfo.color}`}>
                            <Calendar className="w-3 h-3" />
                            {dateInfo.label}
                          </span>
                        )}
                        {t.notes && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5 truncate max-w-[150px]">
                            <FileText className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{t.notes}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      t.priority === 'high'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : t.priority === 'medium'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}
                      className="p-1 text-slate-500 hover:text-slate-300 rounded"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Última Minuta Ejecutiva */}
      {latestMeeting && (
        <div
          onClick={() => onNavigate('meetings')}
          className="p-4 rounded-2xl bg-slate-900/90 border border-white/[0.08] shadow-sm space-y-2 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Minuta Reciente
            </span>
            <div className="flex items-center gap-1 text-xs text-indigo-400 font-semibold">
              <span>Ver Detalle</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">{latestMeeting.title}</h4>
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{latestMeeting.summary}</p>
        </div>
      )}

      {/* Bottom Sheet Nativo: Crear Tarea */}
      <BottomSheet
        isOpen={showTaskSheet}
        onClose={() => setShowTaskSheet(false)}
        title="Crear Nueva Tarea"
        subtitle="Sincronizada en Supabase con fecha, prioridad y notas"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Título de la Tarea *
            </label>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Ej. Agendar cita odontológica, revisar contrato..."
              autoFocus
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Fecha Límite
              </label>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Prioridad
              </label>
              <div className="grid grid-cols-3 gap-1">
                {['high', 'medium', 'low'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewTaskPriority(p)}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      newTaskPriority === p
                        ? p === 'high'
                          ? 'bg-rose-500 text-white border-rose-400'
                          : p === 'medium'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Detalles / Notas Adicionales
            </label>
            <textarea
              rows={3}
              value={newTaskNotes}
              onChange={(e) => setNewTaskNotes(e.target.value)}
              placeholder="Contexto, acuerdos previos o pasos específicos..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
            >
              Guardar Tarea
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Bottom Sheet Nativo: Ver / Editar Tarea */}
      <BottomSheet
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        title="Detalles y Edición de Tarea"
        subtitle="Modifique plazos, descripción o estado de la tarea"
      >
        {editingTask && (
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Título de la Tarea *
              </label>
              <input
                type="text"
                value={editingTask.title || ''}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Fecha Límite
                </label>
                <input
                  type="date"
                  value={editingTask.dueDate ? editingTask.dueDate.slice(0, 10) : (editingTask.due_date ? editingTask.due_date.slice(0, 10) : '')}
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Prioridad
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {['high', 'medium', 'low'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditingTask({ ...editingTask, priority: p })}
                      className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        editingTask.priority === p
                          ? p === 'high'
                            ? 'bg-rose-500 text-white border-rose-400'
                            : p === 'medium'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Estado
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask({ ...editingTask, status: 'pending' })}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    editingTask.status !== 'completed'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  ⏳ Pendiente
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTask({ ...editingTask, status: 'completed' })}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    editingTask.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  ✅ Completada
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Detalles / Notas Adicionales
              </label>
              <textarea
                rows={3}
                value={editingTask.notes || ''}
                onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                placeholder="Escriba detalles, pasos o contexto..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteTask(editingTask.id)}
                className="px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>

              <button
                type="submit"
                disabled={!editingTask.title?.trim()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Wallet, CheckSquare, Mic, Plus, Brain,
  ChevronRight, TrendingUp, TrendingDown, Clock, Calendar, FileText,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Layers
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
    balance: 0,
    monthIncome: 0,
    monthExpense: 0,
    budgetLimit: 20000,
    accounts: [],
    recentTransactions: []
  });
  const [tasks, setTasks] = useState([]);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('high');

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

  const toggleTask = async (id) => {
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
          priority: newTaskPriority
        })
      });
      if (res.ok) {
        setNewTaskTitle('');
        setShowTaskSheet(false);
        fetchTasks();
      }
    } catch (_) {}
  };

  const budgetUsage = Math.min(100, Math.round((financeSummary.monthExpense / (financeSummary.budgetLimit || 1)) * 100));
  const latestMeeting = meetings[0] || null;
  const pendingTasks = tasks.filter(t => t.status !== 'completed');

  return (
    <div className="space-y-4 animate-fade-in pb-12 select-none">
      {/* 1. Tarjeta Resumen Ejecutivo Consolidado (Estilo Fintech Clase Mundial) */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        {/* Ambient Glow Mesh */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header Superior: Título & Badge de Sincronización */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300">
                Centro Ejecutivo
              </span>
            </div>

            {/* Cloud Sync Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-300">Nube Activa</span>
            </div>
          </div>

          {/* Saldo Principal */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
              Saldo Neto Consolidado
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
                ${financeSummary.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                MXN
              </span>
            </div>
          </div>

          {/* Mini-Píldoras de Flujo Mensual */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.05] backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ingresos Mes</span>
              </div>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-1">
                +${(financeSummary.monthIncome || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.05] backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Gastos Mes</span>
              </div>
              <div className="text-sm font-bold text-rose-400 font-mono mt-1">
                -${(financeSummary.monthExpense || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Barra de Presupuesto Mensual */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Presupuesto mensual ejercido</span>
              <span className={`font-bold font-mono ${budgetUsage > 85 ? 'text-rose-400' : 'text-amber-300'}`}>
                {budgetUsage}% ({financeSummary.monthExpense.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} de {financeSummary.budgetLimit.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.05]">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  budgetUsage > 85 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'
                }`}
                style={{ width: `${Math.max(4, budgetUsage)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Matriz Táctil de Acciones Rápidas (Zona del Pulgar / Ergonomía Nativa) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Grabar Reunión (Acción Primaria Vigorosa) */}
        <button
          type="button"
          onClick={onStartRecording}
          className="group relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-700 active:scale-[0.97] transition-all duration-200 text-left shadow-[0_10px_25px_-5px_rgba(244,63,94,0.35)] flex flex-col justify-between h-28 border border-red-400/30"
        >
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Mic className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-200 bg-red-950/40 px-2 py-0.5 rounded-full border border-red-500/30">
              En Vivo
            </span>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white leading-tight">Grabar Reunión</h4>
            <p className="text-[11px] text-red-100/80 mt-0.5">IA transcribe y extrae acuerdos</p>
          </div>
        </button>

        {/* Finanzas & Control Presupuestal */}
        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="group relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 active:scale-[0.97] transition-all duration-200 text-left shadow-[0_10px_25px_-5px_rgba(16,185,129,0.35)] flex flex-col justify-between h-28 border border-emerald-400/30"
        >
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Cuentas
            </span>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white leading-tight">Finanzas & Gastos</h4>
            <p className="text-[11px] text-emerald-100/80 mt-0.5">Control de cuentas y vouchers</p>
          </div>
        </button>

        {/* Nueva Tarea Prioritaria */}
        <button
          type="button"
          onClick={() => setShowTaskSheet(true)}
          className="p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.97] transition-all duration-200 text-left border border-white/[0.08] shadow-md flex flex-col justify-between h-28"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-500/30">
              Acción
            </span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 leading-tight">+ Nueva Tarea</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Compromisos y pendientes</p>
          </div>
        </button>

        {/* Cuaderno Canvas Ejecutivo */}
        <button
          type="button"
          onClick={onNewNote}
          className="p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.97] transition-all duration-200 text-left border border-white/[0.08] shadow-md flex flex-col justify-between h-28"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/30">
              Canvas
            </span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 leading-tight">Libreta de Notas</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Bitácora y apuntes directivos</p>
          </div>
        </button>
      </div>

      {/* 3. Tareas Prioritarias (Touch List de Alta Precisión) */}
      <div className="p-5 rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-white/[0.08] shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Compromisos & Tareas ({pendingTasks.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowTaskSheet(true)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
          >
            + Añadir
          </button>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 space-y-1">
              <p>No hay tareas pendientes en este momento.</p>
              <p className="text-[11px] text-slate-600">Presione "+ Añadir" o dicte una tarea al asistente.</p>
            </div>
          ) : (
            tasks.slice(0, 5).map(t => {
              const isDone = t.status === 'completed';
              return (
                <div
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 active:scale-[0.98] flex items-center justify-between gap-3 cursor-pointer ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/40 opacity-40'
                      : 'bg-slate-950/80 hover:bg-slate-950 border-white/[0.06] shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => {}}
                      className="w-5 h-5 rounded-lg text-amber-500 bg-slate-900 border-slate-700 cursor-pointer shrink-0 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className={`text-xs font-medium leading-snug break-words ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {t.title}
                    </span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 ${
                    t.priority === 'high'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : t.priority === 'medium'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {t.priority}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Tarjeta de Última Minuta Ejecutiva */}
      {latestMeeting && (
        <div
          onClick={() => onNavigate('meetings')}
          className="p-5 rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-white/[0.08] shadow-lg space-y-2.5 cursor-pointer active:scale-[0.98] transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Minuta Reciente
            </span>
            <div className="flex items-center gap-1 text-xs text-indigo-400 font-semibold">
              <span>Ver Minuta</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">{latestMeeting.title}</h4>
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{latestMeeting.summary}</p>
        </div>
      )}

      {/* Bottom Sheet Nativo: Crear Tarea */}
      <BottomSheet
        isOpen={showTaskSheet}
        onClose={() => setShowTaskSheet(false)}
        title="Crear Tarea Prioritaria"
        subtitle="Se sincronizará en Supabase para todos sus dispositivos"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Descripción de la Tarea
            </label>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Ej. Revisar contrato de servicios con asesor..."
              autoFocus
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Nivel de Prioridad
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['high', 'medium', 'low'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewTaskPriority(p)}
                  className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    newTaskPriority === p
                      ? p === 'high'
                        ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                        : p === 'medium'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
            >
              Guardar y Sincronizar
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

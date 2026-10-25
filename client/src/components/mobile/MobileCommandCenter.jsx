import React, { useState, useEffect } from 'react';
import {
  Sparkles, Wallet, CheckSquare, Mic, Plus, Brain,
  ChevronRight, TrendingUp, TrendingDown, Clock, Calendar, FileText,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Layers, Download
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
    budgetLimit: 0,
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
              Saldo Neto Consolidado
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
                ${Number(financeSummary.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60">
                USD
              </span>
            </div>
          </div>

          {/* Indicadores de Flujo del Mes */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Ingresos:</span>
              <span className="font-mono font-bold text-emerald-400">
                +${Number(financeSummary.monthIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Egresos:</span>
              <span className="font-mono font-bold text-rose-400">
                -${Number(financeSummary.monthExpense || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Banner Asistente Ejecutivo Conversacional (Gemini Live) */}
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
                <h4 className="text-xs font-bold text-white tracking-tight">Asistente Ejecutivo Humano</h4>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">Voz Live</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">Habla de forma fluida y gestiona EDUS, agenda y finanzas</p>
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

      {/* 3. Acciones Rápidas (Diseño Armónico, Delicado y de Proporciones Sobrias) */}
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

      {/* 3. Compromisos & Tareas Prioritarias */}
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
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
          >
            + Añadir
          </button>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="py-5 text-center text-xs text-slate-500 space-y-1">
              <p>No hay tareas pendientes en este momento.</p>
              <p className="text-[10px] text-slate-600">Presione "+ Añadir" o dicte una orden al asistente.</p>
            </div>
          ) : (
            tasks.slice(0, 5).map(t => {
              const isDone = t.status === 'completed';
              return (
                <div
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className={`p-3 rounded-xl border transition-all duration-150 active:scale-[0.99] flex items-center justify-between gap-3 cursor-pointer ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/40 opacity-40'
                      : 'bg-slate-950/80 hover:bg-slate-950 border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                    />
                    <span className={`text-xs font-medium leading-snug break-words ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {t.title}
                    </span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
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
              placeholder="Ej. Revisar contrato de servicios..."
              autoFocus
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
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
                  className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
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
    </div>
  );
}

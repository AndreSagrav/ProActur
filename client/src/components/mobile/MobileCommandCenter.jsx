import React, { useState, useEffect } from 'react';
import {
  Sparkles, Wallet, CheckSquare, Mic, Plus, Brain,
  ChevronRight, TrendingUp, TrendingDown, Clock, Calendar, FileText
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

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      {/* 1. Tarjeta Resumen Ejecutivo Superior */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/30 border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Centro de Mando
          </span>
          <span className="text-xs font-mono font-bold text-slate-400">
            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Consolidado</span>
            <div className="text-2xl font-black text-white mt-0.5">
              ${financeSummary.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">MXN</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Presupuesto</span>
            <div className="text-xs font-bold text-amber-300 mt-0.5">
              {budgetUsage}% ejercido
            </div>
          </div>
        </div>

        {/* Barra de Presupuesto */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${budgetUsage > 85 ? 'bg-rose-500' : 'bg-amber-400'}`}
            style={{ width: `${budgetUsage}%` }}
          />
        </div>
      </div>

      {/* 2. Cuadrícula Táctil de Acciones Principales (Zona del Pulgar) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Grabar Reunión */}
        <button
          type="button"
          onClick={onStartRecording}
          className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 active:scale-95 text-white font-bold text-left shadow-lg shadow-red-600/20 transition-all flex flex-col justify-between h-24"
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold leading-tight">Grabar Reunión</span>
        </button>

        {/* Registrar Finanzas */}
        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 active:scale-95 text-white font-bold text-left shadow-lg shadow-emerald-600/20 transition-all flex flex-col justify-between h-24"
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold leading-tight">Finanzas & Gastos</span>
        </button>

        {/* Nueva Tarea */}
        <button
          type="button"
          onClick={() => setShowTaskSheet(true)}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 active:scale-95 text-white font-bold text-left shadow-md transition-all flex flex-col justify-between h-24"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-200 leading-tight">+ Nueva Tarea</span>
        </button>

        {/* Abrir Libreta */}
        <button
          type="button"
          onClick={onNewNote}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 active:scale-95 text-white font-bold text-left shadow-md transition-all flex flex-col justify-between h-24"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-200 leading-tight">Cuaderno de Notas</span>
        </button>
      </div>

      {/* 3. Tareas y Pendientes Prioritarios */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-indigo-400" /> Tareas Prioritarias ({tasks.filter(t => t.status !== 'completed').length})
          </h3>
          <button
            type="button"
            onClick={() => setShowTaskSheet(true)}
            className="text-xs font-bold text-indigo-400"
          >
            + Añadir
          </button>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">No hay tareas pendientes registradas</p>
          ) : (
            tasks.slice(0, 5).map(t => {
              const isDone = t.status === 'completed';
              return (
                <div
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className={`p-3.5 rounded-2xl border transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/40 opacity-40'
                      : 'bg-slate-950/90 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => {}}
                      className="w-5 h-5 rounded-lg text-amber-500 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                    />
                    <span className={`text-xs font-medium truncate ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {t.title}
                    </span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 ${
                    t.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {t.priority}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Última Reunión */}
      {latestMeeting && (
        <div
          onClick={() => onNavigate('meetings')}
          className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-2 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Última Minuta
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
          <h4 className="text-xs font-bold text-white truncate">{latestMeeting.title}</h4>
          <p className="text-[11px] text-slate-400 line-clamp-2">{latestMeeting.summary}</p>
        </div>
      )}

      {/* Bottom Sheet: Crear Tarea */}
      <BottomSheet
        isOpen={showTaskSheet}
        onClose={() => setShowTaskSheet(false)}
        title="Nueva Tarea Prioritaria"
        subtitle="Se registrará en su lista y se sincronizará en la nube"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Descripción de la Tarea</label>
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="Ej. Revisar cotización y firmar contrato..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Prioridad</label>
            <div className="grid grid-cols-3 gap-2">
              {['high', 'medium', 'low'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewTaskPriority(p)}
                  className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                    newTaskPriority === p
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-950 border border-slate-800 text-slate-400'
                  }`}
                >
                  {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Guardar Tarea
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}

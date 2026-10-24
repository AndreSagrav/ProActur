import React, { useState, useEffect } from 'react';
import {
  Sparkles, DollarSign, CheckSquare, Calendar, FileText, ArrowUpRight,
  TrendingUp, TrendingDown, Clock, AlertCircle, Plus, Mic, Brain,
  ChevronRight, Wallet, ShieldAlert, X
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function CommandCenterView({
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
    budgetLimit: 20000.00,
    accounts: [],
    recentTransactions: []
  });

  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [newTx, setNewTx] = useState({
    amount: '',
    category: 'Gasolina',
    note: '',
    type: 'gasto'
  });

  const fetchFinance = async () => {
    try {
      const res = await fetch(`${API}/api/finance/summary`);
      if (res.ok) {
        const data = await res.json();
        setFinanceSummary(data);
      }
    } catch (err) {
      console.warn('[Finance Load Warn]', err);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleSaveTx = async (e) => {
    e.preventDefault();
    if (!newTx.amount || isNaN(newTx.amount)) return;
    try {
      const res = await fetch(`${API}/api/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      });
      if (res.ok) {
        setShowAddTxModal(false);
        setNewTx({ amount: '', category: 'Gasolina', note: '', type: 'gasto' });
        fetchFinance();
      }
    } catch (err) {
      console.error('[Add Tx Error]', err);
    }
  };

  const [tasks, setTasks] = useState([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API}/api/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchFinance();
    fetchTasks();
  }, []);

  const toggleTask = async (id) => {
    // Optimista
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
        setShowAddTaskModal(false);
        fetchTasks();
      }
    } catch (_) {}
  };

  const latestMeeting = meetings[0] || null;
  const pendingActionsCount = meetings.reduce((acc, m) => acc + (m.actionItems?.filter(a => !a.done)?.length || 0), 0);
  const budgetPercent = Math.min(100, Math.round((financeSummary.monthExpense / financeSummary.budgetLimit) * 100));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. BRIEFING EJECUTIVO DE IA (Tarjeta Superior de Impacto) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/30 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Briefing del Día · Asistente Activo</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Centro de Mando ProActur
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Tienes <strong className="text-amber-300">{tasks.filter(t => !t.done).length} tareas prioritarias</strong> para hoy, 
              un gasto mensual al <strong className="text-amber-300">{budgetPercent}%</strong> de tu presupuesto y 
              <strong className="text-white"> {pendingActionsCount} acuerdos pendientes</strong> de tus reuniones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onStartRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Grabar Reunión</span>
            </button>
            <button
              type="button"
              onClick={onNewNote}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Nueva Nota</span>
            </button>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              <Brain className="w-4 h-4 text-indigo-400" />
              <span>Consultar IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REJILLA DEL CENTRO DE MANDO (Finanzas + Tareas + Reuniones) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUMNA FINANZAS (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Finanzas & Cuentas</h3>
                  <p className="text-xs text-slate-400">Control de flujo y presupuestos</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => onNavigate && onNavigate('finance')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                  title="Abrir módulo completo de Finanzas"
                >
                  <span>Detalle</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddTxModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Movimiento</span>
                </button>
              </div>
            </div>

            {/* Tarjeta de Saldo */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo Total Disponible</span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                  ${financeSummary.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-normal">MXN</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400">Presupuesto Mes</span>
                <div className="text-xs font-bold text-slate-200 mt-1">
                  ${financeSummary.monthExpense.toLocaleString('es-MX')} / ${financeSummary.budgetLimit.toLocaleString('es-MX')}
                </div>
                <div className="w-28 bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 ml-auto">
                  <div 
                    className={`h-full rounded-full ${budgetPercent > 85 ? 'bg-rose-500' : 'bg-amber-400'}`}
                    style={{ width: `${budgetPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Movimientos Recientes */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Últimos Movimientos</span>
              <div className="divide-y divide-slate-800/60">
                {financeSummary.recentTransactions.map(tx => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                        tx.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {tx.type === 'income' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">{tx.category}</div>
                        <div className="text-[10px] text-slate-400">{tx.note} · {tx.date}</div>
                      </div>
                    </div>
                    <div className={`text-xs font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('es-MX')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA TAREAS & ACUERDOS (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Tareas & Pendientes</h3>
                  <p className="text-xs text-slate-400">Extraídas de reuniones y manuales</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tarea</span>
                </button>
              </div>
            </div>

            {/* Lista de Tareas */}
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No hay tareas pendientes</p>
              ) : (
                tasks.map(t => {
                  const isDone = t.status === 'completed';
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => toggleTask(t.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isDone 
                          ? 'bg-slate-950/40 border-slate-800/40 opacity-50' 
                          : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input 
                          type="checkbox" 
                          checked={isDone} 
                          onChange={() => {}} 
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {t.title}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : 'Sin fecha'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                        t.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tarjeta de Última Reunión */}
            {latestMeeting && (
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Última Reunión Registrada</span>
                  <button 
                    type="button"
                    onClick={() => onNavigate?.('meetings')} 
                    className="text-[11px] text-indigo-400 hover:underline font-bold cursor-pointer"
                  >
                    Abrir minuta
                  </button>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-white truncate">{latestMeeting.title}</h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(latestMeeting.createdAt).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2">
                    {latestMeeting.summary || 'Minuta lista con acuerdos y puntos de seguimiento.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL REGISTRO RÁPIDO DE MOVIMIENTO FINANCIERO */}
      {showAddTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Nuevo Movimiento</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddTxModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTx} className="space-y-3">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewTx(prev => ({ ...prev, type: 'gasto' }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    newTx.type === 'gasto' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setNewTx(prev => ({ ...prev, type: 'ingreso' }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    newTx.type === 'ingreso' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400'
                  }`}
                >
                  Ingreso
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Monto ($ MXN)</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={newTx.amount}
                  onChange={e => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-bold text-base focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Categoría</label>
                <select
                  value={newTx.category}
                  onChange={e => setNewTx(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Gasolina">Gasolina / Transporte</option>
                  <option value="Almuerzo">Comida / Restaurante</option>
                  <option value="Supermercado">Supermercado</option>
                  <option value="Servicios">Servicios / Nube</option>
                  <option value="Honorarios">Honorarios / Clientes</option>
                  <option value="Varios">Varios</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Detalle / Nota</label>
                <input
                  type="text"
                  placeholder="Ej. Pago servicio AWS..."
                  value={newTx.note}
                  onChange={e => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA TAREA */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Nueva Tarea</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Título de la Tarea</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej. Revisar informe con el equipo..."
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prioridad</label>
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskPriority(p)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        newTaskPriority === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : 'Alta'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                >
                  Crear Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

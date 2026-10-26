import React, { useState, useEffect } from 'react';
import {
  Sparkles, DollarSign, CheckSquare, Calendar, FileText, ArrowUpRight,
  TrendingUp, TrendingDown, Clock, AlertCircle, Plus, Mic, Brain,
  ChevronRight, Wallet, ShieldAlert, X, Edit3, Trash2, CheckCircle2
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
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTaskNotes, setNewTaskNotes] = useState('');

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

  const toggleTask = async (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation();
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
        setShowAddTaskModal(false);
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

  const latestMeeting = meetings[0] || null;
  const pendingActionsCount = meetings.reduce((acc, m) => acc + (m.actionItems?.filter(a => !a.done)?.length || 0), 0);
  const hasBudget = Number(financeSummary.budgetLimit) > 0;
  const budgetPercent = hasBudget
    ? Math.min(100, Math.round(((financeSummary.monthExpense || 0) / financeSummary.budgetLimit) * 100))
    : 0;

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
              {hasBudget ? (
                <> un gasto mensual al <strong className="text-amber-300">{budgetPercent}%</strong> de tu presupuesto y </>
              ) : (
                <> un gasto registrado de <strong className="text-white">₡{Number(financeSummary.monthExpense || 0).toLocaleString('es-CR')}</strong> este mes y </>
              )}
              <strong className="text-white"> {pendingActionsCount} acuerdos pendientes</strong> de tus reuniones.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={onStartRecording}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer text-center"
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span className="truncate">Grabar</span>
            </button>
            <button
              type="button"
              onClick={onNewNote}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition-all active:scale-95 cursor-pointer text-center"
            >
              <Plus className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">Nota</span>
            </button>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all active:scale-95 cursor-pointer text-center"
            >
              <Brain className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Consultar</span>
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
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo Total Disponible</span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                  ₡{Number(financeSummary.balanceCRC ?? financeSummary.balance ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })} <span className="text-xs text-emerald-400 font-bold">CRC</span>
                </div>
                <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5">
                  <span>Dólares:</span>
                  <span className="font-bold text-slate-300 font-mono">${Number(financeSummary.balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[11px] text-slate-400 font-medium">
                  {hasBudget ? 'Presupuesto Mes' : 'Gastos del Mes'}
                </span>
                <div className="text-xs font-bold text-slate-200 mt-1 font-mono">
                  {hasBudget ? (
                    `₡${Number(financeSummary.monthExpense || 0).toLocaleString('es-CR')} / ₡${Number(financeSummary.budgetLimit || 0).toLocaleString('es-CR')}`
                  ) : (
                    `₡${Number(financeSummary.monthExpense || 0).toLocaleString('es-CR')}`
                  )}
                </div>
                {hasBudget ? (
                  <div className="w-28 bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 sm:ml-auto">
                    <div 
                      className={`h-full rounded-full ${budgetPercent > 85 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                    Sin límite configurado
                  </span>
                )}
              </div>
            </div>

            {/* Movimientos Recientes */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Últimos Movimientos</span>
              <div className="divide-y divide-slate-800/60">
                {financeSummary.recentTransactions.map(tx => {
                  const isUSD = (tx.currency || '').toUpperCase() === 'USD';
                  const symbol = isUSD ? '$' : '₡';
                  const formattedAmt = Number(tx.amount || 0).toLocaleString(isUSD ? 'en-US' : 'es-CR', { minimumFractionDigits: 2 });
                  const formattedDate = (() => {
                    if (!tx.date) return '';
                    try {
                      const d = new Date(tx.date);
                      if (isNaN(d.getTime())) return tx.date;
                      return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    } catch (_) {
                      return tx.date;
                    }
                  })();

                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                          tx.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {tx.type === 'income' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200">{tx.category}</div>
                          <div className="text-[10px] text-slate-400">{tx.note} · {formattedDate}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-bold font-mono ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {tx.type === 'income' ? '+' : '-'}{symbol}{formattedAmt}
                      </div>
                    </div>
                  );
                })}
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
                      onClick={() => setEditingTask(t)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isDone 
                          ? 'bg-slate-950/40 border-slate-800/40 opacity-50' 
                          : 'bg-slate-950/80 border-slate-800/90 hover:border-indigo-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => toggleTask(e, t.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                            isDone ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                          }`}
                        >
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {t.dueDate && (
                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 font-mono">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(t.dueDate).toLocaleDateString('es-CR', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {t.notes && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                • {t.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          t.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : t.priority === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}
                          title="Editar tarea"
                          className="p-1.5 text-slate-400 hover:text-indigo-400 active:scale-90 transition-all rounded-lg hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }}
                          title="Eliminar tarea"
                          className="p-1.5 text-slate-500 hover:text-rose-400 active:scale-90 transition-all rounded-lg hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
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
                      {new Date(latestMeeting.createdAt).toLocaleDateString('es-CR')}
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
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Monto ($ USD)</label>
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
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Título de la Tarea *</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Límite</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prioridad</label>
                  <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 gap-0.5">
                    {['low', 'medium', 'high'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskPriority(p)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          newTaskPriority === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : 'Alta'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Detalles / Notas</label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionales o contexto..."
                  value={newTaskNotes}
                  onChange={e => setNewTaskNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
                />
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

      {/* MODAL EDITAR TAREA */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Editar Tarea</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Título de la Tarea *</label>
                <input
                  type="text"
                  required
                  value={editingTask.title || ''}
                  onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Límite</label>
                  <input
                    type="date"
                    value={editingTask.dueDate ? editingTask.dueDate.slice(0, 10) : (editingTask.due_date ? editingTask.due_date.slice(0, 10) : '')}
                    onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prioridad</label>
                  <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 gap-0.5">
                    {['low', 'medium', 'high'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditingTask({ ...editingTask, priority: p })}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          editingTask.priority === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : 'Alta'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask({ ...editingTask, status: 'pending' })}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      editingTask.status !== 'completed' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    ⏳ Pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTask({ ...editingTask, status: 'completed' })}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      editingTask.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    ✅ Completada
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Detalles / Notas</label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionales o contexto..."
                  value={editingTask.notes || ''}
                  onChange={e => setEditingTask({ ...editingTask, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteTask(editingTask.id)}
                  className="px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

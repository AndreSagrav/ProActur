import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, Filter,
  Search, CreditCard, Banknote, Landmark, AlertCircle, ArrowUpRight,
  PieChart, RefreshCw, X
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const CATEGORIES = {
  gasto: ['Gasolina y Transporte', 'Alimentación y Reuniones', 'Servicios y Software', 'Equipamiento', 'Honorarios y Nómina', 'Varios'],
  ingreso: ['Honorarios Profesionales', 'Cobro de Clientes', 'Rendimientos', 'Otros Ingresos']
};

export default function FinanceView() {
  const [financeData, setFinanceData] = useState({
    balance: 0,
    monthIncome: 0,
    monthExpense: 0,
    budgetLimit: 20000,
    accounts: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'gasto' | 'ingreso'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newTx, setNewTx] = useState({
    accountId: '',
    type: 'gasto',
    category: 'Gasolina y Transporte',
    note: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10)
  });

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/finance/summary`);
      if (res.ok) {
        const data = await res.json();
        setFinanceData(data);
        if (!newTx.accountId && data.accounts?.length > 0) {
          setNewTx(prev => ({ ...prev, accountId: data.accounts[0].id }));
        }
      }
    } catch (err) {
      console.warn('[FinanceView Load Warn]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const handleCreateTx = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(newTx.amount);
    if (!amountVal || isNaN(amountVal)) return;

    try {
      const res = await fetch(`${API}/api/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTx,
          amount: amountVal
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewTx({
          accountId: financeData.accounts[0]?.id || '',
          type: 'gasto',
          category: 'Gasolina y Transporte',
          note: '',
          amount: '',
          date: new Date().toISOString().slice(0, 10)
        });
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Create Tx Error]', err);
    }
  };

  const handleDeleteTx = async (id) => {
    if (!confirm('¿Confirma la eliminación de este registro contable?')) return;
    try {
      const res = await fetch(`${API}/api/finance/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Delete Tx Error]', err);
    }
  };

  const filteredTransactions = (financeData.recentTransactions || []).filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (tx.category || '').toLowerCase().includes(q) ||
        (tx.note || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const budgetUsage = Math.min(100, Math.round((financeData.monthExpense / (financeData.budgetLimit || 1)) * 100));

  // Agrupación por categoría de egresos
  const expenseByCategory = (financeData.recentTransactions || [])
    .filter(t => t.type === 'gasto')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

  const totalExpensesSum = Object.values(expenseByCategory).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 1. Header Ejecutivo de Métricas Financieras */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Landmark className="w-3.5 h-3.5" />
            <span>Módulo de Control Financiero y Presupuestal</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gestión Financiera Ejecutiva
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Consolidación de cuentas, flujo operativo y ejecución presupuestaria
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchFinanceData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Indicadores Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Disponible */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Saldo Total Disponible</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ${Number(financeData.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Consolidado en todas las cuentas activas</p>
        </div>

        {/* Ingresos del Mes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Ingresos del Periodo</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            +${Number(financeData.monthIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Honorarios y cobranza registrada</p>
        </div>

        {/* Egresos del Mes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Egresos Totales</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-slate-100">
            -${Number(financeData.monthExpense || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Operación y viáticos ejecutados</p>
        </div>

        {/* Presupuesto */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Límite Presupuestal</span>
            <span className="text-xs font-bold text-amber-400">{budgetUsage}%</span>
          </div>
          <div className="text-xl font-black text-white">
            ${financeData.monthExpense.toLocaleString('es-MX')} / ${financeData.budgetLimit.toLocaleString('es-MX')}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetUsage > 85 ? 'bg-rose-500' : 'bg-amber-400'
              }`}
              style={{ width: `${budgetUsage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Rejilla: Cuentas Registradas & Desglose de Gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cuentas (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              Cuentas e Instrumentos
            </h3>
            <span className="text-xs text-slate-500">{financeData.accounts?.length || 0} registradas</span>
          </div>

          <div className="space-y-3">
            {financeData.accounts?.map(acc => (
              <div
                key={acc.id}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md"
                    style={{ backgroundColor: acc.color || '#4f46e5' }}
                  >
                    {acc.type === 'efectivo' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{acc.name}</h4>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {acc.type} · {acc.currency || 'USD'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-black ${acc.balance < 0 ? 'text-rose-400' : 'text-slate-100'}`}>
                    ${Number(acc.balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desglose por Categoría (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-400" />
              Distribución de Gastos por Categoría
            </h3>
            <span className="text-xs text-slate-500">Periodo actual</span>
          </div>

          {Object.keys(expenseByCategory).length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No hay gastos clasificados en este periodo.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {Object.entries(expenseByCategory).map(([cat, amount]) => {
                const pct = Math.round((amount / totalExpensesSum) * 100);
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">{cat}</span>
                      <span className="font-mono font-bold text-slate-100">
                        ${amount.toLocaleString('es-MX')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Libro Diario de Movimientos / Transacciones */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Libro de Transacciones</h3>
            <p className="text-xs text-slate-400">Historial contable y detalle de pólizas</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtros Tipo */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'gasto', label: 'Egresos' },
                { key: 'ingreso', label: 'Ingresos' }
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterType(f.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filterType === f.key
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por concepto..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Tabla / Lista de Transacciones */}
        <div className="divide-y divide-slate-800/80 pt-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No se encontraron movimientos registrados.</p>
          ) : (
            filteredTransactions.map(tx => (
              <div
                key={tx.id}
                className="py-3.5 flex items-center justify-between gap-4 group hover:bg-slate-800/30 px-3 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'ingreso'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {tx.type === 'ingreso' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200 truncate">{tx.category}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(tx.date || Date.now()).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    {tx.note && <p className="text-xs text-slate-400 truncate mt-0.5">{tx.note}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={`text-sm font-mono font-bold ${
                      tx.type === 'ingreso' ? 'text-emerald-400' : 'text-slate-100'
                    }`}
                  >
                    {tx.type === 'ingreso' ? '+' : '-'}${Number(tx.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTx(tx.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Eliminar movimiento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Registro de Movimiento Contable */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Registrar Movimiento Financiero
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="space-y-4">
              {/* Tipo de Movimiento */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewTx(prev => ({ ...prev, type: 'gasto', category: CATEGORIES.gasto[0] }))}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    newTx.type === 'gasto'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Egreso / Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setNewTx(prev => ({ ...prev, type: 'ingreso', category: CATEGORIES.ingreso[0] }))}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    newTx.type === 'ingreso'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ingreso / Cobro
                </button>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monto ($ USD / ₡ CRC)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newTx.amount}
                  onChange={e => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Cuenta */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cuenta de Cargo / Abono</label>
                <select
                  value={newTx.accountId}
                  onChange={e => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {financeData.accounts?.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                <select
                  value={newTx.category}
                  onChange={e => setNewTx(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {CATEGORIES[newTx.type].map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nota / Concepto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Concepto / Referencia</label>
                <input
                  type="text"
                  value={newTx.note}
                  onChange={e => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Descripción del movimiento..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha</label>
                <input
                  type="date"
                  value={newTx.date}
                  onChange={e => setNewTx(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

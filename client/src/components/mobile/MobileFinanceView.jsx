import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2,
  CreditCard, Banknote, Landmark, Filter, RefreshCw
} from 'lucide-react';
import BottomSheet from './BottomSheet';

const API = import.meta.env.VITE_API_URL || '';

const CATEGORIES = {
  gasto: ['Gasolina y Transporte', 'Alimentación y Reuniones', 'Servicios y Software', 'Equipamiento', 'Honorarios y Nómina', 'Varios'],
  ingreso: ['Honorarios Profesionales', 'Cobro de Clientes', 'Rendimientos', 'Otros Ingresos']
};

export default function MobileFinanceView() {
  const [financeData, setFinanceData] = useState({
    balance: 0,
    monthIncome: 0,
    monthExpense: 0,
    budgetLimit: 20000,
    accounts: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const [newTx, setNewTx] = useState({
    accountId: '',
    type: 'gasto',
    category: 'Gasolina y Transporte',
    note: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10)
  });

  const fetchFinance = async () => {
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
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleCreateTx = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(newTx.amount);
    if (!amountVal || isNaN(amountVal)) return;

    try {
      const res = await fetch(`${API}/api/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTx, amount: amountVal })
      });
      if (res.ok) {
        setShowAddSheet(false);
        setNewTx({
          accountId: financeData.accounts[0]?.id || '',
          type: 'gasto',
          category: 'Gasolina y Transporte',
          note: '',
          amount: '',
          date: new Date().toISOString().slice(0, 10)
        });
        fetchFinance();
      }
    } catch (_) {}
  };

  const handleDeleteTx = async (id) => {
    if (!confirm('¿Eliminar este registro contable?')) return;
    try {
      const res = await fetch(`${API}/api/finance/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) fetchFinance();
    } catch (_) {}
  };

  const filteredTransactions = (financeData.recentTransactions || []).filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    return true;
  });

  const budgetUsage = Math.min(100, Math.round((financeData.monthExpense / (financeData.budgetLimit || 1)) * 100));

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* 1. Header Financiero */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Finanzas & Cuentas</h2>
          <p className="text-xs text-slate-400">Control de flujo y tarjetas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchFinance}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Movimiento</span>
          </button>
        </div>
      </div>

      {/* 2. Carrusel Horizontal Táctil de Cuentas (Swipeable Cards) */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuentas Registradas (Deslizar)</span>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {financeData.accounts?.map(acc => (
            <div
              key={acc.id}
              className="min-w-[240px] p-4 rounded-2xl bg-slate-900 border border-slate-800/90 shadow-lg snap-start flex flex-col justify-between h-28"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 truncate">{acc.name}</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">{acc.type}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Saldo</span>
                <div className={`text-xl font-black ${acc.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ${Number(acc.balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-normal">MXN</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Indicadores de Ingreso / Egreso */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold">Ingresos</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-black text-emerald-400">
            +${financeData.monthIncome.toLocaleString('es-MX')}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold">Egresos</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-base font-black text-slate-100">
            -${financeData.monthExpense.toLocaleString('es-MX')}
          </div>
        </div>
      </div>

      {/* 4. Lista de Transacciones Táctil */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Historial de Movimientos</span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {['all', 'gasto', 'ingreso'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                  filterType === t ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'gasto' ? 'Gastos' : 'Ingresos'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No hay movimientos registrados</p>
          ) : (
            filteredTransactions.map(tx => (
              <div
                key={tx.id}
                className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between gap-3 shadow-sm active:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'ingreso'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tx.type === 'ingreso' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-200 truncate">{tx.category}</h4>
                    <p className="text-[11px] text-slate-400 truncate">{tx.note || 'Sin nota'} · {new Date(tx.date || Date.now()).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={`text-sm font-mono font-bold ${tx.type === 'ingreso' ? 'text-emerald-400' : 'text-slate-100'}`}>
                    {tx.type === 'ingreso' ? '+' : '-'}${Number(tx.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTx(tx.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Sheet: Registrar Movimiento */}
      <BottomSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Registrar Movimiento"
        subtitle="Ingreso o egreso contable sincronizado en Supabase"
      >
        <form onSubmit={handleCreateTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setNewTx(prev => ({ ...prev, type: 'gasto', category: CATEGORIES.gasto[0] }))}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                newTx.type === 'gasto' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400'
              }`}
            >
              Egreso / Gasto
            </button>
            <button
              type="button"
              onClick={() => setNewTx(prev => ({ ...prev, type: 'ingreso', category: CATEGORIES.ingreso[0] }))}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                newTx.type === 'ingreso' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'
              }`}
            >
              Ingreso / Cobro
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Monto (MXN)</label>
            <input
              type="number"
              step="0.01"
              required
              value={newTx.amount}
              onChange={e => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-lg font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Cuenta</label>
            <select
              value={newTx.accountId}
              onChange={e => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {financeData.accounts?.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
            <select
              value={newTx.category}
              onChange={e => setNewTx(prev => ({ ...prev, category: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIES[newTx.type].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Concepto / Referencia</label>
            <input
              type="text"
              value={newTx.note}
              onChange={e => setNewTx(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Descripción del movimiento..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            Guardar Movimiento
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2,
  CreditCard, Banknote, Landmark, Filter, RefreshCw,
  ArrowUpRight, ArrowDownRight, Tag, Calendar, CheckCircle2
} from 'lucide-react';
import BottomSheet from './BottomSheet';

const API = import.meta.env.VITE_API_URL || '';

const CATEGORIES = {
  gasto: [
    'Gasolina y Transporte',
    'Alimentación y Reuniones',
    'Servicios y Software',
    'Equipamiento',
    'Honorarios y Nómina',
    'Varios'
  ],
  ingreso: [
    'Honorarios Profesionales',
    'Cobro de Clientes',
    'Rendimientos',
    'Otros Ingresos'
  ]
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

  return (
    <div className="space-y-4 animate-fade-in pb-16 select-none">
      {/* 1. Header Ejecutivo de Finanzas */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h2 className="text-base font-extrabold text-white tracking-tight">Finanzas & Liquidez</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Control de cuentas, tarjetas y comprobantes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchFinance}
            className="p-2 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-400 hover:text-white active:scale-95 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Movimiento</span>
          </button>
        </div>
      </div>

      {/* 2. Carrusel de Tarjetas y Cuentas (Apple Wallet / Elite Style) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Billetera Directiva (Deslizar)
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {financeData.accounts?.length || 0} cuentas
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory -mx-1 px-1">
          {financeData.accounts?.map((acc, idx) => {
            const isNegative = Number(acc.balance) < 0;
            const gradients = [
              'from-slate-900 via-indigo-950/80 to-slate-950 border-indigo-500/30',
              'from-slate-900 via-emerald-950/80 to-slate-950 border-emerald-500/30',
              'from-slate-900 via-purple-950/80 to-slate-950 border-purple-500/30'
            ];
            const cardGrad = gradients[idx % gradients.length];

            return (
              <div
                key={acc.id}
                className={`min-w-[270px] sm:min-w-[300px] p-5 rounded-3xl bg-gradient-to-br ${cardGrad} border shadow-[0_12px_30px_rgba(0,0,0,0.5)] snap-start flex flex-col justify-between h-36 relative overflow-hidden`}
              >
                {/* Chip Metálico Simulado */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded-md bg-gradient-to-br from-amber-400/80 to-yellow-600/60 border border-yellow-300/40 shadow-inner flex items-center justify-center">
                      <div className="w-4 h-3 border border-yellow-800/40 rounded-sm" />
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate">{acc.name}</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950/60 text-slate-300 border border-white/[0.08]">
                    {acc.type}
                  </span>
                </div>

                {/* Saldo de la Cuenta */}
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Saldo Disponible
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-2xl font-black font-mono tracking-tight ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {acc.currency === 'CRC' ? '₡' : '$'}{Number(acc.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">{acc.currency || 'USD'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Indicadores de Flujo Mensual */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Ingresos del Mes</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            +${(financeData.monthIncome || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Egresos del Mes</span>
            <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>
          <div className="text-lg font-black text-rose-400 font-mono">
            -${(financeData.monthExpense || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* 4. Historial de Transacciones (Feed Táctil de Alta Legibilidad) */}
      <div className="p-5 rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-white/[0.08] shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Movimientos ({filteredTransactions.length})
          </span>

          {/* Filtro de Tipo */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/[0.08]">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'gasto', label: 'Gastos' },
              { id: 'ingreso', label: 'Ingresos' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(t.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  filterType === t.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No hay movimientos registrados en este filtro.
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const isIncome = tx.type === 'ingreso';
              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-white/[0.05] flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isIncome
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    }`}>
                      {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug break-words">
                        {tx.note || tx.category || 'Movimiento'}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{new Date(tx.date || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-black font-mono ${isIncome ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {isIncome ? '+' : '-'}${Number(tx.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTx(tx.id)}
                      className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg active:scale-95 transition-all"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Sheet: Registrar Movimiento / Factura */}
      <BottomSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Registrar Movimiento Financiero"
        subtitle="Se afectará el saldo de su cuenta y se respaldará en Supabase"
      >
        <form onSubmit={handleCreateTx} className="space-y-4">
          {/* Selector Gasto / Ingreso */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setNewTx(p => ({ ...p, type: 'gasto', category: CATEGORIES.gasto[0] }))}
              className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                newTx.type === 'gasto'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Egreso / Gasto
            </button>
            <button
              type="button"
              onClick={() => setNewTx(p => ({ ...p, type: 'ingreso', category: CATEGORIES.ingreso[0] }))}
              className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                newTx.type === 'ingreso'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ingreso / Cobro
            </button>
          </div>

          {/* Importe Monetario */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Importe ($ USD / ₡ CRC)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-lg font-bold text-slate-500">$</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={newTx.amount}
                onChange={(e) => setNewTx(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                autoFocus
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-9 pr-4 py-3.5 text-xl font-bold font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Cuenta Bancaria */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Cuenta de Cargo / Abono
            </label>
            <select
              value={newTx.accountId}
              onChange={(e) => setNewTx(p => ({ ...p, accountId: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {financeData.accounts?.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency === 'CRC' ? '₡' : '$'}{Number(acc.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {acc.currency || 'USD'})
                </option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Categoría
            </label>
            <select
              value={newTx.category}
              onChange={(e) => setNewTx(p => ({ ...p, category: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {(CATEGORIES[newTx.type] || []).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Concepto / Nota / Factura */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Concepto / Voucher / Factura
            </label>
            <input
              type="text"
              value={newTx.note}
              onChange={(e) => setNewTx(p => ({ ...p, note: e.target.value }))}
              placeholder="Ej. Factura #A-901 de Gasolina Shell"
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!newTx.amount || parseFloat(newTx.amount) <= 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
            >
              Guardar Movimiento
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

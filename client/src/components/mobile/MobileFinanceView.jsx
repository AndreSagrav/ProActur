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
    <div className="space-y-3 animate-fade-in pb-16 select-none">
      {/* 1. Panel Ejecutivo Consolidado (Estilo Private Banking / Stripe) */}
      <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-white/[0.08] shadow-lg space-y-3">
        {/* Fila Superior: Liquidez Principal + Acciones */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Liquidez Consolidada
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                ${Number(financeData.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">USD</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchFinance}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95 border border-white/[0.06]"
              title="Actualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddSheet(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Movimiento</span>
            </button>
          </div>
        </div>

        {/* Fila Inferior: Métricas Compactas de Flujo (Línea Mínima, Cero Cajas Pesadas) */}
        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-tight">Ingresos</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 truncate block">
                +${Number(financeData.monthIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/[0.06] pl-3">
            <div className="w-6 h-6 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-tight">Egresos</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-200 truncate block">
                -${Number(financeData.monthExpense || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Cuentas e Instrumentos (Lista Directiva Compacta de Alta Densidad) */}
      <div className="bg-slate-900/70 border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.05] shadow-sm">
        <div className="px-3.5 py-2 bg-white/[0.02] flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Cuentas e Instrumentos
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {financeData.accounts?.length || 0} registradas
          </span>
        </div>

        {financeData.accounts?.map((acc) => {
          const isNegative = Number(acc.balance) < 0;
          const currencySymbol = acc.currency === 'CRC' ? '₡' : '$';

          return (
            <div
              key={acc.id}
              className="px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.08]"
                  style={{ backgroundColor: `${acc.color || '#4f46e5'}20`, color: acc.color || '#818cf8' }}
                >
                  {acc.type === 'efectivo' ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {acc.name}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06] shrink-0">
                  {acc.currency || 'USD'}
                </span>
              </div>

              <div className="text-right shrink-0 ml-2">
                <span className={`text-xs sm:text-sm font-mono font-bold ${isNegative ? 'text-rose-400' : 'text-slate-100'}`}>
                  {currencySymbol}{Number(acc.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Historial de Transacciones (Feed Táctil Compacto y Nítido) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/[0.07] shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
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
                  className="p-2.5 sm:p-3 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-white/[0.05] flex items-center justify-between gap-2.5 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isIncome
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    }`}>
                      {isIncome ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-100 truncate">
                        {tx.note || tx.category || 'Movimiento'}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{new Date(tx.date || Date.now()).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-xs sm:text-sm font-black font-mono ${isIncome ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {isIncome ? '+' : '-'}${Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTx(tx.id)}
                      className="text-slate-600 hover:text-rose-400 p-1 rounded-md active:scale-95 transition-all"
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

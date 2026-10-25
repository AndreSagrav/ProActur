import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2,
  CreditCard, Banknote, Landmark, Filter, RefreshCw,
  ArrowUpRight, ArrowDownRight, Tag, Calendar, CheckCircle2,
  Mail, ShieldCheck, Zap, AlertCircle, Play, X, Edit3
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
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' | 'loans' | 'mailbox'
  const [financeData, setFinanceData] = useState({
    balance: 0,
    creditDebt: 0,
    monthIncome: 0,
    monthExpense: 0,
    budgetLimit: 500000,
    accounts: [],
    loans: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showAddSheet, setShowAddSheet] = useState(false);

  // Estados de correo
  const [mailConfig, setMailConfig] = useState({ email: '', appPassword: '', enabled: true, autoRecord: true });
  const [mailLogs, setMailLogs] = useState([]);
  const [simulating, setSimulating] = useState(false);

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
    } catch (err) {
      console.warn('[MobileFinance Load Warn]', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMailData = async () => {
    try {
      const res = await fetch(`${API}/api/finance/mail-config`);
      if (res.ok) {
        const data = await res.json();
        setMailConfig(data.config || {});
        setMailLogs(data.logs || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchFinance();
    fetchMailData();
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
    } catch (err) {
      console.error('[Create Tx Mobile Error]', err);
    }
  };

  const handleDeleteTx = async (id) => {
    if (!confirm('¿Eliminar este movimiento contable?')) return;
    try {
      const res = await fetch(`${API}/api/finance/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) fetchFinance();
    } catch (err) {
      console.error('[Delete Tx Error]', err);
    }
  };

  const handlePayLoan = async (loan) => {
    if (!confirm(`¿Pagar cuota de ₡${(loan.monthlyInstallment || 0).toLocaleString()} para ${loan.name}?`)) return;
    try {
      const res = await fetch(`${API}/api/finance/loans/${loan.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: loan.monthlyInstallment, accountId: loan.sourceAccountId })
      });
      if (res.ok) fetchFinance();
    } catch (err) {
      console.error('[Pay Loan Error]', err);
    }
  };

  const handleSimulateVoucher = async (sampleType) => {
    setSimulating(true);
    try {
      await fetch(`${API}/api/finance/mail-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleType })
      });
      fetchFinance();
      fetchMailData();
    } catch (_) {}
    finally {
      setSimulating(false);
    }
  };

  const filteredTransactions = (financeData.recentTransactions || []).filter(tx => {
    if (filterAccountId !== 'all' && tx.accountId !== filterAccountId) return false;
    if (filterType !== 'all' && tx.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* HEADER MÓVIL Y SELECTOR DE PESTAÑAS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Finanzas ProActur</h1>
            <span className="text-[10px] text-emerald-400 font-medium">Supabase 24/7 Permanente</span>
          </div>
        </div>

        <button
          onClick={fetchFinance}
          disabled={loading}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevation-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* PESTAÑAS MÓVILES */}
      <div className="flex p-1 bg-surface-elevation-1 rounded-xl border border-border/60 text-xs font-medium">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
            activeTab === 'accounts' ? 'bg-primary text-primary-foreground font-semibold shadow' : 'text-muted-foreground'
          }`}
        >
          Cuentas
        </button>
        <button
          onClick={() => setActiveTab('loans')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
            activeTab === 'loans' ? 'bg-primary text-primary-foreground font-semibold shadow' : 'text-muted-foreground'
          }`}
        >
          Préstamos
        </button>
        <button
          onClick={() => setActiveTab('mailbox')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
            activeTab === 'mailbox' ? 'bg-primary text-primary-foreground font-semibold shadow' : 'text-muted-foreground'
          }`}
        >
          Buzón Gmail
        </button>
      </div>

      {/* ======================================= */}
      {/* TAB 1: CUENTAS Y TRANSACCIONES MÓVILES */}
      {/* ======================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* BALANCE GENERAL */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-surface-elevation-1 to-surface-elevation-2 border border-border/60">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-muted-foreground">Patrimonio en Débito</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Líquido
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground mb-3">
              ₡{(financeData.balance || 0).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block">Gastos Mes</span>
                <span className="font-bold text-rose-400 font-mono">₡{(financeData.monthExpense || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Deuda en Tarjetas</span>
                <span className="font-bold text-purple-400 font-mono">₡{(financeData.creditDebt || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* TARJETAS HORIZONTALES MÓVILES */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-foreground">Tarjetas y Cuentas</span>
              {filterAccountId !== 'all' && (
                <button
                  onClick={() => setFilterAccountId('all')}
                  className="text-primary text-[11px] underline font-medium"
                >
                  Ver todas
                </button>
              )}
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
              {(financeData.accounts || []).map(acc => {
                const isSelected = filterAccountId === acc.id;
                const isCredit = acc.type === 'credito';

                return (
                  <div
                    key={acc.id}
                    onClick={() => setFilterAccountId(isSelected ? 'all' : acc.id)}
                    className={`min-w-[200px] p-3 rounded-xl border snap-start cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-surface-elevation-2'
                        : 'border-border/60 bg-surface-elevation-1'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground truncate">
                        {acc.entity}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isCredit ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {isCredit ? 'Crédito' : 'Débito'}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-foreground truncate mb-1">
                      {acc.name}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground mb-2">
                      •••• {acc.last4 || '----'}
                    </div>
                    <div className="text-sm font-bold font-mono text-foreground">
                      ₡{(acc.balance || 0).toLocaleString()}
                    </div>
                    {isCredit && (
                      <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/40 flex justify-between">
                        <span>Corte día {acc.cutOffDay || 22}</span>
                        <span className={acc.isPaymentUrgent ? 'text-rose-400 font-bold' : ''}>
                          Pago día {acc.paymentDueDay || 7}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* LISTA DE MOVIMIENTOS RECIENTES */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Movimientos ({filteredTransactions.length})
              </span>
              <button
                onClick={() => setShowAddSheet(true)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold"
              >
                <Plus className="w-3 h-3" />
                Registrar
              </button>
            </div>

            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground bg-surface-elevation-1 rounded-xl border border-border/60">
                  No hay transacciones registradas.
                </div>
              ) : (
                filteredTransactions.map(tx => {
                  const account = (financeData.accounts || []).find(a => a.id === tx.accountId);
                  const isExpense = tx.type === 'gasto';

                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-surface-elevation-1 border border-border/60 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 max-w-[200px]">
                        <div className="font-semibold text-foreground truncate">
                          {tx.note || tx.merchant || 'Movimiento'}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span>{new Date(tx.date).toLocaleDateString('es-CR')}</span>
                          <span>•</span>
                          <span>{account ? account.name : 'Cuenta'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isExpense ? '-' : '+'}₡{(tx.amount || 0).toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleDeleteTx(tx.id)}
                          className="text-[10px] text-muted-foreground hover:text-rose-400 pt-0.5"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 2: PRÉSTAMOS MÓVILES               */}
      {/* ======================================= */}
      {activeTab === 'loans' && (
        <div className="space-y-3">
          {(financeData.loans || []).map(loan => {
            const paid = Math.max(0, (loan.totalAmount || 0) - (loan.remainingBalance || 0));
            const pct = loan.totalAmount > 0 ? Math.round((paid / loan.totalAmount) * 100) : 0;

            return (
              <div key={loan.id} className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-primary">{loan.entity}</span>
                    <h3 className="font-bold text-foreground text-xs">{loan.name}</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    {pct}% amortizado
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-surface-elevation-2 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cuota: ₡{(loan.monthlyInstallment || 0).toLocaleString()}</span>
                  <span className={loan.isUrgent ? 'text-rose-400 font-bold' : ''}>
                    Paga el {loan.paymentDay} (en {loan.daysToPayment}d)
                  </span>
                </div>

                <button
                  onClick={() => handlePayLoan(loan)}
                  className="w-full py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold"
                >
                  Registrar Pago de Cuota
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 3: BUZÓN GMAIL MÓVIL                */}
      {/* ======================================= */}
      {activeTab === 'mailbox' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-foreground">Buzón Soberano 100% Gratis</h3>
                <p className="text-[11px] text-muted-foreground">Opera 24/7 permanente con Supabase</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Probar Vouchers en Vivo:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={simulating}
                  onClick={() => handleSimulateVoucher('bac_debito')}
                  className="p-2 rounded-lg bg-surface-elevation-2 border border-border/40 text-[11px] font-medium text-left"
                >
                  BAC Débito (4120)
                </button>
                <button
                  disabled={simulating}
                  onClick={() => handleSimulateVoucher('bac_credito')}
                  className="p-2 rounded-lg bg-surface-elevation-2 border border-border/40 text-[11px] font-medium text-left"
                >
                  BAC Tarjeta (8841)
                </button>
                <button
                  disabled={simulating}
                  onClick={() => handleSimulateVoucher('coopeande_cuota')}
                  className="p-2 rounded-lg bg-surface-elevation-2 border border-border/40 text-[11px] font-medium text-left"
                >
                  Cuota Coopeande
                </button>
                <button
                  disabled={simulating}
                  onClick={() => handleSimulateVoucher('orden_patronal')}
                  className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-medium text-left text-rose-300"
                >
                  Filtro CCSS
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground">Últimos Correos Procesados</span>
            {mailLogs.slice(0, 10).map(log => (
              <div key={log.id} className="p-3 rounded-xl bg-surface-elevation-1 border border-border/60 text-xs space-y-1">
                <div className="font-medium text-foreground truncate">{log.subject}</div>
                <div className="text-[11px] text-emerald-400">
                  {log.status === 'recorded' ? `Contabilizado: ${log.accountName}` : log.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM SHEET: NUEVA TRANSACCIÓN */}
      {showAddSheet && (
        <BottomSheet isOpen={showAddSheet} onClose={() => setShowAddSheet(false)} title="Nuevo Movimiento">
          <form onSubmit={handleCreateTx} className="space-y-3 text-xs">
            <div>
              <label className="text-muted-foreground block mb-1">Tipo</label>
              <select
                value={newTx.type}
                onChange={(e) => setNewTx(prev => ({ ...prev, type: e.target.value, category: CATEGORIES[e.target.value][0] }))}
                className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
              >
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
            </div>

            <div>
              <label className="text-muted-foreground block mb-1">Cuenta</label>
              <select
                value={newTx.accountId}
                onChange={(e) => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
              >
                {(financeData.accounts || []).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-muted-foreground block mb-1">Concepto</label>
              <input
                type="text"
                required
                value={newTx.note}
                onChange={(e) => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                placeholder="ej. Gasolina o Súper"
                className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
              />
            </div>

            <div>
              <label className="text-muted-foreground block mb-1">Monto (CRC ₡)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newTx.amount}
                onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="15000"
                className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold"
              >
                Registrar Movimiento
              </button>
            </div>
          </form>
        </BottomSheet>
      )}
    </div>
  );
}

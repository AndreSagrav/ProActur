import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2,
  CreditCard, Banknote, Landmark, Filter, RefreshCw,
  ArrowUpRight, ArrowDownRight, Tag, Calendar, CheckCircle2,
  Mail, ShieldCheck, Zap, AlertCircle, X, Edit3
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
    'Financiero e Impuestos',
    'Varios'
  ],
  ingreso: [
    'Honorarios Profesionales',
    'Cobro de Clientes',
    'Rendimientos e Inversiones',
    'Transferencias Recibidas',
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
    budgetLimit: 0,
    accounts: [],
    loans: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showLoanSheet, setShowLoanSheet] = useState(false);

  // Estados de correo
  const [mailConfig, setMailConfig] = useState({ email: '', appPassword: '', enabled: false, autoRecord: true });
  const [mailLogs, setMailLogs] = useState([]);
  const [mailTesting, setMailTesting] = useState(false);
  const [mailStatusMsg, setMailStatusMsg] = useState(null);

  // Formulario Transacción
  const [newTx, setNewTx] = useState({
    accountId: '',
    type: 'gasto',
    category: 'Gasolina y Transporte',
    note: '',
    amount: '',
    currency: 'CRC',
    date: new Date().toISOString().slice(0, 10)
  });

  // Formulario Cuenta
  const [accountForm, setAccountForm] = useState({
    name: '',
    entity: '',
    type: 'debito',
    last4: '',
    initialBalance: '',
    currency: 'CRC',
    creditLimit: '',
    cutOffDay: '',
    paymentDueDay: ''
  });

  // Formulario Préstamo
  const [loanForm, setLoanForm] = useState({
    name: '',
    entity: '',
    totalAmount: '',
    remainingBalance: '',
    monthlyInstallment: '',
    paymentDay: '',
    sourceAccountId: '',
    currency: 'CRC'
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
          currency: 'CRC',
          date: new Date().toISOString().slice(0, 10)
        });
        fetchFinance();
      }
    } catch (err) {
      console.error('[Create Tx Mobile Error]', err);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/finance/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountForm,
          initialBalance: parseFloat(accountForm.initialBalance) || 0,
          creditLimit: accountForm.type === 'credito' ? (parseFloat(accountForm.creditLimit) || 0) : null,
          cutOffDay: accountForm.type === 'credito' && accountForm.cutOffDay ? parseInt(accountForm.cutOffDay, 10) : null,
          paymentDueDay: accountForm.type === 'credito' && accountForm.paymentDueDay ? parseInt(accountForm.paymentDueDay, 10) : null
        })
      });

      if (res.ok) {
        setShowAccountSheet(false);
        setAccountForm({
          name: '',
          entity: '',
          type: 'debito',
          last4: '',
          initialBalance: '',
          currency: 'CRC',
          creditLimit: '',
          cutOffDay: '',
          paymentDueDay: ''
        });
        fetchFinance();
      }
    } catch (err) {
      console.error('[Save Account Error]', err);
    }
  };

  const handleSaveLoan = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/finance/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...loanForm,
          totalAmount: parseFloat(loanForm.totalAmount) || 0,
          remainingBalance: parseFloat(loanForm.remainingBalance) || (parseFloat(loanForm.totalAmount) || 0),
          monthlyInstallment: parseFloat(loanForm.monthlyInstallment) || 0,
          paymentDay: parseInt(loanForm.paymentDay, 10) || 1
        })
      });

      if (res.ok) {
        setShowLoanSheet(false);
        setLoanForm({
          name: '',
          entity: '',
          totalAmount: '',
          remainingBalance: '',
          monthlyInstallment: '',
          paymentDay: '',
          sourceAccountId: '',
          currency: 'CRC'
        });
        fetchFinance();
      }
    } catch (err) {
      console.error('[Save Loan Error]', err);
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

  const handleSaveMailConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/finance/mail-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig)
      });
      if (res.ok) {
        setMailStatusMsg({ type: 'success', text: 'Configuración guardada.' });
        fetchMailData();
      }
    } catch (_) {
      setMailStatusMsg({ type: 'error', text: 'Error al guardar.' });
    }
  };

  const handleTestMail = async () => {
    setMailTesting(true);
    setMailStatusMsg(null);
    try {
      const res = await fetch(`${API}/api/finance/mail-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig)
      });
      const data = await res.json();
      setMailStatusMsg({ type: data.success ? 'success' : 'error', text: data.success ? data.message : data.error });
    } catch (_) {
      setMailStatusMsg({ type: 'error', text: 'Error al conectar.' });
    } finally {
      setMailTesting(false);
    }
  };

  const filteredTransactions = (financeData.recentTransactions || []).filter(tx => {
    if (filterAccountId !== 'all' && tx.accountId !== filterAccountId) return false;
    if (filterType !== 'all' && tx.type !== filterType) return false;
    return true;
  });

  const hasAccounts = financeData.accounts && financeData.accounts.length > 0;
  const hasLoans = financeData.loans && financeData.loans.length > 0;

  return (
    <div className="space-y-4 pb-24">
      {/* HEADER MÓVIL Y SELECTOR DE PESTAÑAS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 text-sky-400 flex items-center justify-center border border-white/10 shadow-inner">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Finanzas Ejecutivas</h1>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">Soberano 24/7</span>
          </div>
        </div>

        <button
          onClick={fetchFinance}
          disabled={loading}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* PESTAÑAS MÓVILES */}
      <div className="flex p-1 bg-slate-900/80 rounded-2xl border border-white/10 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-2 rounded-xl transition-all text-center ${
            activeTab === 'accounts' ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Cuentas
        </button>
        <button
          onClick={() => setActiveTab('loans')}
          className={`flex-1 py-2 rounded-xl transition-all text-center ${
            activeTab === 'loans' ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Préstamos
        </button>
        <button
          onClick={() => setActiveTab('mailbox')}
          className={`flex-1 py-2 rounded-xl transition-all text-center ${
            activeTab === 'mailbox' ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Buzón Gmail
        </button>
      </div>

      {/* ======================================= */}
      {/* TAB 1: CUENTAS Y BALANCES              */}
      {/* ======================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* BALANCE GENERAL */}
          <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10">
            <div className="flex justify-between items-start mb-1.5">
              <span className="text-xs text-slate-400 font-medium">Patrimonio en Débito</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Líquido
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white mb-3">
              ₡{(financeData.balance || 0).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Gastos Mes</span>
                <span className="font-bold text-rose-400 font-mono">₡{(financeData.monthExpense || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Deuda en Tarjetas</span>
                <span className="font-bold text-purple-400 font-mono">₡{(financeData.creditDebt || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* TARJETAS HORIZONTALES MÓVILES */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white">Tarjetas y Cuentas</span>
              <div className="flex items-center gap-2">
                {filterAccountId !== 'all' && (
                  <button
                    onClick={() => setFilterAccountId('all')}
                    className="text-sky-400 text-[11px] underline font-medium"
                  >
                    Ver todas
                  </button>
                )}
                <button
                  onClick={() => setShowAccountSheet(true)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-sky-600 text-white font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar
                </button>
              </div>
            </div>

            {!hasAccounts ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-white/10 space-y-2">
                <p>No ha ingresado ninguna cuenta o tarjeta todavía.</p>
                <button
                  onClick={() => setShowAccountSheet(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs"
                >
                  Registrar Mi Cuenta
                </button>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                {financeData.accounts.map(acc => {
                  const isSelected = filterAccountId === acc.id;
                  const isCredit = acc.type === 'credito';
                  const symbol = acc.currency === 'USD' ? '$' : '₡';

                  return (
                    <div
                      key={acc.id}
                      onClick={() => setFilterAccountId(isSelected ? 'all' : acc.id)}
                      className={`min-w-[210px] p-4 rounded-2xl border snap-start cursor-pointer transition-all ${
                        isSelected
                          ? 'border-sky-500 ring-2 ring-sky-500/20 bg-slate-900'
                          : 'border-white/10 bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate max-w-[120px]">
                          {acc.entity}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isCredit ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {isCredit ? 'Crédito' : 'Débito'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-white truncate mb-1">
                        {acc.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mb-2">
                        •••• {acc.last4 || '----'}
                      </div>
                      <div className="text-sm font-bold font-mono text-white">
                        {symbol}{(acc.balance || 0).toLocaleString()}
                      </div>
                      {isCredit && (
                        <div className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-white/10 flex justify-between">
                          <span>Corte día {acc.cutOffDay || '-'}</span>
                          <span className={acc.isPaymentUrgent ? 'text-rose-400 font-bold' : ''}>
                            Pago día {acc.paymentDueDay || '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* MOVIMIENTOS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Movimientos ({filteredTransactions.length})
              </span>
              <button
                onClick={() => setShowAddSheet(true)}
                disabled={!hasAccounts}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-sky-600 text-white font-semibold disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                Registrar
              </button>
            </div>

            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-white/10">
                  No hay movimientos registrados.
                </div>
              ) : (
                filteredTransactions.map(tx => {
                  const account = (financeData.accounts || []).find(a => a.id === tx.accountId);
                  const isExpense = tx.type === 'gasto';
                  const symbol = tx.currency === 'USD' ? '$' : '₡';

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 max-w-[200px]">
                        <div className="font-semibold text-white truncate">
                          {tx.note || tx.merchant || 'Movimiento'}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{new Date(tx.date).toLocaleDateString('es-CR')}</span>
                          <span>•</span>
                          <span>{account ? account.name : 'Cuenta'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isExpense ? '-' : '+'} {symbol}{(tx.amount || 0).toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleDeleteTx(tx.id)}
                          className="text-[10px] text-slate-500 hover:text-rose-400 pt-0.5"
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
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white">Préstamos Registrados</span>
            <button
              onClick={() => setShowLoanSheet(true)}
              className="text-xs px-2.5 py-1 rounded-xl bg-sky-600 text-white font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Agregar
            </button>
          </div>

          {!hasLoans ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-white/10 space-y-2">
              <p>No ha ingresado ningún préstamo aún.</p>
              <button
                onClick={() => setShowLoanSheet(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs"
              >
                Registrar Préstamo
              </button>
            </div>
          ) : (
            financeData.loans.map(loan => {
              const paid = Math.max(0, (loan.totalAmount || 0) - (loan.remainingBalance || 0));
              const pct = loan.totalAmount > 0 ? Math.round((paid / loan.totalAmount) * 100) : 0;
              const symbol = loan.currency === 'USD' ? '$' : '₡';

              return (
                <div key={loan.id} className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-sky-400">{loan.entity}</span>
                      <h3 className="font-bold text-white text-xs">{loan.name}</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      {pct}% amortizado
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Cuota: {symbol}{(loan.monthlyInstallment || 0).toLocaleString()}</span>
                    <span className={loan.isUrgent ? 'text-rose-400 font-bold' : ''}>
                      Paga día {loan.paymentDay}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePayLoan(loan)}
                    className="w-full py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold"
                  >
                    Registrar Pago de Cuota
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 3: BUZÓN GMAIL MÓVIL                */}
      {/* ======================================= */}
      {activeTab === 'mailbox' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white">Buzón Soberano 100% Gratis</h3>
                <p className="text-[11px] text-slate-400">Opera 24/7 permanente con Supabase</p>
              </div>
            </div>

            <form onSubmit={handleSaveMailConfig} className="space-y-2.5 pt-2 border-t border-white/10">
              <div>
                <label className="text-slate-400 block mb-1">Correo Gmail Bancario</label>
                <input
                  type="email"
                  value={mailConfig.email || ''}
                  onChange={(e) => setMailConfig(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="su.correo.bancario@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Contraseña de Aplicación Google</label>
                <input
                  type="password"
                  value={mailConfig.appPassword || ''}
                  onChange={(e) => setMailConfig(prev => ({ ...prev, appPassword: e.target.value }))}
                  placeholder="16 caracteres"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              {mailStatusMsg && (
                <div className={`p-2 rounded-xl text-xs border ${
                  mailStatusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  {mailStatusMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestMail}
                  disabled={mailTesting}
                  className="flex-1 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-medium"
                >
                  {mailTesting ? 'Conectando...' : 'Probar'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-white">Auditoría de Comprobantes</span>
            {mailLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-white/10">
                No hay correos registrados en auditoría todavía.
              </div>
            ) : (
              mailLogs.slice(0, 10).map(log => (
                <div key={log.id} className="p-3 rounded-2xl bg-slate-900/60 border border-white/10 text-xs space-y-1">
                  <div className="font-semibold text-white truncate">{log.subject}</div>
                  <div className="text-[11px] text-emerald-400">
                    {log.status === 'recorded' ? `Contabilizado: ${log.accountName}` : log.reason}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BOTTOM SHEET: NUEVA CUENTA */}
      {showAccountSheet && (
        <BottomSheet isOpen={showAccountSheet} onClose={() => setShowAccountSheet(false)} title="Registrar Cuenta o Tarjeta">
          <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Entidad Financiera</label>
              <input
                type="text"
                required
                value={accountForm.entity}
                onChange={(e) => setAccountForm(prev => ({ ...prev, entity: e.target.value }))}
                placeholder="ej. BAC, Popular, Coopeande"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Nombre</label>
              <input
                type="text"
                required
                value={accountForm.name}
                onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ej. Mi Cuenta Débito o Tarjeta Titular"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Tipo</label>
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                >
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Últimos 4 Dígitos</label>
                <input
                  type="text"
                  maxLength={4}
                  value={accountForm.last4}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, last4: e.target.value }))}
                  placeholder="ej. 1234"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Saldo Inicial (₡)</label>
              <input
                type="number"
                step="0.01"
                value={accountForm.initialBalance}
                onChange={(e) => setAccountForm(prev => ({ ...prev, initialBalance: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
              />
            </div>
            {accountForm.type === 'credito' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Día de Corte</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={accountForm.cutOffDay}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, cutOffDay: e.target.value }))}
                    placeholder="22"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Día Límite de Pago</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={accountForm.paymentDueDay}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, paymentDueDay: e.target.value }))}
                    placeholder="7"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>
              </div>
            )}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold"
              >
                Guardar Cuenta
              </button>
            </div>
          </form>
        </BottomSheet>
      )}

      {/* BOTTOM SHEET: NUEVO PRÉSTAMO */}
      {showLoanSheet && (
        <BottomSheet isOpen={showLoanSheet} onClose={() => setShowLoanSheet(false)} title="Registrar Préstamo">
          <form onSubmit={handleSaveLoan} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Entidad</label>
              <input
                type="text"
                required
                value={loanForm.entity}
                onChange={(e) => setLoanForm(prev => ({ ...prev, entity: e.target.value }))}
                placeholder="ej. Coopeande / Popular"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Nombre</label>
              <input
                type="text"
                required
                value={loanForm.name}
                onChange={(e) => setLoanForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ej. Préstamo Personal"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Monto Original</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={loanForm.totalAmount}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Saldo Adeudado</label>
                <input
                  type="number"
                  step="0.01"
                  value={loanForm.remainingBalance}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, remainingBalance: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Cuota Mensual</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={loanForm.monthlyInstallment}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, monthlyInstallment: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Día de Pago</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={loanForm.paymentDay}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, paymentDay: e.target.value }))}
                  placeholder="Día del mes"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold"
              >
                Guardar Préstamo
              </button>
            </div>
          </form>
        </BottomSheet>
      )}

      {/* BOTTOM SHEET: NUEVA TRANSACCIÓN */}
      {showAddSheet && (
        <BottomSheet isOpen={showAddSheet} onClose={() => setShowAddSheet(false)} title="Registrar Movimiento">
          <form onSubmit={handleCreateTx} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Tipo</label>
              <select
                value={newTx.type}
                onChange={(e) => setNewTx(prev => ({ ...prev, type: e.target.value, category: CATEGORIES[e.target.value][0] }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              >
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Cuenta</label>
              <select
                value={newTx.accountId}
                onChange={(e) => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              >
                {(financeData.accounts || []).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.entity})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Concepto</label>
              <input
                type="text"
                required
                value={newTx.note}
                onChange={(e) => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                placeholder="ej. Gasolina o Súper"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Monto (₡)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newTx.amount}
                onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold"
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

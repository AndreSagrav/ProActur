import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2,
  Search, CreditCard, Banknote, Landmark, AlertCircle,
  PieChart, RefreshCw, X, Mail, ShieldCheck, CheckCircle2,
  Calendar, Clock, DollarSign, Edit3, ChevronRight, Play, AlertTriangle,
  Zap, Bell, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';

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

const playExecutiveSound = (type = 'success') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'urgent') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (_) {}
};

export default function FinanceView() {
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
  const [loading, setLoading] = useState(true);
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);

  // Estados de sincronización Gmail
  const [mailConfig, setMailConfig] = useState({
    email: '',
    appPassword: '',
    enabled: true,
    autoRecord: true
  });
  const [mailLogs, setMailLogs] = useState([]);
  const [mailTesting, setMailTesting] = useState(false);
  const [mailStatusMsg, setMailStatusMsg] = useState(null);

  // Formulario nueva transacción
  const [newTx, setNewTx] = useState({
    accountId: '',
    type: 'gasto',
    category: 'Gasolina y Transporte',
    note: '',
    amount: '',
    currency: 'CRC',
    date: new Date().toISOString().slice(0, 10)
  });

  // Formulario cuenta
  const [accountForm, setAccountForm] = useState({
    name: '',
    entity: 'BAC Credomatic',
    type: 'debito',
    last4: '',
    initialBalance: '',
    balance: '',
    currency: 'CRC',
    creditLimit: '',
    cutOffDay: '',
    paymentDueDay: '',
    color: '#0ea5e9'
  });

  // Formulario préstamo
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
      console.warn('[FinanceView Fetch Warn]', err);
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
    fetchFinanceData();
    fetchMailData();
  }, []);

  // Transacciones
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
        setShowAddTxModal(false);
        playExecutiveSound('success');
        setNewTx({
          accountId: financeData.accounts[0]?.id || '',
          type: 'gasto',
          category: 'Gasolina y Transporte',
          note: '',
          amount: '',
          currency: 'CRC',
          date: new Date().toISOString().slice(0, 10)
        });
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Create Tx Error]', err);
    }
  };

  const handleDeleteTx = async (id) => {
    if (!confirm('¿Confirma la eliminación permanente de este registro contable?')) return;
    try {
      const res = await fetch(`${API}/api/finance/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Delete Tx Error]', err);
    }
  };

  // Cuentas Bancarias
  const handleOpenAccountModal = (acc = null) => {
    if (acc) {
      setEditingAccount(acc);
      setAccountForm({
        name: acc.name || '',
        entity: acc.entity || '',
        type: acc.type || 'debito',
        last4: acc.last4 || '',
        initialBalance: acc.initialBalance ?? acc.balance ?? '',
        balance: acc.balance ?? '',
        currency: acc.currency || 'CRC',
        creditLimit: acc.creditLimit || '',
        cutOffDay: acc.cutOffDay || '',
        paymentDueDay: acc.paymentDueDay || '',
        color: acc.color || '#0ea5e9'
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        name: '',
        entity: '',
        type: 'debito',
        last4: '',
        initialBalance: '',
        balance: '',
        currency: 'CRC',
        creditLimit: '',
        cutOffDay: '',
        paymentDueDay: '',
        color: '#0ea5e9'
      });
    }
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const endpoint = editingAccount
        ? `${API}/api/finance/accounts/${editingAccount.id}`
        : `${API}/api/finance/accounts`;
      const method = editingAccount ? 'PUT' : 'POST';

      const payload = {
        ...accountForm,
        initialBalance: parseFloat(accountForm.initialBalance) || 0,
        balance: editingAccount ? parseFloat(accountForm.balance) : (parseFloat(accountForm.initialBalance) || 0),
        creditLimit: accountForm.type === 'credito' ? (parseFloat(accountForm.creditLimit) || 0) : null,
        cutOffDay: accountForm.type === 'credito' && accountForm.cutOffDay ? parseInt(accountForm.cutOffDay, 10) : null,
        paymentDueDay: accountForm.type === 'credito' && accountForm.paymentDueDay ? parseInt(accountForm.paymentDueDay, 10) : null
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowAccountModal(false);
        playExecutiveSound('success');
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Save Account Error]', err);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('¿Confirma eliminar esta cuenta bancaria del sistema?')) return;
    try {
      const res = await fetch(`${API}/api/finance/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Delete Account Error]', err);
    }
  };

  // Préstamos
  const handleOpenLoanModal = (loan = null) => {
    if (loan) {
      setEditingLoan(loan);
      setLoanForm({
        name: loan.name || '',
        entity: loan.entity || '',
        totalAmount: loan.totalAmount || '',
        remainingBalance: loan.remainingBalance || '',
        monthlyInstallment: loan.monthlyInstallment || '',
        paymentDay: loan.paymentDay || '',
        sourceAccountId: loan.sourceAccountId || '',
        currency: loan.currency || 'CRC'
      });
    } else {
      setEditingLoan(null);
      setLoanForm({
        name: '',
        entity: '',
        totalAmount: '',
        remainingBalance: '',
        monthlyInstallment: '',
        paymentDay: '',
        sourceAccountId: financeData.accounts?.[0]?.id || '',
        currency: 'CRC'
      });
    }
    setShowLoanModal(true);
  };

  const handleSaveLoan = async (e) => {
    e.preventDefault();
    try {
      const endpoint = editingLoan
        ? `${API}/api/finance/loans/${editingLoan.id}`
        : `${API}/api/finance/loans`;
      const method = editingLoan ? 'PUT' : 'POST';

      const payload = {
        ...loanForm,
        totalAmount: parseFloat(loanForm.totalAmount) || 0,
        remainingBalance: parseFloat(loanForm.remainingBalance) || (parseFloat(loanForm.totalAmount) || 0),
        monthlyInstallment: parseFloat(loanForm.monthlyInstallment) || 0,
        paymentDay: parseInt(loanForm.paymentDay, 10) || 1
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowLoanModal(false);
        playExecutiveSound('success');
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Save Loan Error]', err);
    }
  };

  const handlePayInstallment = async (loan) => {
    const symbol = loan.currency === 'USD' ? '$' : '₡';
    if (!confirm(`¿Registrar pago de cuota por ${symbol}${(loan.monthlyInstallment || 0).toLocaleString()} para "${loan.name}"?`)) return;
    try {
      const res = await fetch(`${API}/api/finance/loans/${loan.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: loan.monthlyInstallment,
          accountId: loan.sourceAccountId
        })
      });

      if (res.ok) {
        playExecutiveSound('success');
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Pay Installment Error]', err);
    }
  };

  const handleDeleteLoan = async (id) => {
    if (!confirm('¿Confirma eliminar este préstamo del sistema?')) return;
    try {
      const res = await fetch(`${API}/api/finance/loans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Delete Loan Error]', err);
    }
  };

  // Buzón Gmail
  const handleSaveMailConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/finance/mail-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig)
      });
      if (res.ok) {
        setMailStatusMsg({ type: 'success', text: 'Configuración guardada correctamente.' });
        fetchMailData();
      }
    } catch (err) {
      setMailStatusMsg({ type: 'error', text: 'Error al guardar la configuración.' });
    }
  };

  const handleTestMailConnection = async () => {
    setMailTesting(true);
    setMailStatusMsg(null);
    try {
      const res = await fetch(`${API}/api/finance/mail-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig)
      });
      const data = await res.json();
      if (data.success) {
        setMailStatusMsg({ type: 'success', text: data.message });
        playExecutiveSound('success');
      } else {
        setMailStatusMsg({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMailStatusMsg({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setMailTesting(false);
    }
  };

  const filteredTransactions = (financeData.recentTransactions || []).filter(tx => {
    if (filterAccountId !== 'all' && tx.accountId !== filterAccountId) return false;
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNote = (tx.note || '').toLowerCase().includes(q);
      const matchCat = (tx.category || '').toLowerCase().includes(q);
      const matchMerchant = (tx.merchant || '').toLowerCase().includes(q);
      if (!matchNote && !matchCat && !matchMerchant) return false;
    }
    return true;
  });

  const hasAccounts = financeData.accounts && financeData.accounts.length > 0;
  const hasLoans = financeData.loans && financeData.loans.length > 0;

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4 animate-fade-in">
      {/* ======================================================== */}
      {/* HEADER EJECUTIVO & SELECTOR DE PESTAÑAS                  */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-emerald-500/20 border border-white/15 flex items-center justify-center text-sky-400 shadow-inner">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  Finanzas y Conciliación
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  Soberano 24/7
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400">
                Gestión patrimonial multicuenta, amortización de créditos y conciliación de comprobantes
              </p>
            </div>
          </div>
        </div>

        {/* NAVEGADOR DE PESTAÑAS HIGH-END */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'accounts'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Cuentas y Balances
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'loans'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Banknote className="w-4 h-4" />
            Préstamos
            {financeData.loans?.some(l => l.isUrgent) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('mailbox')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'mailbox'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mail className="w-4 h-4" />
            Buzón Bancario
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PESTAÑA 1: CUENTAS Y BALANCES                            */}
      {/* ======================================================== */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* BALANCE GENERAL */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-1">Fondos Líquidos (Débito)</span>
              <div className="text-xl md:text-2xl font-bold font-mono text-white tracking-tight">
                ₡{(financeData.balance || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saldo Consolidado
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-1">Deuda en Tarjetas</span>
              <div className="text-xl md:text-2xl font-bold font-mono text-rose-400 tracking-tight">
                ₡{(financeData.creditDebt || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-rose-300/80 font-medium flex items-center gap-1 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Consumo a liquidar al corte
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-1">Gastos del Periodo</span>
              <div className="text-xl md:text-2xl font-bold font-mono text-slate-100 tracking-tight">
                ₡{(financeData.monthExpense || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> {filteredTransactions.filter(t => t.type === 'gasto').length} registros
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-1">Ingresos del Periodo</span>
              <div className="text-xl md:text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                ₡{(financeData.monthIncome || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400/80 font-medium flex items-center gap-1 mt-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Entradas registradas
              </span>
            </div>
          </div>

          {/* LISTA / ONBOARDING DE CUENTAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-white">
                  Cuentas Bancarias y Tarjetas
                </h2>
                {hasAccounts && (
                  <span className="text-xs text-slate-400">
                    ({financeData.accounts.length} configuradas)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasAccounts && (
                  <button
                    onClick={() => setFilterAccountId('all')}
                    className={`text-xs px-3 py-1.5 rounded-xl transition-all ${
                      filterAccountId === 'all'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ver Todas
                  </button>
                )}
                <button
                  onClick={() => handleOpenAccountModal()}
                  className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Cuenta
                </button>
              </div>
            </div>

            {!hasAccounts ? (
              /* ONBOARDING EJECUTIVO VACÍO (CERO DATOS FICTICIOS) */
              <div className="p-8 md:p-12 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-white/10 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-lg font-bold text-white">
                    Configure sus Cuentas Bancarias
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No hay cuentas configuradas aún. Ingrese sus cuentas reales con su saldo inicial, tipo (débito o crédito), y los últimos 4 dígitos para permitir la conciliación automática de comprobantes.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => handleOpenAccountModal()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs hover:from-sky-500 hover:to-indigo-500 transition-all shadow-lg shadow-sky-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Mi Primera Cuenta
                  </button>
                </div>
              </div>
            ) : (
              /* TARJETAS EJECUTIVAS */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {financeData.accounts.map(acc => {
                  const isSelected = filterAccountId === acc.id;
                  const isCredit = acc.type === 'credito';
                  const symbol = acc.currency === 'USD' ? '$' : '₡';

                  return (
                    <div
                      key={acc.id}
                      onClick={() => setFilterAccountId(isSelected ? 'all' : acc.id)}
                      className={`relative p-5 rounded-2xl border transition-all cursor-pointer group shadow-sm ${
                        isSelected
                          ? 'border-sky-500 ring-2 ring-sky-500/30 bg-slate-900/90'
                          : 'border-white/10 bg-slate-900/50 hover:border-white/20 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: acc.color || '#0ea5e9' }}
                          />
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[130px]">
                            {acc.entity || 'Entidad'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCredit
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {isCredit ? 'Crédito' : 'Débito'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAccountModal(acc);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Editar cuenta"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="font-bold text-white text-sm truncate mb-0.5">
                        {acc.name}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-4">
                        <span>•••• {acc.last4 || '----'}</span>
                        <span className="text-[11px] font-sans text-slate-500">
                          Inicial: {symbol}{(acc.initialBalance || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">
                          {isCredit ? 'Saldo Deuda:' : 'Disponible:'}
                        </span>
                        <span className={`text-lg font-bold font-mono tracking-tight ${
                          isCredit ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {symbol}{(acc.balance || 0).toLocaleString()}
                        </span>
                      </div>

                      {/* DETALLES DE TARJETA DE CRÉDITO */}
                      {isCredit && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs">
                          {acc.creditLimit ? (
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Límite:</span>
                              <span className="font-semibold text-slate-200 font-mono">
                                {symbol}{acc.creditLimit.toLocaleString()}
                              </span>
                            </div>
                          ) : null}

                          {acc.availableCredit !== null && (
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Crédito Libre:</span>
                              <span className="font-bold text-emerald-400 font-mono">
                                {symbol}{acc.availableCredit.toLocaleString()}
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                            <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                              <span className="text-[10px] text-slate-400 block">Corte (Día {acc.cutOffDay || '-'})</span>
                              <span className="text-xs font-semibold text-slate-200">
                                {acc.daysToCutOff !== null ? `En ${acc.daysToCutOff}d` : '-'}
                              </span>
                            </div>
                            <div className={`p-2 rounded-xl border ${
                              acc.isPaymentUrgent
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold animate-pulse'
                                : 'bg-slate-950/60 border-white/5 text-slate-200'
                            }`}>
                              <span className="text-[10px] text-slate-400 block">Pago (Día {acc.paymentDueDay || '-'})</span>
                              <span className="text-xs font-semibold">
                                {acc.daysToPayment !== null ? `En ${acc.daysToPayment}d` : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIBRO DE MOVIMIENTOS */}
          <div className="p-5 md:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                  Registro Contable de Movimientos
                  {filterAccountId !== 'all' && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
                      Filtrado: {financeData.accounts?.find(a => a.id === filterAccountId)?.name}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  {filteredTransactions.length} transacciones registradas
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar concepto o comercio..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 md:w-56"
                  />
                </div>

                <div className="flex rounded-xl border border-white/10 overflow-hidden text-xs bg-slate-950/80">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 font-medium transition-all ${filterType === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterType('gasto')}
                    className={`px-3 py-1.5 font-medium transition-all ${filterType === 'gasto' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Gastos
                  </button>
                  <button
                    onClick={() => setFilterType('ingreso')}
                    className={`px-3 py-1.5 font-medium transition-all ${filterType === 'ingreso' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Ingresos
                  </button>
                </div>

                <button
                  onClick={() => setShowAddTxModal(true)}
                  disabled={!hasAccounts}
                  className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo Movimiento
                </button>
              </div>
            </div>

            {/* TABLA DE MOVIMIENTOS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium">Concepto / Comercio</th>
                    <th className="pb-3 font-medium">Categoría</th>
                    <th className="pb-3 font-medium">Cuenta</th>
                    <th className="pb-3 font-medium">Origen</th>
                    <th className="pb-3 font-medium text-right">Monto</th>
                    <th className="pb-3 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-slate-500 text-xs">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const account = (financeData.accounts || []).find(a => a.id === tx.accountId);
                      const isExpense = tx.type === 'gasto';
                      const symbol = tx.currency === 'USD' ? '$' : '₡';

                      return (
                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-slate-400 whitespace-nowrap font-mono">
                            {new Date(tx.date).toLocaleDateString('es-CR')}
                          </td>
                          <td className="py-3 font-medium text-slate-100">
                            {tx.note || tx.merchant || 'Movimiento'}
                          </td>
                          <td className="py-3 text-slate-400">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="flex items-center gap-1.5 font-medium text-slate-200">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: account?.color || '#0ea5e9' }} />
                              {account ? account.name : 'Cuenta Principal'}
                              {account?.last4 && <span className="text-slate-500 font-mono">({account.last4})</span>}
                            </span>
                          </td>
                          <td className="py-3">
                            {tx.source === 'gmail_auto' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Zap className="w-2.5 h-2.5" /> Gmail IMAP
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Manual</span>
                            )}
                          </td>
                          <td className={`py-3 font-bold font-mono text-right whitespace-nowrap ${
                            isExpense ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {isExpense ? '-' : '+'} {symbol}{(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDeleteTx(tx.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: PRÉSTAMOS & PASIVOS                          */}
      {/* ======================================================== */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base md:text-lg font-bold text-white">
                Control de Préstamos y Créditos
              </h2>
              <p className="text-xs text-slate-400">
                Amortización mensual, seguimiento de saldo adeudado y recordatorios de pago
              </p>
            </div>
            <button
              onClick={() => handleOpenLoanModal()}
              className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Préstamo
            </button>
          </div>

          {!hasLoans ? (
            /* ONBOARDING VACÍO PRÉSTAMOS */
            <div className="p-8 md:p-12 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-white/10 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                <Banknote className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-lg font-bold text-white">
                  No hay préstamos registrados
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Registre aquí sus créditos con su entidad, cuota mensual, saldo adeudado real y día de corte/pago para llevar control de amortización.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => handleOpenLoanModal()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs hover:from-sky-500 hover:to-indigo-500 transition-all shadow-lg shadow-sky-600/30"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Primer Préstamo
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {financeData.loans.map(loan => {
                const paid = Math.max(0, (loan.totalAmount || 0) - (loan.remainingBalance || 0));
                const pct = loan.totalAmount > 0 ? Math.round((paid / loan.totalAmount) * 100) : 0;
                const symbol = loan.currency === 'USD' ? '$' : '₡';
                const account = (financeData.accounts || []).find(a => a.id === loan.sourceAccountId);

                return (
                  <div
                    key={loan.id}
                    className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-4 hover:border-white/20 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                          {loan.entity || 'Entidad'}
                        </span>
                        <h3 className="font-bold text-white text-sm mt-0.5">
                          {loan.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          loan.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {loan.status === 'paid' ? 'Liquidado' : 'Activo'}
                        </span>
                        <button
                          onClick={() => handleDeleteLoan(loan.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* AMORTIZACIÓN */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Progreso ({pct}%):</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {symbol}{paid.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>Adeudado: {symbol}{(loan.remainingBalance || 0).toLocaleString()}</span>
                        <span>Total: {symbol}{(loan.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* CUOTA Y DÍA DE PAGO */}
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Cuota Mensual:</span>
                        <span className="font-bold font-mono text-white text-sm">
                          {symbol}{(loan.monthlyInstallment || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Fecha de Pago:</span>
                        <span className={`font-semibold ${
                          loan.isUrgent ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-200'
                        }`}>
                          Día {loan.paymentDay || '-'} {loan.daysToPayment !== null ? `(en ${loan.daysToPayment}d)` : ''}
                        </span>
                      </div>
                      {account && (
                        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-white/5">
                          <span>Cuenta Débito:</span>
                          <span className="text-slate-300 font-medium">{account.name}</span>
                        </div>
                      )}
                    </div>

                    {loan.status !== 'paid' && (
                      <button
                        onClick={() => handlePayInstallment(loan)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 text-xs font-semibold transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Registrar Pago de Cuota
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: BUZÓN BANCARIO GMAIL                          */}
      {/* ======================================================== */}
      {activeTab === 'mailbox' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm md:text-base">
                  Conciliación Automática Soberana
                </h3>
                <p className="text-xs text-slate-400">
                  Conexión directa vía IMAP SSL con Google. Sin intermediarios, sin tarjetas ni cuotas mensuales.
                </p>
              </div>
            </div>
            <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 self-start md:self-auto">
              Activo 24/7 en Supabase
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CONFIGURACIÓN */}
            <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                Credenciales del Buzón
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure la cuenta de correo a donde llegan las notificaciones bancarias y una Contraseña de Aplicación de Google (16 caracteres).
              </p>

              <form onSubmit={handleSaveMailConfig} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Correo Gmail Bancario</label>
                  <input
                    type="email"
                    value={mailConfig.email || ''}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="usuario.bancos@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Contraseña de Aplicación Google</label>
                  <input
                    type="password"
                    value={mailConfig.appPassword || ''}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, appPassword: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Generada en Google: Seguridad &gt; Verificación en 2 pasos &gt; Contraseñas de aplicaciones.
                  </span>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mailConfig.autoRecord ?? true}
                      onChange={(e) => setMailConfig(prev => ({ ...prev, autoRecord: e.target.checked }))}
                      className="rounded border-white/20 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-slate-300 font-medium">Contabilizar automáticamente al detectar</span>
                  </label>
                </div>

                {mailStatusMsg && (
                  <div className={`p-3 rounded-xl text-xs border ${
                    mailStatusMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    {mailStatusMsg.text}
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleTestMailConnection}
                    disabled={mailTesting}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/10 hover:bg-slate-700 text-white font-semibold transition-all"
                  >
                    {mailTesting ? 'Conectando...' : 'Probar Conexión'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>

            {/* AUDITORÍA DE COMPROBANTES */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Auditoría de Comprobantes Procesados
                  </h3>
                  <p className="text-xs text-slate-400">
                    Historial de correos clasificados, tarjetas asignadas y filtros de descarte
                  </p>
                </div>
                <button
                  onClick={fetchMailData}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  title="Refrescar auditoría"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {mailLogs.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    No hay comprobantes en el registro de auditoría aún. En cuanto entren notificaciones bancarias o XMLs de facturas electrónicas a su buzón, se reflejarán aquí de inmediato.
                  </div>
                ) : (
                  mailLogs.map(log => {
                    const isRecorded = log.status === 'recorded';
                    const isDiscarded = log.status === 'discarded';

                    return (
                      <div
                        key={log.id}
                        className={`p-3.5 rounded-xl border text-xs transition-all ${
                          isRecorded
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : isDiscarded
                              ? 'bg-slate-950/60 border-white/5 opacity-75'
                              : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-white truncate max-w-[280px] md:max-w-md">
                            {log.subject || 'Notificación Bancaria'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('es-CR')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          {isRecorded && (
                            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Contabilizado en: <strong className="text-white">{log.accountName}</strong> {log.last4 ? `(•••• ${log.last4})` : ''}
                            </span>
                          )}
                          {isDiscarded && (
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              {log.reason}
                            </span>
                          )}
                          {log.amount && (
                            <span className="font-mono font-bold text-white">
                              {log.currency === 'USD' ? '$' : '₡'}{Number(log.amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REGISTRAR / EDITAR CUENTA O TARJETA BANCARIA     */}
      {/* ======================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingAccount ? 'Editar Cuenta o Tarjeta' : 'Registrar Cuenta o Tarjeta'}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Entidad Financiera</label>
                  <input
                    type="text"
                    required
                    value={accountForm.entity}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, entity: e.target.value }))}
                    placeholder="ej. BAC, Banco Popular, Coopeande"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Tipo</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="debito">Cuenta Débito / Ahorros</option>
                    <option value="credito">Tarjeta de Crédito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Nombre de la Cuenta / Tarjeta</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. Mi Cuenta Principal o Tarjeta Titular"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Moneda</label>
                  <select
                    value={accountForm.currency}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="CRC">CRC (₡)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Últimos 4 Dígitos</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={accountForm.last4}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, last4: e.target.value }))}
                    placeholder="ej. 1234"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    {accountForm.type === 'credito' ? 'Deuda Consumida' : 'Saldo Inicial'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.initialBalance}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, initialBalance: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* CAMPOS ADICIONALES PARA TARJETA DE CRÉDITO */}
              {accountForm.type === 'credito' && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                  <span className="text-[11px] font-bold text-sky-400 block">Parámetros de Crédito:</span>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Límite de Crédito Otorgado</label>
                    <input
                      type="number"
                      step="0.01"
                      value={accountForm.creditLimit}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                      placeholder="ej. 1000000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 font-medium">Día de Corte</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.cutOffDay}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, cutOffDay: e.target.value }))}
                        placeholder="ej. 22"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-medium">Día Límite de Pago</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.paymentDueDay}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, paymentDueDay: e.target.value }))}
                        placeholder="ej. 7"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                {editingAccount && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingAccount.id)}
                    className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REGISTRAR PRÉSTAMO                                */}
      {/* ======================================================== */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingLoan ? 'Editar Préstamo' : 'Registrar Nuevo Préstamo'}
              </h3>
              <button
                onClick={() => setShowLoanModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Entidad Financiera</label>
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
                  <label className="text-slate-300 block mb-1 font-medium">Moneda</label>
                  <select
                    value={loanForm.currency}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    <option value="CRC">CRC (₡)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Nombre del Préstamo</label>
                <input
                  type="text"
                  required
                  value={loanForm.name}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. Préstamo Personal"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Monto Total Original</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={loanForm.totalAmount}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                    placeholder="Monto otorgado"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Saldo Pendiente Actual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.remainingBalance}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, remainingBalance: e.target.value }))}
                    placeholder="Saldo adeudado"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Cuota Mensual</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={loanForm.monthlyInstallment}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, monthlyInstallment: e.target.value }))}
                    placeholder="Monto cuota"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Día de Pago del Mes</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={loanForm.paymentDay}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, paymentDay: e.target.value }))}
                    placeholder="Día (1-31)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Cuenta de Débito Asociada (Rebajo)</label>
                <select
                  value={loanForm.sourceAccountId}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, sourceAccountId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                >
                  <option value="">Ninguna / Débito en ventanilla</option>
                  {(financeData.accounts || []).filter(a => a.type === 'debito').map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.entity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
                >
                  Guardar Préstamo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NUEVA TRANSACCIÓN MANUAL                         */}
      {/* ======================================================== */}
      {showAddTxModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">
                Registrar Movimiento Contable
              </h3>
              <button
                onClick={() => setShowAddTxModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Tipo</label>
                  <select
                    value={newTx.type}
                    onChange={(e) => setNewTx(prev => ({ ...prev, type: e.target.value, category: CATEGORIES[e.target.value][0] }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    <option value="gasto">Gasto (Débito o Tarjeta)</option>
                    <option value="ingreso">Ingreso (Abono o Depósito)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Cuenta / Tarjeta</label>
                  <select
                    value={newTx.accountId}
                    onChange={(e) => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    {(financeData.accounts || []).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.entity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Categoría</label>
                <select
                  value={newTx.category}
                  onChange={(e) => setNewTx(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                >
                  {(CATEGORIES[newTx.type] || []).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Concepto o Comercio</label>
                <input
                  type="text"
                  required
                  value={newTx.note}
                  onChange={(e) => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="ej. Supermercado, Gasolinera, Honorarios"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Monto</label>
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
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newTx.date}
                    onChange={(e) => setNewTx(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
                >
                  Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

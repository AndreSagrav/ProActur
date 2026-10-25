import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, Filter,
  Search, CreditCard, Banknote, Landmark, AlertCircle, ArrowUpRight,
  PieChart, RefreshCw, X, Mail, ShieldCheck, CheckCircle2,
  Calendar, Clock, DollarSign, Edit3, ChevronRight, Play, AlertTriangle,
  Zap, Bell
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const CATEGORIES = {
  gasto: ['Gasolina y Transporte', 'Alimentación y Reuniones', 'Servicios y Software', 'Equipamiento', 'Honorarios y Nómina', 'Varios'],
  ingreso: ['Honorarios Profesionales', 'Cobro de Clientes', 'Rendimientos', 'Otros Ingresos']
};

// Generador de Chime Ejecutivo Sonora
const playExecutiveChime = (type = 'success') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'urgent') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
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
    budgetLimit: 500000,
    accounts: [],
    loans: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'gasto' | 'ingreso'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modales
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [payingLoan, setPayingLoan] = useState(null);

  // Estados del Buzón Gmail
  const [mailConfig, setMailConfig] = useState({
    email: '',
    appPassword: '',
    enabled: true,
    autoRecord: true
  });
  const [mailLogs, setMailLogs] = useState([]);
  const [mailTesting, setMailTesting] = useState(false);
  const [mailStatusMsg, setMailStatusMsg] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Formulario nueva transacción
  const [newTx, setNewTx] = useState({
    accountId: '',
    type: 'gasto',
    category: 'Gasolina y Transporte',
    note: '',
    amount: '',
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
    cutOffDay: 22,
    paymentDueDay: 7,
    color: '#dc2626'
  });

  // Formulario préstamo
  const [loanForm, setLoanForm] = useState({
    name: '',
    entity: 'Coopeande',
    totalAmount: '',
    remainingBalance: '',
    monthlyInstallment: '',
    paymentDay: 15,
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
      console.warn('[FinanceView Load Warn]', err);
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

  // Manejo de Transacciones
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
        playExecutiveChime('success');
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

  // Manejo de Cuentas Bancarias
  const handleOpenAccountModal = (acc = null) => {
    if (acc) {
      setEditingAccount(acc);
      setAccountForm({
        name: acc.name || '',
        entity: acc.entity || 'BAC Credomatic',
        type: acc.type || 'debito',
        last4: acc.last4 || '',
        initialBalance: acc.initialBalance || acc.balance || 0,
        balance: acc.balance || 0,
        currency: acc.currency || 'CRC',
        creditLimit: acc.creditLimit || '',
        cutOffDay: acc.cutOffDay || 22,
        paymentDueDay: acc.paymentDueDay || 7,
        color: acc.color || '#dc2626'
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        name: '',
        entity: 'BAC Credomatic',
        type: 'debito',
        last4: '',
        initialBalance: '',
        balance: '',
        currency: 'CRC',
        creditLimit: '',
        cutOffDay: 22,
        paymentDueDay: 7,
        color: '#dc2626'
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
        creditLimit: accountForm.type === 'credito' ? (parseFloat(accountForm.creditLimit) || 0) : null
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowAccountModal(false);
        playExecutiveChime('success');
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Save Account Error]', err);
    }
  };

  // Manejo de Préstamos
  const handleSaveLoan = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...loanForm,
        totalAmount: parseFloat(loanForm.totalAmount) || 0,
        remainingBalance: parseFloat(loanForm.remainingBalance) || (parseFloat(loanForm.totalAmount) || 0),
        monthlyInstallment: parseFloat(loanForm.monthlyInstallment) || 0
      };

      const res = await fetch(`${API}/api/finance/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowLoanModal(false);
        playExecutiveChime('success');
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Save Loan Error]', err);
    }
  };

  const handlePayInstallment = async (loan) => {
    if (!confirm(`¿Registrar el pago de cuota de ₡${(loan.monthlyInstallment || 0).toLocaleString()} para ${loan.name}?`)) return;
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
        playExecutiveChime('success');
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Pay Installment Error]', err);
    }
  };

  // Manejo de Buzón Gmail
  const handleSaveMailConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/finance/mail-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig)
      });
      if (res.ok) {
        setMailStatusMsg({ type: 'success', text: 'Configuración de buzón guardada con éxito.' });
        fetchMailData();
      }
    } catch (err) {
      setMailStatusMsg({ type: 'error', text: 'Error al guardar configuración.' });
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
        playExecutiveChime('success');
      } else {
        setMailStatusMsg({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMailStatusMsg({ type: 'error', text: 'Error de red al verificar conexión.' });
    } finally {
      setMailTesting(false);
    }
  };

  const handleSimulateVoucher = async (sampleType) => {
    setSimulating(true);
    try {
      const res = await fetch(`${API}/api/finance/mail-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleType })
      });
      const data = await res.json();
      playExecutiveChime(data.status === 'discarded' ? 'urgent' : 'success');
      fetchFinanceData();
      fetchMailData();
    } catch (err) {
      console.error('[Simulate Error]', err);
    } finally {
      setSimulating(false);
    }
  };

  // Filtrado de transacciones
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

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-7xl mx-auto">
      {/* HEADER EJECUTIVO & NAVEGACIÓN EN 3 PESTAÑAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Finanzas Ejecutivas
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Supabase Realtime 24/7
                </span>
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Control multicuenta, amortización de préstamos y conciliación automática bancaria
              </p>
            </div>
          </div>
        </div>

        {/* NAVEGADOR DE PESTAÑAS */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-elevation-1 rounded-xl border border-border/60">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
              activeTab === 'accounts'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevation-2'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Cuentas y Balances
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
              activeTab === 'loans'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevation-2'
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
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
              activeTab === 'mailbox'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevation-2'
            }`}
          >
            <Mail className="w-4 h-4" />
            Buzón Bancario
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">100% Gratis</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PESTAÑA 1: CUENTAS Y BALANCES (DÉBITOS, CRÉDITOS Y CORTE) */}
      {/* ======================================================== */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* RESUMEN GLOBAL PATRIMONIAL */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60">
              <span className="text-xs text-muted-foreground block mb-1">Patrimonio en Débito</span>
              <div className="text-lg md:text-2xl font-bold text-foreground">
                ₡{(financeData.balance || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> Fondos Líquidos
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60">
              <span className="text-xs text-muted-foreground block mb-1">Consumido en Tarjetas</span>
              <div className="text-lg md:text-2xl font-bold text-rose-400">
                ₡{(financeData.creditDebt || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-rose-300/80 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> Deuda a liquidar al corte
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60">
              <span className="text-xs text-muted-foreground block mb-1">Gastos del Mes</span>
              <div className="text-lg md:text-2xl font-bold text-foreground">
                ₡{(financeData.monthExpense || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                <TrendingDown className="w-3 h-3" /> {financeData.recentTransactions?.filter(t => t.type === 'gasto').length || 0} movimientos
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60">
              <span className="text-xs text-muted-foreground block mb-1">Ingresos del Mes</span>
              <div className="text-lg md:text-2xl font-bold text-emerald-400">
                ₡{(financeData.monthIncome || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-300/80 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" /> Nóminas y Cobros
              </span>
            </div>
          </div>

          {/* CARRUSEL DE CUENTAS MULTI-BANCO (BAC, POPULAR, COOPEANDE, ETC.) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-semibold text-foreground">
                  Cuentas y Tarjetas Registradas
                </h2>
                <span className="text-xs text-muted-foreground">
                  (Toque para filtrar movimientos por tarjeta)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterAccountId('all')}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                    filterAccountId === 'all'
                      ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Ver Todo
                </button>
                <button
                  onClick={() => handleOpenAccountModal()}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Cuenta
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(financeData.accounts || []).map(acc => {
                const isSelected = filterAccountId === acc.id;
                const isCredit = acc.type === 'credito';

                return (
                  <div
                    key={acc.id}
                    onClick={() => setFilterAccountId(isSelected ? 'all' : acc.id)}
                    className={`relative p-4 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-surface-elevation-2'
                        : 'border-border/60 bg-surface-elevation-1 hover:border-border hover:bg-surface-elevation-2/60'
                    }`}
                  >
                    {/* ENCABEZADO DE TARJETA */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: acc.color || '#3b82f6' }}
                        />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {acc.entity || 'Banco'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
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
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* NOMBRE Y DÍGITOS */}
                    <div className="font-bold text-foreground text-sm truncate mb-1">
                      {acc.name}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mb-3 flex items-center justify-between">
                      <span>•••• {acc.last4 || '----'}</span>
                      <span className="text-[11px] text-muted-foreground/80 font-sans">
                        Inicial: ₡{(acc.initialBalance || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* SALDO ACTUAL */}
                    <div className="border-t border-border/40 pt-2 flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">
                        {isCredit ? 'Saldo Consumido:' : 'Saldo Disponible:'}
                      </span>
                      <span className={`text-base font-bold font-mono ${
                        isCredit ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        ₡{(acc.balance || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* SECCIÓN EXCLUSIVA PARA TARJETAS DE CRÉDITO (CORTE, PAGO Y DISPONIBLE) */}
                    {isCredit && (
                      <div className="mt-3 pt-2 border-t border-border/40 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px]">Límite Total:</span>
                          <span className="font-semibold text-foreground text-[11px]">
                            ₡{(acc.creditLimit || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px]">Disponible Libre:</span>
                          <span className="font-bold text-emerald-400 text-[11px]">
                            ₡{(acc.availableCredit || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* SEMÁFORO DE CORTE Y PAGO */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <div className="p-1.5 rounded-lg bg-surface-elevation-2 border border-border/40 text-center">
                            <span className="text-[10px] text-muted-foreground block">Día Corte ({acc.cutOffDay || 22})</span>
                            <span className="text-xs font-bold text-foreground">
                              {acc.daysToCutOff !== null ? `En ${acc.daysToCutOff} días` : '-'}
                            </span>
                          </div>
                          <div className={`p-1.5 rounded-lg border text-center ${
                            acc.isPaymentUrgent
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold animate-pulse'
                              : 'bg-surface-elevation-2 border-border/40 text-foreground'
                          }`}>
                            <span className="text-[10px] text-muted-foreground block">Día Pago ({acc.paymentDueDay || 7})</span>
                            <span className="text-xs font-bold">
                              {acc.daysToPayment !== null ? `En ${acc.daysToPayment} días` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* LIBRO DE TRANSACCIONES */}
          <div className="p-4 rounded-xl bg-surface-elevation-1 border border-border/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm md:text-base flex items-center gap-2">
                  Libro de Movimientos Bancarios
                  {filterAccountId !== 'all' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      Filtrado por: {financeData.accounts?.find(a => a.id === filterAccountId)?.name}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {filteredTransactions.length} transacciones registradas
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar concepto o comercio..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground focus:outline-none focus:border-primary w-48 md:w-60"
                  />
                </div>

                <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1.5 ${filterType === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'bg-surface-elevation-2 text-muted-foreground'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterType('gasto')}
                    className={`px-2.5 py-1.5 ${filterType === 'gasto' ? 'bg-rose-500 text-white font-semibold' : 'bg-surface-elevation-2 text-muted-foreground'}`}
                  >
                    Gastos
                  </button>
                  <button
                    onClick={() => setFilterType('ingreso')}
                    className={`px-2.5 py-1.5 ${filterType === 'ingreso' ? 'bg-emerald-500 text-white font-semibold' : 'bg-surface-elevation-2 text-muted-foreground'}`}
                  >
                    Ingresos
                  </button>
                </div>

                <button
                  onClick={() => setShowAddTxModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
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
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Concepto / Comercio</th>
                    <th className="pb-2 font-medium">Categoría</th>
                    <th className="pb-2 font-medium">Cuenta / Tarjeta</th>
                    <th className="pb-2 font-medium">Origen</th>
                    <th className="pb-2 font-medium text-right">Monto</th>
                    <th className="pb-2 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-muted-foreground">
                        No hay movimientos registrados con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const account = (financeData.accounts || []).find(a => a.id === tx.accountId);
                      const isExpense = tx.type === 'gasto';

                      return (
                        <tr key={tx.id} className="hover:bg-surface-elevation-2/40 transition-colors">
                          <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString('es-CR')}
                          </td>
                          <td className="py-2.5 font-medium text-foreground">
                            {tx.note || tx.merchant || 'Sin detalle'}
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-surface-elevation-2 text-[11px]">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: account?.color || '#3b82f6' }} />
                              {account ? account.name : 'Cuenta Principal'}
                              {account?.last4 && <span className="text-muted-foreground font-mono">({account.last4})</span>}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {tx.source === 'gmail_auto' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Zap className="w-2.5 h-2.5" /> Gmail Auto
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Manual</span>
                            )}
                          </td>
                          <td className={`py-2.5 font-bold font-mono text-right whitespace-nowrap ${
                            isExpense ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {isExpense ? '-' : '+'} ₡{(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteTx(tx.id)}
                              className="p-1 text-muted-foreground hover:text-rose-400 transition-colors rounded"
                              title="Eliminar movimiento"
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
      {/* PESTAÑA 2: PRÉSTAMOS & CRÉDITOS (AMORTIZACIÓN Y CUOTAS) */}
      {/* ======================================================== */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base md:text-lg font-bold text-foreground">
                Control de Préstamos y Pasivos
              </h2>
              <p className="text-xs text-muted-foreground">
                Monitoreo de cuotas mensuales, amortización y fechas de vencimiento
              </p>
            </div>
            <button
              onClick={() => setShowLoanModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Préstamo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(financeData.loans || []).map(loan => {
              const paidAmount = Math.max(0, (loan.totalAmount || 0) - (loan.remainingBalance || 0));
              const percentPaid = loan.totalAmount > 0
                ? Math.round((paidAmount / loan.totalAmount) * 100)
                : 0;

              return (
                <div
                  key={loan.id}
                  className="p-5 rounded-xl border border-border/60 bg-surface-elevation-1 space-y-4 hover:border-border transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        {loan.entity || 'Entidad'}
                      </span>
                      <h3 className="font-bold text-foreground text-sm mt-0.5">
                        {loan.name}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      loan.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {loan.status === 'paid' ? 'Liquidado' : 'Activo'}
                    </span>
                  </div>

                  {/* PROGRESO DE AMORTIZACIÓN */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Amortizado ({percentPaid}%):</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        ₡{paidAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-elevation-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, percentPaid)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Restante: ₡{(loan.remainingBalance || 0).toLocaleString()}</span>
                      <span>Total: ₡{(loan.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* DETALLE DE CUOTA Y VENCIMIENTO */}
                  <div className="p-3 rounded-lg bg-surface-elevation-2 border border-border/40 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Cuota Mensual:</span>
                      <span className="font-bold font-mono text-foreground text-sm">
                        ₡{(loan.monthlyInstallment || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Día de Pago:</span>
                      <span className={`font-semibold ${
                        loan.isUrgent ? 'text-rose-400 font-bold animate-pulse' : 'text-foreground'
                      }`}>
                        Día {loan.paymentDay} (En {loan.daysToPayment} días)
                      </span>
                    </div>
                  </div>

                  {/* ACCIÓN DE PAGO */}
                  {loan.status !== 'paid' && (
                    <button
                      onClick={() => handlePayInstallment(loan)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-semibold transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Registrar Pago de Cuota
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: BUZÓN BANCARIO GMAIL (CONCILIACIÓN EN VIVO)   */}
      {/* ======================================================== */}
      {activeTab === 'mailbox' && (
        <div className="space-y-6">
          {/* BANNER DE SOBERANÍA Y COSTO CERO */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm md:text-base">
                  Conciliación Bancaria Soberana (100% Gratuita y Permanente)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Se conecta directo vía IMAP SSL de Google. Cero tarifas mensuales, cero tarjetas y opera 24/7 con Supabase.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 self-start md:self-auto">
              Activo 24/7
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PANEL DE CONFIGURACIÓN DE CREDENCIALES GMAIL */}
            <div className="lg:col-span-1 p-5 rounded-xl bg-surface-elevation-1 border border-border/60 space-y-4">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Configurar Buzón Gmail
              </h3>
              <p className="text-xs text-muted-foreground">
                Ingrese el correo donde le llegan las notificaciones bancarias y una Contraseña de Aplicación de 16 letras generada en Google.
              </p>

              <form onSubmit={handleSaveMailConfig} className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground block mb-1">Correo de Notificaciones Gmail</label>
                  <input
                    type="email"
                    value={mailConfig.email || ''}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="micorreo.bancos@gmail.com"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">
                    Contraseña de Aplicación Google (16 caracteres)
                  </label>
                  <input
                    type="password"
                    value={mailConfig.appPassword || ''}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, appPassword: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground focus:outline-none focus:border-primary font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Se genera gratis en: myaccount.google.com/apppasswords
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mailConfig.autoRecord ?? true}
                      onChange={(e) => setMailConfig(prev => ({ ...prev, autoRecord: e.target.checked }))}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-foreground font-medium">Contabilizar automáticamente</span>
                  </label>
                </div>

                {mailStatusMsg && (
                  <div className={`p-2.5 rounded-lg text-xs border ${
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
                    className="flex-1 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 hover:bg-surface-elevation-3 text-foreground font-medium transition-all"
                  >
                    {mailTesting ? 'Verificando...' : 'Probar Conexión'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </form>

              {/* BOTONES DE PRUEBA RÁPIDA (SIMULADOR EN VIVO) */}
              <div className="border-t border-border/40 pt-4 space-y-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Simulador de Comprobantes en Vivo:
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Haga clic para comprobar cómo el motor extrae el monto, asigna la tarjeta por sus 4 dígitos o descarta la CCSS:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    disabled={simulating}
                    onClick={() => handleSimulateVoucher('bac_debito')}
                    className="p-2 rounded-lg bg-surface-elevation-2 hover:bg-surface-elevation-3 border border-border/40 text-[11px] font-medium text-left text-foreground transition-all flex items-center justify-between"
                  >
                    <span>Voucher BAC Débito</span>
                    <Play className="w-3 h-3 text-emerald-400" />
                  </button>
                  <button
                    disabled={simulating}
                    onClick={() => handleSimulateVoucher('bac_credito')}
                    className="p-2 rounded-lg bg-surface-elevation-2 hover:bg-surface-elevation-3 border border-border/40 text-[11px] font-medium text-left text-foreground transition-all flex items-center justify-between"
                  >
                    <span>Voucher BAC Tarjeta</span>
                    <Play className="w-3 h-3 text-purple-400" />
                  </button>
                  <button
                    disabled={simulating}
                    onClick={() => handleSimulateVoucher('coopeande_cuota')}
                    className="p-2 rounded-lg bg-surface-elevation-2 hover:bg-surface-elevation-3 border border-border/40 text-[11px] font-medium text-left text-foreground transition-all flex items-center justify-between"
                  >
                    <span>Cuota Coopeande</span>
                    <Play className="w-3 h-3 text-teal-400" />
                  </button>
                  <button
                    disabled={simulating}
                    onClick={() => handleSimulateVoucher('orden_patronal')}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] font-medium text-left text-rose-300 transition-all flex items-center justify-between"
                  >
                    <span>Filtro CCSS (Rechazo)</span>
                    <X className="w-3 h-3 text-rose-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* LOG EN TIEMPO REAL DE COMPROBANTES DETECTADOS */}
            <div className="lg:col-span-2 p-5 rounded-xl bg-surface-elevation-1 border border-border/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Comprobantes Procesados por el Motor
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Registro de notificaciones analizadas, cuentas asociadas y filtros de descarte
                  </p>
                </div>
                <button
                  onClick={fetchMailData}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevation-2 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {mailLogs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    Aún no se han recibido correos. Puede usar el simulador de la izquierda para probar el motor con vouchers reales.
                  </div>
                ) : (
                  mailLogs.map(log => {
                    const isRecorded = log.status === 'recorded';
                    const isDiscarded = log.status === 'discarded';

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border text-xs transition-all ${
                          isRecorded
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : isDiscarded
                              ? 'bg-surface-elevation-2 border-border/40 opacity-75'
                              : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground truncate max-w-[280px] md:max-w-md">
                            {log.subject || 'Sin Asunto'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString('es-CR')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          {isRecorded && (
                            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Contabilizado en: <strong className="text-foreground">{log.accountName}</strong> (•••• {log.last4})
                            </span>
                          )}
                          {isDiscarded && (
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              {log.reason}
                            </span>
                          )}
                          {log.amount && (
                            <span className="font-mono font-bold text-foreground">
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
      {/* MODAL: NUEVA / EDITAR CUENTA O TARJETA BANCARIA         */}
      {/* ======================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-elevation-1 border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground text-sm md:text-base">
                {editingAccount ? 'Editar Cuenta o Tarjeta' : 'Registrar Nueva Cuenta'}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Entidad Financiera</label>
                  <select
                    value={accountForm.entity}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, entity: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                  >
                    <option value="BAC Credomatic">BAC Credomatic</option>
                    <option value="Banco Popular">Banco Popular</option>
                    <option value="Coopeande">Coopeande</option>
                    <option value="Banco de Costa Rica">Banco de Costa Rica (BCR)</option>
                    <option value="Davivienda">Davivienda</option>
                    <option value="Scotiabank">Scotiabank</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Tipo de Producto</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                  >
                    <option value="debito">Cuenta de Débito / Ahorros</option>
                    <option value="credito">Tarjeta de Crédito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Nombre Descriptivo</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. BAC Débito Principal o Tarjeta Platino"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Últimos 4 Dígitos</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={accountForm.last4}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, last4: e.target.value }))}
                    placeholder="ej. 4120"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">Para asignar el correo</span>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">
                    {accountForm.type === 'credito' ? 'Deuda Consumida Actual' : 'Saldo Inicial (No arranca en cero)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.initialBalance}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, initialBalance: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                </div>
              </div>

              {/* CAMPOS ADICIONALES PARA TARJETA DE CRÉDITO */}
              {accountForm.type === 'credito' && (
                <div className="p-3 rounded-lg bg-surface-elevation-2 border border-border/60 space-y-3">
                  <span className="text-[11px] font-bold text-primary block">Parámetros de Crédito:</span>
                  <div>
                    <label className="text-muted-foreground block mb-1">Límite de Crédito Otorgado</label>
                    <input
                      type="number"
                      step="0.01"
                      value={accountForm.creditLimit}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                      placeholder="ej. 1500000"
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevation-1 border border-border/60 text-foreground font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-muted-foreground block mb-1">Día de Corte Mensual</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.cutOffDay}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, cutOffDay: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevation-1 border border-border/60 text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">Día Límite de Pago</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.paymentDueDay}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, paymentDueDay: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevation-1 border border-border/60 text-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="flex-1 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NUEVO PRÉSTAMO                                   */}
      {/* ======================================================== */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-elevation-1 border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground text-sm md:text-base">
                Registrar Nuevo Préstamo
              </h3>
              <button
                onClick={() => setShowLoanModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">Entidad Financiera</label>
                <input
                  type="text"
                  required
                  value={loanForm.entity}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, entity: e.target.value }))}
                  placeholder="ej. Coopeande / Banco Popular"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Nombre del Crédito</label>
                <input
                  type="text"
                  required
                  value={loanForm.name}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. Préstamo Personal o Vehicular"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Monto Total Original</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={loanForm.totalAmount}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                    placeholder="2500000"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Saldo Adeudado Actual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.remainingBalance}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, remainingBalance: e.target.value }))}
                    placeholder="1850000"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Cuota Mensual Fija</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={loanForm.monthlyInstallment}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, monthlyInstallment: e.target.value }))}
                    placeholder="65400"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Día de Pago del Mes</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={loanForm.paymentDay}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, paymentDay: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Cuenta de Débito Asociada (Rebajo)</label>
                <select
                  value={loanForm.sourceAccountId}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, sourceAccountId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                >
                  <option value="">Seleccionar cuenta...</option>
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
                  className="flex-1 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-elevation-1 border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground text-sm md:text-base">
                Registrar Movimiento Manual
              </h3>
              <button
                onClick={() => setShowAddTxModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Tipo de Movimiento</label>
                  <select
                    value={newTx.type}
                    onChange={(e) => setNewTx(prev => ({ ...prev, type: e.target.value, category: CATEGORIES[e.target.value][0] }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                  >
                    <option value="gasto">Gasto (Débito o Tarjeta)</option>
                    <option value="ingreso">Ingreso (Abono o Depósito)</option>
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Cuenta / Tarjeta</label>
                  <select
                    value={newTx.accountId}
                    onChange={(e) => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                  >
                    {(financeData.accounts || []).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'credito' ? 'Tarjeta' : 'Débito'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Categoría</label>
                <select
                  value={newTx.category}
                  onChange={(e) => setNewTx(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                >
                  {(CATEGORIES[newTx.type] || []).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Concepto o Comercio</label>
                <input
                  type="text"
                  required
                  value={newTx.note}
                  onChange={(e) => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="ej. Gasolinera Delta o Cobro Cliente"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Monto (CRC ₡)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newTx.amount}
                    onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="25000"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newTx.date}
                    onChange={(e) => setNewTx(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-foreground"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="flex-1 py-2 rounded-lg bg-surface-elevation-2 border border-border/60 text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

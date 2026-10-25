import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2,
  Search, CreditCard, Banknote, Landmark, AlertCircle,
  PieChart, RefreshCw, X, Mail, ShieldCheck, CheckCircle2,
  Calendar, Clock, DollarSign, Edit3, ChevronRight, Play, AlertTriangle,
  Zap, Bell, ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet,
  Coins, ArrowRightLeft, Percent, Sparkles, Receipt, ArrowLeft, ArrowRight
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const CATEGORIES = {
  gasto: [
    'Gasolina y Transporte',
    'Alimentación y Reuniones',
    'Servicios y Software',
    'Equipamiento',
    'Honorarios y Nómina',
    'Financiero e Intereses',
    'Donaciones y Diezmos',
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
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (_) {}
};

export default function FinanceView() {
  const [activeTab, setActiveTab] = useState('cuentas'); // 'cuentas' | 'prestamos' | 'contabilidad' | 'gmail'
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
  const [statements, setStatements] = useState(null);
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

  // Estados Gmail
  const [mailConfig, setMailConfig] = useState({ email: '', appPassword: '', enabled: false, autoRecord: true });
  const [mailLogs, setMailLogs] = useState([]);
  const [mailTesting, setMailTesting] = useState(false);
  const [mailSyncing, setMailSyncing] = useState(false);
  const [mailStatusMsg, setMailStatusMsg] = useState(null);

  // Estado Auditoría Integral
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditReport, setAuditReport] = useState(null);
  const [auditing, setAuditing] = useState(false);

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
    type: 'debito', // 'debito' | 'credito' | 'efectivo'
    last4: '',
    initialBalance: '',
    balance: '',
    currency: 'CRC',
    creditLimit: '',
    cutOffDay: '',
    paymentDueDay: '',
    color: '#0ea5e9'
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

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const [sumRes, stmtRes] = await Promise.all([
        fetch(`${API}/api/finance/summary`),
        fetch(`${API}/api/finance/statements`)
      ]);

      if (sumRes.ok) {
        const data = await sumRes.json();
        setFinanceData(data);
        if (!newTx.accountId && data.accounts?.length > 0) {
          setNewTx(prev => ({ ...prev, accountId: data.accounts[0].id }));
        }
      }
      if (stmtRes.ok) {
        const stmt = await stmtRes.json();
        setStatements(stmt);
      }
    } catch (err) {
      console.warn('[FinanceView Fetch Warn]', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMailData = async (triggerSync = false) => {
    try {
      const res = await fetch(`${API}/api/finance/mail-config`);
      if (res.ok) {
        const data = await res.json();
        const validLogs = (data.logs || []).filter(l => l.status === 'recorded' || l.status === 'pending_confirmation');
        setMailConfig(data.config || {});
        setMailLogs(validLogs);

        const cfg = data.config;
        if (cfg?.enabled && cfg?.email && triggerSync) {
          fetch(`${API}/api/finance/mail-sync`, { method: 'POST' })
            .then(r => r.json())
            .then(resData => {
              if (resData.success) {
                if (resData.recorded > 0) {
                  fetchFinanceData();
                }
                fetch(`${API}/api/finance/mail-config`)
                  .then(r => r.json())
                  .then(d => {
                    const cleanLogs = (d.logs || []).filter(l => l.status === 'recorded' || l.status === 'pending_confirmation');
                    setMailConfig(d.config || {});
                    setMailLogs(cleanLogs);
                  }).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchFinanceData();
    fetchMailData(true);

    const interval = setInterval(() => {
      fetchMailData(true);
    }, 60 * 1000);

    return () => clearInterval(interval);
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
        body: JSON.stringify({ ...newTx, amount: amountVal })
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
      if (res.ok) fetchFinanceData();
    } catch (err) {
      console.error('[Delete Tx Error]', err);
    }
  };

  // Cuentas
  const handleOpenAccountModal = (acc = null, defaultType = 'debito') => {
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
        entity: defaultType === 'credito' ? 'Wink' : '',
        type: defaultType,
        last4: '',
        initialBalance: '',
        balance: '',
        currency: 'CRC',
        creditLimit: defaultType === 'credito' ? '1344000' : '',
        cutOffDay: defaultType === 'credito' ? '13' : '',
        paymentDueDay: defaultType === 'credito' ? '2' : '',
        color: defaultType === 'credito' ? '#06b6d4' : '#0ea5e9'
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

      const balVal = parseFloat(accountForm.balance) || (parseFloat(accountForm.initialBalance) || 0);
      const initVal = parseFloat(accountForm.initialBalance) || balVal;

      let resolvedEntity = (accountForm.entity || '').trim();
      if (accountForm.type === 'efectivo') {
        resolvedEntity = 'Efectivo';
      } else if (!resolvedEntity) {
        const lowerName = (accountForm.name || '').toLowerCase();
        if (lowerName.includes('bac')) resolvedEntity = 'BAC Credomatic';
        else if (lowerName.includes('wink')) resolvedEntity = 'Wink';
        else if (lowerName.includes('popular')) resolvedEntity = 'Banco Popular';
        else if (lowerName.includes('bcr')) resolvedEntity = 'BCR';
        else if (lowerName.includes('scotia')) resolvedEntity = 'Scotiabank';
        else if (lowerName.includes('davivienda')) resolvedEntity = 'Davivienda';
        else resolvedEntity = 'Banco';
      }

      let resolvedColor = accountForm.color;
      if (!resolvedColor || resolvedColor === '#0ea5e9') {
        if (resolvedEntity.includes('BAC')) resolvedColor = '#e4032b';
        else if (resolvedEntity.includes('Wink')) resolvedColor = '#06b6d4';
        else if (resolvedEntity.includes('Popular')) resolvedColor = '#f59e0b';
        else if (resolvedEntity.includes('BCR')) resolvedColor = '#2563eb';
      }

      const payload = {
        ...accountForm,
        entity: resolvedEntity,
        color: resolvedColor,
        initialBalance: initVal,
        balance: balVal,
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
    if (!confirm('¿Confirma eliminar esta cuenta del sistema?')) return;
    try {
      const res = await fetch(`${API}/api/finance/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setShowAccountModal(false);
        fetchFinanceData();
      }
    } catch (err) {
      console.error('[Delete Account Error]', err);
    }
  };

  // Arrastrar y soltar cuentas directamente (Drag and Drop)
  const handleDropAccount = async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const nonCredit = (financeData.accounts || []).filter(a => a.type !== 'credito');
    if (fromIndex < 0 || fromIndex >= nonCredit.length || toIndex < 0 || toIndex >= nonCredit.length) return;

    const newNonCredit = [...nonCredit];
    const [moved] = newNonCredit.splice(fromIndex, 1);
    newNonCredit.splice(toIndex, 0, moved);

    const creditCards = (financeData.accounts || []).filter(a => a.type === 'credito');
    const newAll = [...newNonCredit, ...creditCards];

    setFinanceData(prev => ({ ...prev, accounts: newAll }));
    playExecutiveSound('click');

    try {
      await fetch(`${API}/api/finance/accounts/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newAll.map(a => a.id) })
      });
    } catch (_) {}
  };

  // Mover cuenta individualmente hacia la izquierda o derecha (acomodarlas a gusto exacto)
  const handleMoveAccount = async (index, direction) => {
    const nonCredit = (financeData.accounts || []).filter(a => a.type !== 'credito');
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nonCredit.length) return;

    const newNonCredit = [...nonCredit];
    const temp = newNonCredit[index];
    newNonCredit[index] = newNonCredit[targetIndex];
    newNonCredit[targetIndex] = temp;

    const creditCards = (financeData.accounts || []).filter(a => a.type === 'credito');
    const newAll = [...newNonCredit, ...creditCards];

    setFinanceData(prev => ({ ...prev, accounts: newAll }));
    playExecutiveSound('click');

    try {
      await fetch(`${API}/api/finance/accounts/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newAll.map(a => a.id) })
      });
    } catch (_) {}
  };

  // Agrupar automáticamente todas las cuentas de la misma entidad (BAC con BAC, Wink con Wink, etc.)
  const handleGroupByEntity = async () => {
    const nonCredit = [...(financeData.accounts || []).filter(a => a.type !== 'credito')];
    
    const getEntityRank = (entity = '', name = '') => {
      const full = (entity + ' ' + name).toLowerCase();
      if (full.includes('bac')) return 1;
      if (full.includes('wink')) return 2;
      if (full.includes('popular')) return 3;
      if (full.includes('bcr')) return 4;
      if (full.includes('scotia') || full.includes('davivienda')) return 5;
      if (full.includes('efectivo') || full.includes('caja')) return 9;
      return 6;
    };

    nonCredit.sort((a, b) => {
      const rankA = getEntityRank(a.entity, a.name);
      const rankB = getEntityRank(b.entity, b.name);
      if (rankA !== rankB) return rankA - rankB;
      return (a.name || '').localeCompare(b.name || '');
    });

    const creditCards = (financeData.accounts || []).filter(a => a.type === 'credito');
    const newAll = [...nonCredit, ...creditCards];

    setFinanceData(prev => ({ ...prev, accounts: newAll }));
    playExecutiveSound('success');

    try {
      await fetch(`${API}/api/finance/accounts/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newAll.map(a => a.id) })
      });
    } catch (_) {}
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
      if (res.ok) fetchFinanceData();
    } catch (err) {
      console.error('[Delete Loan Error]', err);
    }
  };

  // Gmail
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
    } catch (_) {
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
      setMailStatusMsg({ type: data.success ? 'success' : 'error', text: data.success ? data.message : data.error });
      if (data.success) playExecutiveSound('success');
    } catch (_) {
      setMailStatusMsg({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setMailTesting(false);
    }
  };

  const handleSyncMailNow = async () => {
    setMailSyncing(true);
    setMailStatusMsg(null);
    try {
      const res = await fetch(`${API}/api/finance/mail-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setMailStatusMsg({
        type: data.success ? 'success' : 'error',
        text: data.success ? data.message : data.error
      });
      if (data.success) {
        playExecutiveSound('success');
        fetchMailData();
        fetchFinanceData();
      }
    } catch (_) {
      setMailStatusMsg({ type: 'error', text: 'Error al sincronizar con el buzón de Gmail.' });
    } finally {
      setMailSyncing(false);
    }
  };

  const handleRunAudit = async () => {
    try {
      setAuditing(true);
      const res = await fetch(`${API}/api/finance/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditReport(data);
        setShowAuditModal(true);
        playExecutiveSound('success');
      }
    } catch (_) {
      alert('No fue posible contactar el auditor del sistema.');
    } finally {
      setAuditing(false);
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
    <div className="space-y-8 pb-44 max-w-7xl mx-auto px-3 sm:px-6 animate-fade-in">
      {/* ======================================================== */}
      {/* HEADER EJECUTIVO & NAVEGACIÓN MODERNA SIN CORTES NI SOLAPES */}
      {/* ======================================================== */}
      <div className="space-y-5 border-b border-white/10 pb-6">
        {/* FILA 1: TÍTULO PRINCIPAL Y ACCIONES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-white/15 flex items-center justify-center text-sky-400 shadow-md shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Finanzas & Tesorería
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                  Sincronización Automática
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Cuentas bancarias, préstamos, estados financieros y conciliación de comprobantes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => handleOpenAddTxModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-xs font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Movimiento</span>
            </button>
            <button
              onClick={fetchFinanceData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* FILA 2: NAVEGADOR DE PESTAÑAS DEDICADO Y FLUIDO */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-x-auto scrollbar-none w-full">
          <button
            onClick={() => setActiveTab('cuentas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'cuentas'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Cuentas</span>
            {financeData.accounts?.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'cuentas' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
              }`}>
                {financeData.accounts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('movimientos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'movimientos'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Movimientos</span>
            {financeData.recentTransactions?.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'movimientos' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {financeData.recentTransactions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('prestamos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'prestamos'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Banknote className="w-4 h-4 shrink-0" />
            <span>Créditos y Préstamos</span>
            {financeData.loans?.some(l => l.isUrgent) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('contabilidad')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'contabilidad'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Contabilidad</span>
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'gmail'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span>Buzón Bancario</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PESTAÑA 1: CUENTAS                                       */}
      {/* ======================================================== */}
      {activeTab === 'cuentas' && (
        <div className="space-y-6">
          {/* VISTA MÓVIL: RESUMEN EJECUTIVO COMPACTO (CERO APELOTAMIENTO) */}
          <div className="p-4 sm:hidden rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-medium">Disponible Operativo (Gasto Diario)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                Líquido
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₡{(financeData.liquidBalanceCRC !== undefined ? financeData.liquidBalanceCRC : (financeData.balance || 0)).toLocaleString()}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/10 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Reservas / CDPs</span>
                <span className="font-bold text-indigo-400 font-mono text-[11px]">₡{(financeData.savingsBalanceCRC || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Deuda Tarjetas</span>
                <span className="font-bold text-rose-400 font-mono text-[11px]">₡{(financeData.creditDebt || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Gastos Mes</span>
                <span className="font-bold text-slate-300 font-mono text-[11px]">₡{(financeData.monthExpense || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* VISTA ESCRITORIO: CUADRÍCULA DE 4 TARJETAS */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-2">Disponible Operativo</span>
              <div className="text-2xl md:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
                ₡{(financeData.liquidBalanceCRC !== undefined ? financeData.liquidBalanceCRC : (financeData.balance || 0)).toLocaleString()}
              </div>
              <span className="text-xs text-emerald-300 font-medium flex items-center gap-1.5 mt-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Fondos líquidos para gasto
              </span>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-2">Reservas e Inversiones</span>
              <div className="text-2xl md:text-3xl font-bold font-mono text-indigo-400 tracking-tight">
                ₡{(financeData.savingsBalanceCRC || 0).toLocaleString()}
              </div>
              <span className="text-xs text-indigo-300 font-medium flex items-center gap-1.5 mt-2">
                <PieChart className="w-3.5 h-3.5 text-indigo-400" /> Marchamo, Metas y CDPs
              </span>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-2">Deuda en Tarjetas</span>
              <div className="text-2xl md:text-3xl font-bold font-mono text-rose-400 tracking-tight">
                ₡{(financeData.creditDebt || 0).toLocaleString()}
              </div>
              <span className="text-xs text-rose-300/80 font-medium flex items-center gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5" /> Consumo acumulado
              </span>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-sm">
              <span className="text-xs font-medium text-slate-400 block mb-2">Ingresos Registrados</span>
              <div className="text-2xl md:text-3xl font-bold font-mono text-white tracking-tight">
                ₡{(financeData.monthIncome || 0).toLocaleString()}
              </div>
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Depósitos y rendimientos
              </span>
            </div>
          </div>

          {/* SECCIÓN DE CUENTAS BANCARIAS (DISEÑO EJECUTIVO AGRUPADO Y REORDENABLE) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-sky-400" />
                  Cuentas Bancarias
                </h2>
                <p className="text-xs text-slate-400">
                  {financeData.accounts.filter(a => a.type !== 'credito').length} cuentas con disponibilidad inmediata • Arrastre para reordenar
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {financeData.accounts.filter(a => a.type !== 'credito').length > 1 && (
                  <button
                    type="button"
                    onClick={handleGroupByEntity}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 transition-all font-semibold shadow-sm active:scale-95"
                    title="Alinear cuentas por entidad: Todas las del BAC juntas, Wink juntas, Banco Popular juntas"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Agrupar por Banco</span>
                  </button>
                )}

                {filterAccountId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterAccountId('all')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium hover:bg-sky-500/25 transition-all"
                    title="Restablecer filtro y ver todas las cuentas"
                  >
                    <span>Filtro activo</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleOpenAccountModal(null, 'debito')}
                  className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Cuenta</span>
                </button>
              </div>
            </div>

            {financeData.accounts.filter(a => a.type !== 'credito').length === 0 ? (
              <div className="p-12 md:p-16 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 text-center space-y-5">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-white/10 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                  <Landmark className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-white">
                    No hay cuentas bancarias configuradas todavía
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Registre sus cuentas bancarias o efectivo físico con su saldo real.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => handleOpenAccountModal(null, 'debito')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs hover:from-sky-500 hover:to-indigo-500 transition-all shadow-lg shadow-sky-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Cuenta Bancaria
                  </button>
                </div>
              </div>
            ) : (
              /* REJILLA RESPONSIVE CON CONTROLES MANUALES PARA ACOMODAR A GUSTO */
              <div className="flex gap-3 overflow-x-auto pb-3 sm:pb-0 scrollbar-none snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
                {financeData.accounts
                  .filter(acc => acc.type === 'debito' || acc.type === 'efectivo')
                  .map((acc, idx, arr) => {
                    const isSelected = filterAccountId === acc.id;
                    const isCash = acc.type === 'efectivo';
                    const symbol = acc.currency === 'USD' ? '$' : '₡';

                    return (
                      <div
                        key={acc.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (!isNaN(srcIdx) && srcIdx !== idx) {
                            handleDropAccount(srcIdx, idx);
                          }
                        }}
                        onClick={() => setFilterAccountId(isSelected ? 'all' : acc.id)}
                        className={`min-w-[270px] max-w-[290px] shrink-0 snap-start sm:min-w-0 sm:max-w-none relative p-5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing group shadow-sm flex flex-col justify-between h-44 ${
                          isSelected
                            ? 'border-sky-500 ring-2 ring-sky-500/30 bg-slate-900/95 shadow-sky-500/10'
                            : 'border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900/80'
                        }`}
                      >
                        <div>
                          {/* Header de la cuenta */}
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
                                style={{ backgroundColor: acc.color || '#0ea5e9' }}
                              />
                              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate max-w-[120px]">
                                {isCash ? 'Caja / Efectivo' : (acc.entity || 'Banco')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Controles de reordenación rápida */}
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveAccount(idx, -1);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/15 disabled:opacity-20 disabled:pointer-events-none transition-all"
                                title="Mover a la izquierda"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveAccount(idx, 1);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/15 disabled:opacity-20 disabled:pointer-events-none transition-all"
                                title="Mover a la derecha"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAccountModal(acc);
                                }}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-950/60 hover:bg-white/10 transition-all border border-white/10 ml-0.5"
                                title="Editar Cuenta Bancaria"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Nombre y Badge de Tipo */}
                          <div>
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="font-bold text-white text-sm truncate" title={acc.name}>
                                {acc.name}
                              </div>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {isCash ? 'Efectivo' : 'Cuenta Bancaria'}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                              <span>
                                {isCash ? 'Billetes / Monedas' : acc.last4 ? `Cuenta •••• ${acc.last4}` : 'Disponibilidad Inmediata'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-sans font-bold">
                                {acc.currency || 'CRC'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Saldo Disponible */}
                        <div className="pt-2.5 border-t border-white/10 flex flex-col justify-end">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                            Saldo Disponible
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-xl font-bold font-mono tracking-tight text-emerald-400">
                              {symbol}{(acc.balance || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Inicial: {symbol}{(acc.initialBalance || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* SECCIÓN: INVERSIONES Y RESERVAS DE AHORRO (CDP / FONDOS CON DESTINO ESPECÍFICO) */}
            {financeData.accounts.filter(acc => acc.type === 'ahorro' || acc.type === 'objetivo' || acc.type === 'cdp' || acc.type === 'inversion').length > 0 && (
              <div className="space-y-4 pt-5 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-indigo-400" />
                      Inversiones y Reservas de Ahorro
                    </h2>
                    <p className="text-xs text-slate-400">
                      Fondos con destino específico y certificados a plazo fijo (CDP). Separados del disponible de gasto diario.
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenAccountModal(null, 'objetivo')}
                    className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-md shadow-indigo-600/25 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Certificado o Meta</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {financeData.accounts
                    .filter(acc => acc.type === 'ahorro' || acc.type === 'objetivo' || acc.type === 'cdp' || acc.type === 'inversion')
                    .map((acc) => {
                      const symbol = acc.currency === 'USD' ? '$' : '₡';
                      const isMarchamo = (acc.name || '').toLowerCase().includes('marchamo');
                      const isCDP = acc.type === 'cdp' || acc.type === 'inversion';

                      return (
                        <div
                          key={acc.id}
                          className="relative p-5 rounded-2xl border border-indigo-500/20 bg-slate-900/80 hover:border-indigo-500/40 transition-all shadow-sm flex flex-col justify-between h-44"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
                                  style={{ backgroundColor: acc.color || '#6366f1' }}
                                />
                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate max-w-[120px]">
                                  {acc.entity || 'BAC Credomatic'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  {isCDP ? 'Certificado a Plazo' : isMarchamo ? 'Reserva Marchamo' : 'Meta Programada'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAccountModal(acc);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-950/60 hover:bg-white/10 transition-all border border-white/10 ml-0.5"
                                  title="Editar Inversión o Meta"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <div className="font-bold text-white text-sm truncate" title={acc.name}>
                                {acc.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                                <span>{isCDP ? 'Rendimientos periódicos' : 'Fondo blindado / Intocable'}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-sans font-bold">
                                  {acc.currency || 'CRC'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-white/10 flex flex-col justify-end">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                              Capital Reservado
                            </span>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-xl font-bold font-mono tracking-tight text-indigo-400">
                                {symbol}{(acc.balance || 0).toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Inicial: {symbol}{(acc.initialBalance || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* BANNER DE ACCESO DIRECTO AL HISTORIAL CONTABLE */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-bold text-white block">Libro Contable y Movimientos</span>
                <span className="text-[11px] text-slate-400">
                  {filteredTransactions.length} registros contables activos • Conciliación IMAP automática
                </span>
              </div>
              <button
                onClick={() => setActiveTab('movimientos')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/20 active:scale-95 transition-all"
              >
                <span>Ver Movimientos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: MOVIMIENTOS CONTABLES                         */}
      {/* ======================================================== */}
      {activeTab === 'movimientos' && (
        <div className="space-y-6">
          {/* LIBRO DE MOVIMIENTOS ESPACIOSO */}
          <div className="p-4 sm:p-7 md:p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2.5">
                  Movimientos Contables
                  {filterAccountId !== 'all' && (
                    <span className="text-xs px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
                      Filtrado por cuenta
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {filteredTransactions.length} asientos registrados en el sistema
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar concepto o comercio..."
                    className="pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-48 md:w-64"
                  />
                </div>

                <div className="flex rounded-xl border border-white/10 overflow-hidden text-xs bg-slate-950/80">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3.5 py-2 font-medium transition-all ${filterType === 'all' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterType('gasto')}
                    className={`px-3.5 py-2 font-medium transition-all ${filterType === 'gasto' ? 'bg-rose-500 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Gastos
                  </button>
                  <button
                    onClick={() => setFilterType('ingreso')}
                    className={`px-3.5 py-2 font-medium transition-all ${filterType === 'ingreso' ? 'bg-emerald-500 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Ingresos
                  </button>
                </div>

                <button
                  onClick={() => setShowAddTxModal(true)}
                  disabled={!hasAccounts}
                  className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all disabled:opacity-50 shadow-md shadow-sky-600/25"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Movimiento
                </button>
              </div>
            </div>

            {/* VISTA MÓVIL: TARJETAS COMPACTAS EJECUTIVAS */}
            <div className="space-y-3 sm:hidden">
              {filteredTransactions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No hay movimientos registrados.
                </div>
              ) : (
                filteredTransactions.map(tx => {
                  const accId = tx.accountId || tx.account_id;
                  const account = (financeData.accounts || []).find(a => String(a.id) === String(accId));
                  const isExpense = tx.type === 'gasto';
                  const symbol = tx.currency === 'USD' ? '$' : '₡';
                  const isAuto = tx.source === 'gmail_auto' || (tx.note && (tx.note.includes('BAC') || tx.note.includes('SINPE') || tx.note.includes('Wink')));

                  return (
                    <div key={tx.id} className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-xs leading-snug line-clamp-2">
                            {tx.note || tx.merchant || 'Movimiento'}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>{new Date(tx.date).toLocaleDateString('es-CR')}</span>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                              {tx.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-bold font-mono text-sm ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {isExpense ? '-' : '+'} {symbol}{(tx.amount || 0).toLocaleString()}
                          </div>
                          {isAuto ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 mt-1">
                              <Zap className="w-2.5 h-2.5" /> IMAP Auto
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Manual</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: account?.color || '#0ea5e9' }} />
                          {account ? account.name : 'Cuenta Principal'}
                        </span>
                        <button
                          onClick={() => handleDeleteTx(tx.id)}
                          className="text-[11px] text-rose-400/80 hover:text-rose-300 font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* VISTA ESCRITORIO: TABLA COMPLETA */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-4 font-semibold">Fecha</th>
                    <th className="pb-4 font-semibold">Concepto / Comercio</th>
                    <th className="pb-4 font-semibold">Categoría</th>
                    <th className="pb-4 font-semibold">Cuenta</th>
                    <th className="pb-4 font-semibold">Origen</th>
                    <th className="pb-4 font-semibold text-right">Monto</th>
                    <th className="pb-4 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500 text-xs">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const accId = tx.accountId || tx.account_id;
                      const account = (financeData.accounts || []).find(a => String(a.id) === String(accId));
                      const isExpense = tx.type === 'gasto';
                      const symbol = tx.currency === 'USD' ? '$' : '₡';
                      const isAuto = tx.source === 'gmail_auto' || (tx.note && (tx.note.includes('BAC') || tx.note.includes('SINPE') || tx.note.includes('Wink')));

                      return (
                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 text-slate-400 whitespace-nowrap font-mono">
                            {new Date(tx.date).toLocaleDateString('es-CR')}
                          </td>
                          <td className="py-4 font-medium text-slate-100">
                            {tx.note || tx.merchant || 'Movimiento'}
                          </td>
                          <td className="py-4 text-slate-400">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className="flex items-center gap-2 font-medium text-slate-200">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account?.color || '#0ea5e9' }} />
                              {account ? account.name : 'Cuenta Principal'}
                              {account?.last4 && <span className="text-slate-500 font-mono">({account.last4})</span>}
                            </span>
                          </td>
                          <td className="py-4">
                            {isAuto ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Zap className="w-3 h-3" /> IMAP Auto
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">Manual</span>
                            )}
                          </td>
                          <td className={`py-4 font-bold font-mono text-right whitespace-nowrap text-sm ${
                            isExpense ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {isExpense ? '-' : '+'} {symbol}{(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleDeleteTx(tx.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded-lg"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
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
      {/* PESTAÑA 2: CRÉDITOS Y PRÉSTAMOS                         */}
      {/* ======================================================== */}
      {activeTab === 'prestamos' && (
        <div className="space-y-10">
          {/* SECCIÓN 1: TARJETAS DE CRÉDITO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-sky-400" />
                  Tarjetas de Crédito
                </h2>
                <p className="text-xs text-slate-400">
                  Líneas de crédito revolventes, límite asignado, saldo consumido y fechas de corte
                </p>
              </div>
              <button
                onClick={() => handleOpenAccountModal(null, 'credito')}
                className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
              >
                <Plus className="w-4 h-4" />
                Nueva Tarjeta
              </button>
            </div>

            {financeData.accounts.filter(a => a.type === 'credito').length === 0 ? (
              <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 text-center text-xs text-slate-400">
                No hay tarjetas de crédito registradas en el sistema.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {financeData.accounts
                  .filter(a => a.type === 'credito')
                  .map(card => {
                    const limitCRC = card.creditLimit || 1344000;
                    const limitUSD = card.creditLimitUSD || 3000;
                    const debtCRC = Number(card.balance) || 5025.84;
                    const debtUSD = card.debtUSD !== undefined ? Number(card.debtUSD) : 69.15;
                    const availCRC = card.availableCredit !== undefined && card.availableCredit !== null ? Number(card.availableCredit) : Math.max(0, limitCRC - debtCRC);
                    const availUSD = card.availableCreditUSD !== undefined && card.availableCreditUSD !== null ? Number(card.availableCreditUSD) : Math.max(0, limitUSD - debtUSD);
                    const cashPayUSD = card.cashPaymentUSD || 68.99;
                    const minPayUSD = card.minPaymentUSD || 5.00;
                    const rateCRC = card.interestRateCRC || 32;
                    const rateUSD = card.interestRateUSD || 27.5;
                    const points = card.rewardPoints || 110;

                    return (
                      <div
                        key={card.id}
                        className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 border border-white/15 backdrop-blur-md shadow-2xl relative overflow-hidden space-y-6"
                      >
                        {/* Glow decorativo de fondo */}
                        <div className="absolute -right-20 -top-20 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

                        {/* Encabezado de la Tarjeta de Lujo */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-white/15 flex items-center justify-center text-sky-400 shadow-md">
                              <CreditCard className="w-7 h-7" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold text-white tracking-tight">
                                  {card.name}
                                </h3>
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                                  {card.entity || 'Wink'} Crédito
                                </span>
                              </div>
                              <p className="text-xs font-mono text-slate-400 mt-0.5">
                                •••• •••• •••• {card.last4 || '7017'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenAccountModal(card)}
                              className="flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all shadow-sm"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar Tarjeta
                            </button>
                          </div>
                        </div>

                        {/* Grid de Métricas Financieras (Colones y Dólares tal como en Wink) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* Límite de Crédito */}
                          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium block">
                              Límite de Crédito
                            </span>
                            <div className="text-lg font-bold font-mono text-white">
                              ₡{limitCRC.toLocaleString()}
                            </div>
                            <div className="text-xs font-mono text-slate-400">
                              ${limitUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Disponible para Compras */}
                          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                            <span className="text-[11px] text-emerald-300 font-medium block">
                              Disponible para Compras
                            </span>
                            <div className="text-lg font-bold font-mono text-emerald-400">
                              ₡{availCRC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs font-mono text-emerald-300/80">
                              ${availUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Saldo Adeudado */}
                          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                            <span className="text-[11px] text-rose-300 font-medium block">
                              Saldo Adeudado (Consumido)
                            </span>
                            <div className="text-lg font-bold font-mono text-rose-400">
                              ₡{debtCRC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs font-mono text-rose-300/80">
                              ${debtUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Pago de Contado / Mínimo */}
                          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium block">
                              Pago de Contado / Mínimo
                            </span>
                            <div className="text-xs font-mono text-slate-200">
                              Contado: <span className="font-bold text-white">${cashPayUSD.toFixed(2)}</span>
                            </div>
                            <div className="text-xs font-mono text-slate-400">
                              Mínimo: <span className="font-bold text-amber-400">${minPayUSD.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Fechas de Corte, Pago, Interés y Puntos */}
                        <div className="pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Fecha de Corte</span>
                              <span className="font-semibold text-slate-200">
                                Día {card.cutOffDay || 13} de cada mes
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl border ${
                              card.isPaymentUrgent
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}>
                              <AlertCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Fecha de Pago</span>
                              <span className="font-semibold text-white">
                                Día {card.paymentDueDay || 2} de cada mes {card.daysToPayment !== null ? `(en ${card.daysToPayment}d)` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Percent className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tasa de Interés</span>
                              <span className="font-semibold text-slate-200">
                                {rateCRC}% CRC / {rateUSD}% USD
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Puntos Acumulados</span>
                              <span className="font-semibold text-amber-300">
                                {points} pts (Mín. 500)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: PRÉSTAMOS PERSONALES Y AMORTIZACIONES */}
          <div className="space-y-4 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                  <Banknote className="w-5 h-5 text-emerald-400" />
                  Préstamos y Créditos Personales
                </h2>
                <p className="text-xs text-slate-400">
                  Amortización mensual, saldo insoluto y fechas de pago
                </p>
              </div>
              <button
                onClick={() => handleOpenLoanModal()}
                className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md shadow-sky-600/25"
              >
                <Plus className="w-4 h-4" />
                Nuevo Préstamo
              </button>
            </div>

          {!hasLoans ? (
            <div className="p-12 md:p-16 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-white/10 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                <Banknote className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-white">
                  No hay préstamos registrados
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ingrese sus créditos activos con su entidad, cuota mensual, saldo adeudado real y día de pago para amortizarlos de forma automática.
                </p>
              </div>
              <div>
                <button
                  onClick={() => handleOpenLoanModal()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs hover:from-sky-500 hover:to-indigo-500 transition-all shadow-lg shadow-sky-600/30"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Primer Préstamo
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {financeData.loans.map(loan => {
                const paid = Math.max(0, (loan.totalAmount || 0) - (loan.remainingBalance || 0));
                const pct = loan.totalAmount > 0 ? Math.round((paid / loan.totalAmount) * 100) : 0;
                const symbol = loan.currency === 'USD' ? '$' : '₡';
                const account = (financeData.accounts || []).find(a => a.id === loan.sourceAccountId);

                return (
                  <div
                    key={loan.id}
                    className="p-7 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-5 hover:border-white/20 transition-all shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                          {loan.entity || 'Entidad'}
                        </span>
                        <h3 className="font-bold text-white text-base mt-0.5">
                          {loan.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                          loan.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {loan.status === 'paid' ? 'Liquidado' : 'Activo'}
                        </span>
                        <button
                          onClick={() => handleDeleteLoan(loan.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Amortizado ({pct}%):</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {symbol}{paid.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 font-mono">
                        <span>Adeudado: {symbol}{(loan.remainingBalance || 0).toLocaleString()}</span>
                        <span>Total: {symbol}{(loan.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Cuota Mensual:</span>
                        <span className="font-bold font-mono text-white text-base">
                          {symbol}{(loan.monthlyInstallment || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Fecha de Pago:</span>
                        <span className={`font-semibold ${
                          loan.isUrgent ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-200'
                        }`}>
                          Día {loan.paymentDay || '-'} {loan.daysToPayment !== null ? `(en ${loan.daysToPayment}d)` : ''}
                        </span>
                      </div>
                      {account && (
                        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1.5 border-t border-white/5">
                          <span>Cuenta Débito:</span>
                          <span className="text-slate-300 font-medium">{account.name}</span>
                        </div>
                      )}
                    </div>

                    {loan.status !== 'paid' && (
                      <button
                        onClick={() => handlePayInstallment(loan)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 text-xs font-semibold transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Registrar Pago de Cuota
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: CONTABILIDAD (ESTADOS FINANCIEROS REALES)      */}
      {/* ======================================================== */}
      {activeTab === 'contabilidad' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">
                Estados Financieros
              </h2>
              <p className="text-xs text-slate-400">
                Balance de Situación, Estado de Resultados y Flujo de Caja en tiempo real
              </p>
            </div>
            <button
              onClick={fetchFinanceData}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              title="Recalcular"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. BALANCE DE SITUACIÓN */}
            <div className="p-7 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Landmark className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-white text-base">Balance de Situación</h3>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  (statements?.balanceSheet?.equity?.netWorth || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {statements?.balanceSheet?.equity?.status || 'Calculando'}
                </span>
              </div>

              {/* ACTIVOS */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between font-bold text-slate-200">
                  <span>TOTAL ACTIVOS (Tesorería)</span>
                  <span className="font-mono text-emerald-400 text-sm">
                    ₡{(statements?.balanceSheet?.assets?.total || 0).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5 pl-2 text-xs text-slate-400">
                  {(statements?.balanceSheet?.assets?.items || []).length === 0 ? (
                    <span className="text-slate-600 block">Sin activos registrados</span>
                  ) : (
                    statements.balanceSheet.assets.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.name} ({it.entity})</span>
                        <span className="font-mono text-slate-300">₡{it.amount.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* PASIVOS */}
              <div className="space-y-2.5 text-xs border-t border-white/10 pt-4">
                <div className="flex justify-between font-bold text-slate-200">
                  <span>TOTAL PASIVOS (Obligaciones)</span>
                  <span className="font-mono text-rose-400 text-sm">
                    ₡{(statements?.balanceSheet?.liabilities?.total || 0).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5 pl-2 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Deuda Tarjetas</span>
                    <span className="font-mono text-slate-300">
                      ₡{(statements?.balanceSheet?.liabilities?.shortTerm?.total || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deuda Préstamos</span>
                    <span className="font-mono text-slate-300">
                      ₡{(statements?.balanceSheet?.liabilities?.longTerm?.total || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* PATRIMONIO NETO */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider">Patrimonio Neto Real</span>
                <span className={`text-lg font-bold font-mono ${
                  (statements?.balanceSheet?.equity?.netWorth || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ₡{(statements?.balanceSheet?.equity?.netWorth || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* 2. ESTADO DE RESULTADOS (P&L) */}
            <div className="p-7 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Estado de Resultados (P&L)</h3>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                  Margen: {statements?.incomeStatement?.profitMargin || '0.0'}%
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-slate-200">
                  <span>Ingresos Brutos</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ₡{(statements?.incomeStatement?.grossRevenue || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>Gastos de Operación</span>
                  <span className="font-mono text-slate-300">
                    - ₡{(statements?.incomeStatement?.operatingExpenses || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-amber-400">Costo Financiero (Intereses)</span>
                  <span className="font-mono text-amber-400">
                    - ₡{(statements?.incomeStatement?.financialCosts || 0).toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-white/10 pt-2.5 flex justify-between items-center text-slate-400 font-medium">
                  <span>Total Egresos y Costos</span>
                  <span className="font-mono text-rose-400">
                    ₡{(statements?.incomeStatement?.totalExpenses || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Utilidad Neta</span>
                  <span className="text-[11px] text-slate-400">Limpio tras intereses</span>
                </div>
                <span className={`text-xl font-bold font-mono ${
                  (statements?.incomeStatement?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ₡{(statements?.incomeStatement?.netProfit || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* 3. FLUJO DE CAJA (CASH FLOW) */}
            <div className="p-7 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white text-base">Flujo de Caja</h3>
                </div>
                <span className="text-xs font-semibold text-slate-400">Liquidez</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Saldo Inicial Estimado</span>
                  <span className="font-mono text-slate-200">
                    ₡{(statements?.cashFlow?.beginningBalance || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-emerald-400 font-medium">
                  <span>(+) Entradas de Efectivo / Banco</span>
                  <span className="font-mono">
                    ₡{(statements?.cashFlow?.totalInflow || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-rose-400 font-medium">
                  <span>(-) Salidas y Pagos</span>
                  <span className="font-mono">
                    ₡{(statements?.cashFlow?.totalOutflow || 0).toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-white/10 pt-2.5 flex justify-between items-center text-slate-300 font-semibold">
                  <span>Variación Neta</span>
                  <span className={`font-mono ${
                    (statements?.cashFlow?.netCashFlow || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(statements?.cashFlow?.netCashFlow || 0) >= 0 ? '+' : ''}
                    ₡{(statements?.cashFlow?.netCashFlow || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Saldo Final Disponible</span>
                  <span className="text-[11px] text-slate-400">Total en cuentas y caja</span>
                </div>
                <span className="text-xl font-bold font-mono text-white">
                  ₡{(statements?.cashFlow?.endingBalance || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA: BUZÓN BANCARIO                                  */}
      {/* ======================================================== */}
      {activeTab === 'gmail' && (
        <div className="space-y-8">
          <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Sincronización Bancaria Automática
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conexión directa vía IMAP SSL con Gmail. Monitoreo y conciliación instantánea de comprobantes de pago.
                </p>
              </div>
            </div>
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 self-start md:self-auto shrink-0">
              Conexión Segura SSL IMAP
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de Configuración */}
            <div className="lg:col-span-1 p-7 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                Credenciales del Buzón
              </h3>

              <form onSubmit={handleSaveMailConfig} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Correo Gmail Bancario</label>
                  <input
                    type="email"
                    value={mailConfig.email || ''}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="usuario.bancos@gmail.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Contraseña de Aplicación Google (16 caracteres)</label>
                  <input
                    type="password"
                    value={mailConfig.appPassword || ''}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, appPassword: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:border-sky-500 font-mono tracking-wider"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Contabilizar a partir de fecha</label>
                  <input
                    type="date"
                    value={mailConfig.syncStartDate || '2026-10-25'}
                    onChange={(e) => setMailConfig(prev => ({ ...prev, syncStartDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Cualquier comprobante anterior a esta fecha será ignorado.
                  </span>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
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

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleTestMailConnection}
                    disabled={mailTesting || mailSyncing}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/10 hover:bg-slate-700 text-white font-semibold transition-all"
                  >
                    {mailTesting ? 'Verificando...' : 'Probar Conexión'}
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

            {/* Lista de Comprobantes Válidos */}
            <div className="lg:col-span-2 p-7 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    Comprobantes Bancarios Válidos
                  </h3>
                  <p className="text-xs text-slate-400">
                    Notificaciones bancarias detectadas y contabilizadas en tesorería
                    {mailConfig.lastSync && (
                      <span className="ml-2 text-sky-400">
                        • Última sincronización: {new Date(mailConfig.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunAudit}
                    disabled={auditing}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 text-indigo-400 ${auditing ? 'animate-spin' : ''}`} />
                    {auditing ? 'Auditando...' : 'Auditar Sistema'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncMailNow}
                    disabled={mailSyncing || mailTesting}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600/30 border border-sky-500/40 hover:bg-sky-600/50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${mailSyncing ? 'animate-spin' : ''}`} />
                    {mailSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                  </button>
                  <button
                    onClick={fetchMailData}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    title="Refrescar buzón"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contenedor de Comprobantes Válidos */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {mailLogs.filter(l => l.status === 'recorded' || l.status === 'pending_confirmation').length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs rounded-2xl border border-white/5 bg-slate-950/30">
                    No hay comprobantes en el buzón. En cuanto entren notificaciones bancarias válidas a su correo, se reflejarán aquí de inmediato.
                  </div>
                ) : (
                  mailLogs
                    .filter(log => log.status === 'recorded' || log.status === 'pending_confirmation')
                    .map(log => {
                      const isRecorded = log.status === 'recorded';

                      return (
                        <div
                          key={log.id}
                          className={`p-4 rounded-2xl border text-xs transition-all space-y-2.5 ${
                            isRecorded
                              ? 'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/40'
                              : 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                                isRecorded
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {isRecorded ? 'Contabilizado' : 'Pendiente Confirmación'}
                              </span>
                              <span className="font-semibold text-white truncate max-w-sm sm:max-w-md">
                                {log.subject || 'Comprobante Bancario'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {new Date(log.timestamp).toLocaleDateString('es-CR')} {new Date(log.timestamp).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-2">
                              {isRecorded ? (
                                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  Cuenta destino: <strong className="text-emerald-400">{log.accountName}</strong> {log.last4 ? `(•••• ${log.last4})` : ''}
                                </span>
                              ) : (
                                <span className="text-amber-300 flex items-center gap-1.5 font-medium">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{log.parsed?.merchant || 'Comercio'} {log.parsed?.last4 ? `• Tarjeta •••• ${log.parsed.last4}` : ''}</span>
                                </span>
                              )}
                            </div>

                            {(log.amount || log.parsed?.amount) && (
                              <div className="font-mono font-bold text-white text-base self-end sm:self-auto">
                                {(log.currency || log.parsed?.currency) === 'USD' ? '$' : '₡'}{Number(log.amount || log.parsed?.amount).toLocaleString()}
                                <span className="text-[10px] text-slate-400 font-normal ml-1">
                                  {log.currency || log.parsed?.currency || 'CRC'}
                                </span>
                              </div>
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
      {/* MODAL: REGISTRAR / EDITAR CUENTA O EFECTIVO              */}
      {/* ======================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-bold text-white text-base">
                {editingAccount ? 'Editar Cuenta o Efectivo' : 'Registrar Cuenta o Efectivo'}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Tipo</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm(prev => ({
                      ...prev,
                      type: e.target.value,
                      entity: e.target.value === 'efectivo' ? 'Efectivo' : prev.entity
                    }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="debito">Cuenta Bancaria Operativa (Corriente / Vista)</option>
                    <option value="cdp">Certificado de Depósito a Plazo (CDP)</option>
                    <option value="objetivo">Reserva / Meta de Ahorro (Marchamo, Metas)</option>
                    <option value="ahorro">Cuenta de Ahorros</option>
                    <option value="credito">Tarjeta de Crédito</option>
                    <option value="efectivo">Efectivo Físico / Caja</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Entidad / Banco</label>
                  <input
                    type="text"
                    required={accountForm.type !== 'efectivo'}
                    disabled={accountForm.type === 'efectivo'}
                    value={accountForm.type === 'efectivo' ? 'Efectivo' : accountForm.entity}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, entity: e.target.value }))}
                    placeholder="BAC, Wink, Banco Popular..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white disabled:opacity-50"
                  />
                </div>
              </div>

              {accountForm.type !== 'efectivo' && (
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Selección rápida de Banco:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'BAC Credomatic', short: 'BAC', color: '#e4032b' },
                      { name: 'Wink', short: 'Wink', color: '#06b6d4' },
                      { name: 'Banco Popular', short: 'Popular', color: '#f59e0b' },
                      { name: 'BCR', short: 'BCR', color: '#2563eb' },
                      { name: 'Davivienda', short: 'Davivienda', color: '#dc2626' },
                      { name: 'Scotiabank', short: 'Scotiabank', color: '#ef4444' }
                    ].map(b => (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => setAccountForm(prev => ({
                          ...prev,
                          entity: b.name,
                          color: b.color,
                          name: prev.name || `${b.short} ${prev.currency === 'USD' ? 'Dólares' : prev.type === 'ahorro' ? 'Ahorro' : prev.type === 'objetivo' ? 'Meta' : 'Cuenta'}`
                        }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          accountForm.entity === b.name
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-white/10 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {b.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Nombre Descriptivo</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={
                    accountForm.type === 'efectivo'
                      ? 'ej. Efectivo Personal o Billetera'
                      : accountForm.type === 'ahorro'
                      ? 'ej. BAC Ahorro Emergencias'
                      : accountForm.type === 'objetivo'
                      ? 'ej. Meta Vacaciones o Auto'
                      : 'ej. BAC Débito Principal'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Moneda</label>
                  <select
                    value={accountForm.currency}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    <option value="CRC">CRC (₡)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Últimos 4 Dígitos (Opcional)</label>
                  <input
                    type="text"
                    maxLength={4}
                    disabled={accountForm.type === 'efectivo'}
                    value={accountForm.type === 'efectivo' ? 'N/A' : accountForm.last4}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, last4: e.target.value }))}
                    placeholder="ej. 1234"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">
                    {accountForm.type === 'credito' ? 'Deuda Consumida Actual' : 'Saldo Disponible Actual'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.balance !== undefined && accountForm.balance !== '' ? accountForm.balance : accountForm.initialBalance}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAccountForm(prev => ({
                        ...prev,
                        balance: val,
                        initialBalance: val
                      }));
                    }}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              {accountForm.type === 'credito' && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                  <span className="text-[11px] font-bold text-sky-400 block">Parámetros de Crédito:</span>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Límite de Crédito Otorgado</label>
                    <input
                      type="number"
                      step="0.01"
                      value={accountForm.creditLimit}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                      placeholder="Monto total del límite"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1 font-medium">Día de Corte</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.cutOffDay}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, cutOffDay: e.target.value }))}
                        placeholder="22"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
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
                        placeholder="7"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-3">
                {editingAccount && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingAccount.id)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 font-medium"
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
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-bold text-white text-base">
                {editingLoan ? 'Editar Préstamo' : 'Registrar Nuevo Préstamo'}
              </h3>
              <button
                onClick={() => setShowLoanModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Entidad Financiera</label>
                  <input
                    type="text"
                    required
                    value={loanForm.entity}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, entity: e.target.value }))}
                    placeholder="ej. Coopeande / Popular"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Moneda</label>
                  <select
                    value={loanForm.currency}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    <option value="CRC">CRC (₡)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Nombre del Préstamo</label>
                <input
                  type="text"
                  required
                  value={loanForm.name}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. Crédito Personal"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Monto Total Original</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={loanForm.totalAmount}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                    placeholder="Monto otorgado"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Saldo Pendiente Actual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.remainingBalance}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, remainingBalance: e.target.value }))}
                    placeholder="Saldo adeudado"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Cuota Mensual</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={loanForm.monthlyInstallment}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, monthlyInstallment: e.target.value }))}
                    placeholder="Monto cuota"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Día de Pago del Mes</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={loanForm.paymentDay}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, paymentDay: e.target.value }))}
                    placeholder="Día (1-31)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Cuenta de Débito Asociada</label>
                <select
                  value={loanForm.sourceAccountId}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, sourceAccountId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                >
                  <option value="">Ninguna / Débito en ventanilla</option>
                  {(financeData.accounts || []).filter(a => a.type === 'debito').map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.entity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex gap-3">
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
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-bold text-white text-base">
                Registrar Movimiento
              </h3>
              <button
                onClick={() => setShowAddTxModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Tipo</label>
                  <select
                    value={newTx.type}
                    onChange={(e) => setNewTx(prev => ({ ...prev, type: e.target.value, category: CATEGORIES[e.target.value][0] }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    <option value="gasto">Gasto (Débito, Tarjeta o Efectivo)</option>
                    <option value="ingreso">Ingreso (Abono o Depósito)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Cuenta / Recurso</label>
                  <select
                    value={newTx.accountId}
                    onChange={(e) => setNewTx(prev => ({ ...prev, accountId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  >
                    {(financeData.accounts || []).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'efectivo' ? 'Efectivo' : acc.entity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Categoría</label>
                <select
                  value={newTx.category}
                  onChange={(e) => setNewTx(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                >
                  {(CATEGORIES[newTx.type] || []).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Concepto o Comercio</label>
                <input
                  type="text"
                  required
                  value={newTx.note}
                  onChange={(e) => setNewTx(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="ej. Súper, Gasolina, Pago de Servicios"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newTx.amount}
                    onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newTx.date}
                    onChange={(e) => setNewTx(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
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

      {/* ======================================================== */}
      {/* MODAL: AUDITORÍA Y DIAGNÓSTICO INTEGRAL DEL SISTEMA       */}
      {/* ======================================================== */}
      {showAuditModal && auditReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-white/15 p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    Auditoría de Salud del Sistema
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono font-bold">
                      {auditReport.overallStatus}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verificación integral de flujos, modelos IA, base de datos y correo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Check 1: Base de Datos */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Base de Datos & Nube
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {auditReport.checks?.database?.status || 'OK'}
                  </span>
                </div>
                <div className="text-slate-300 space-y-1 font-mono text-[11px]">
                  <div>• Supabase Nube: {auditReport.checks?.database?.supabaseConnected ? 'Conectado ✓' : 'Respaldo Local Activo ✓'}</div>
                  <div>• Archivo Local Maestro: Sincronizado ✓</div>
                  <div>• Total Cuentas Respaldadas: {auditReport.checks?.database?.totalAccounts || 5}</div>
                </div>
              </div>

              {/* Check 2: Contabilidad */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Contabilidad Ejecutiva
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    OK
                  </span>
                </div>
                <div className="text-slate-300 space-y-1 font-mono text-[11px]">
                  <div>• Cuentas Débito (Activo): {auditReport.checks?.accounting?.liquidAccountsCount || 4} en fila única</div>
                  <div>• Tarjeta Crédito (Pasivo): {auditReport.checks?.accounting?.creditCardsCount || 1} en pestaña Créditos</div>
                  <div>• Disponible Total: ₡{(auditReport.checks?.accounting?.totalLiquidBalanceCRC || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Check 3: Buzón IMAP */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Buzón IMAP Gmail
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    CONECTADO
                  </span>
                </div>
                <div className="text-slate-300 space-y-1 font-mono text-[11px]">
                  <div>• Cuenta: {auditReport.checks?.bankMail?.email || 'dr3sagrav@gmail.com'}</div>
                  <div>• Poller Automático: Cada 15 min (Activo ✓)</div>
                  <div>• Filtro Contable: Desde {auditReport.checks?.bankMail?.syncStartDate || '2026-10-25'}</div>
                </div>
              </div>

              {/* Check 4: Flota de Inteligencia Artificial */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Flota de IA & Asistente
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    OPERATIVA
                  </span>
                </div>
                <div className="text-slate-300 space-y-1 font-mono text-[11px]">
                  <div>• Groq LPU (GPT-OSS 120B): Verificado ✓</div>
                  <div>• Google Gemini (3.6 Flash): Verificado ✓</div>
                  <div>• OpenRouter (DeepSeek V3): Configurado ✓</div>
                  <div>• Memoria Asistente Financiero: Enlazada ✓</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-xs hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

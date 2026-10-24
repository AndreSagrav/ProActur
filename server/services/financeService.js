const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'finances.json')
  : path.join(__dirname, '..', 'data', 'finances.json');

const INITIAL_FINANCES = {
  accounts: [
    { id: 'acc_main', name: 'Cuenta Principal', type: 'debito', balance: 14250.00, currency: 'MXN', color: '#10b981' },
    { id: 'acc_cash', name: 'Efectivo', type: 'efectivo', balance: 1800.00, currency: 'MXN', color: '#f59e0b' },
    { id: 'acc_card', name: 'Tarjeta Crédito', type: 'credito', balance: -3200.00, currency: 'MXN', color: '#6366f1' }
  ],
  transactions: [
    { id: 'tx_1', accountId: 'acc_main', type: 'gasto', category: 'Gasolina', note: 'Auto oficina', amount: 450, date: new Date().toISOString() },
    { id: 'tx_2', accountId: 'acc_main', type: 'gasto', category: 'Almuerzo', note: 'Reunión de socios', amount: 320, date: new Date(Date.now() - 86400000).toISOString() },
    { id: 'tx_3', accountId: 'acc_main', type: 'ingreso', category: 'Honorarios', note: 'Pago cliente ProActur', amount: 12000, date: new Date(Date.now() - 172800000).toISOString() }
  ],
  budgets: [
    { id: 'b_general', category: 'General Mensual', monthlyLimit: 20000.00 }
  ]
};

class FinanceService {
  constructor() {
    this.ensureLocalFileExists();
  }

  ensureLocalFileExists() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_FINANCES, null, 2), 'utf8');
      }
    } catch (err) {}
  }

  readLocal() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (_) {}
    return INITIAL_FINANCES;
  }

  writeLocal(data) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }

  async getSummary(month, year) {
    const supabase = getSupabaseClient();
    let data = this.readLocal();

    // Intentar leer de Supabase si existen las tablas
    if (supabase) {
      try {
        const { data: supaAccounts } = await supabase.from('finance_accounts').select('*');
        const { data: supaTx } = await supabase.from('finance_transactions').select('*').order('date', { ascending: false }).limit(20);
        if (supaAccounts && supaAccounts.length > 0) {
          data.accounts = supaAccounts;
        }
        if (supaTx && supaTx.length > 0) {
          data.transactions = supaTx;
        }
      } catch (_) {}
    }

    const totalBalance = data.accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const expenses = data.transactions.filter(t => t.type === 'gasto');
    const incomes = data.transactions.filter(t => t.type === 'ingreso');

    const monthExpense = expenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const monthIncome = incomes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const budgetLimit = data.budgets[0]?.monthlyLimit || 20000;

    return {
      balance: totalBalance,
      monthExpense,
      monthIncome,
      budgetLimit,
      accounts: data.accounts,
      recentTransactions: data.transactions.slice(0, 10)
    };
  }

  async addTransaction(tx) {
    const data = this.readLocal();
    const newTx = {
      id: 'tx_' + Date.now(),
      accountId: tx.accountId || data.accounts[0]?.id || 'acc_main',
      type: tx.type || 'gasto',
      category: tx.category || 'Varios',
      note: tx.note || '',
      amount: Math.abs(Number(tx.amount) || 0),
      date: tx.date || new Date().toISOString()
    };

    data.transactions.unshift(newTx);

    // Actualizar saldo de la cuenta correspondiente
    const targetAccount = data.accounts.find(a => a.id === newTx.accountId);
    if (targetAccount) {
      if (newTx.type === 'gasto') {
        targetAccount.balance -= newTx.amount;
      } else if (newTx.type === 'ingreso') {
        targetAccount.balance += newTx.amount;
      }
    }

    this.writeLocal(data);

    // Sincronizar con Supabase si está disponible
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_transactions').insert({
          id: newTx.id,
          account_id: newTx.accountId,
          type: newTx.type,
          category: newTx.category,
          note: newTx.note,
          amount: newTx.amount,
          date: newTx.date
        });
      } catch (_) {}
    }

    return newTx;
  }
}

module.exports = new FinanceService();

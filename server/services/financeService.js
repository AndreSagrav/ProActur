const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'finances.json')
  : path.join(__dirname, '..', 'data', 'finances.json');

const INITIAL_FINANCES = {
  accounts: [],
  loans: [],
  transactions: [],
  budgets: []
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
      } else {
        // Asegurar que existan las llaves loans y accounts con estructura moderna
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        let modified = false;
        if (!data.loans) {
          data.loans = INITIAL_FINANCES.loans;
          modified = true;
        }
        if (!data.accounts || data.accounts.length === 0) {
          data.accounts = INITIAL_FINANCES.accounts;
          modified = true;
        }
        if (modified) {
          fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        }
      }
    } catch (err) {
      console.warn('[FinanceService Init Warn]', err.message);
    }
  }

  readLocal() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!data.loans) data.loans = [];
        return data;
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

    // Sincronizar lectura con Supabase si las tablas existen
    if (supabase) {
      try {
        const { data: supaAccounts } = await supabase.from('finance_accounts').select('*');
        const { data: supaLoans } = await supabase.from('finance_loans').select('*');
        const { data: supaTx } = await supabase.from('finance_transactions').select('*').order('date', { ascending: false }).limit(50);
        
        if (supaAccounts && supaAccounts.length > 0) {
          const localAccounts = data.accounts || [];
          data.accounts = supaAccounts.map(sa => {
            const local = localAccounts.find(la => la.id === sa.id);
            return {
              ...local,
              ...sa,
              last4: sa.last4 || local?.last4 || (sa.name.includes('4120') ? '4120' : sa.name.includes('8841') ? '8841' : sa.name.includes('5201') ? '5201' : sa.name.includes('9312') ? '9312' : null),
              entity: sa.entity || local?.entity || (sa.name.includes('BAC') ? 'BAC Credomatic' : sa.name.includes('Popular') ? 'Banco Popular' : sa.name.includes('Coopeande') ? 'Coopeande' : 'Entidad Bancaria'),
              initialBalance: sa.initial_balance !== undefined ? sa.initial_balance : (local?.initialBalance || 0),
              creditLimit: sa.credit_limit !== undefined ? sa.credit_limit : (local?.creditLimit || (sa.type === 'credito' ? 1500000 : null)),
              cutOffDay: sa.cut_off_day !== undefined ? sa.cut_off_day : (local?.cutOffDay || (sa.type === 'credito' ? 22 : null)),
              paymentDueDay: sa.payment_due_day !== undefined ? sa.payment_due_day : (local?.paymentDueDay || (sa.type === 'credito' ? 7 : null))
            };
          });
        }
        if (supaLoans && supaLoans.length > 0) {
          data.loans = supaLoans;
        }
        if (supaTx && supaTx.length > 0) {
          data.transactions = supaTx;
        }
      } catch (_) {}
    }

    // Calcular saldos y límites
    const now = new Date();
    const currentDay = now.getDate();

    // Procesar cuentas con alertas de corte y pago
    const enrichedAccounts = (data.accounts || []).map(acc => {
      let daysToCutOff = null;
      let daysToPayment = null;
      let isPaymentUrgent = false;

      if (acc.type === 'credito' && acc.cutOffDay) {
        let diffCut = acc.cutOffDay - currentDay;
        if (diffCut < 0) diffCut += 30; // Aproximación días restantes
        daysToCutOff = diffCut;

        if (acc.paymentDueDay) {
          let diffPay = acc.paymentDueDay - currentDay;
          if (diffPay < 0) diffPay += 30;
          daysToPayment = diffPay;
          if (daysToPayment <= 3) isPaymentUrgent = true;
        }
      }

      const availableCredit = acc.type === 'credito' && acc.creditLimit
        ? Math.max(0, acc.creditLimit - (acc.balance || 0))
        : null;

      return {
        ...acc,
        daysToCutOff,
        daysToPayment,
        isPaymentUrgent,
        availableCredit
      };
    });

    const totalBalance = enrichedAccounts
      .filter(a => a.type === 'debito' || a.type === 'efectivo')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const totalCreditDebt = enrichedAccounts
      .filter(a => a.type === 'credito')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const expenses = (data.transactions || []).filter(t => t.type === 'gasto');
    const incomes = (data.transactions || []).filter(t => t.type === 'ingreso');

    const monthExpense = expenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const monthIncome = incomes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const budgetLimit = data.budgets?.[0]?.monthlyLimit || 0;

    // Alertas ejecutivas de vencimiento de préstamos
    const enrichedLoans = (data.loans || []).map(loan => {
      let daysToPayment = null;
      if (loan.paymentDay) {
        let diff = loan.paymentDay - currentDay;
        if (diff < 0) diff += 30;
        daysToPayment = diff;
      }
      return {
        ...loan,
        daysToPayment,
        isUrgent: daysToPayment !== null && daysToPayment <= 3
      };
    });

    return {
      balance: totalBalance,
      creditDebt: totalCreditDebt,
      monthExpense,
      monthIncome,
      budgetLimit,
      accounts: enrichedAccounts,
      loans: enrichedLoans,
      recentTransactions: (data.transactions || []).slice(0, 30)
    };
  }

  // GESTIÓN DE CUENTAS
  async createAccount(acc) {
    const data = this.readLocal();
    const newAcc = {
      id: 'acc_' + Date.now(),
      name: acc.name || 'Nueva Cuenta',
      entity: acc.entity || 'Banco',
      type: acc.type || 'debito',
      last4: (acc.last4 || '').slice(-4),
      initialBalance: Number(acc.initialBalance) || 0,
      balance: Number(acc.initialBalance) || 0,
      currency: acc.currency || 'CRC',
      creditLimit: acc.type === 'credito' ? (Number(acc.creditLimit) || 0) : null,
      cutOffDay: acc.type === 'credito' ? (Number(acc.cutOffDay) || 1) : null,
      paymentDueDay: acc.type === 'credito' ? (Number(acc.paymentDueDay) || 1) : null,
      color: acc.color || '#3b82f6',
      createdAt: new Date().toISOString()
    };

    data.accounts.push(newAcc);
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_accounts').insert(newAcc);
      } catch (_) {}
    }

    return newAcc;
  }

  async updateAccount(id, updates) {
    const data = this.readLocal();
    const idx = data.accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;

    data.accounts[idx] = {
      ...data.accounts[idx],
      ...updates,
      last4: updates.last4 ? updates.last4.slice(-4) : data.accounts[idx].last4,
      initialBalance: updates.initialBalance !== undefined ? Number(updates.initialBalance) : data.accounts[idx].initialBalance,
      balance: updates.balance !== undefined ? Number(updates.balance) : data.accounts[idx].balance
    };

    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_accounts').update(data.accounts[idx]).eq('id', id);
      } catch (_) {}
    }

    return data.accounts[idx];
  }

  async deleteAccount(id) {
    const data = this.readLocal();
    const idx = data.accounts.findIndex(a => a.id === id);
    if (idx === -1) return false;

    data.accounts.splice(idx, 1);
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_accounts').delete().eq('id', id);
      } catch (_) {}
    }

    return true;
  }

  // GESTIÓN DE PRÉSTAMOS
  async getLoans() {
    const summary = await this.getSummary();
    return summary.loans;
  }

  async createLoan(loan) {
    const data = this.readLocal();
    const newLoan = {
      id: 'loan_' + Date.now(),
      name: loan.name || 'Préstamo Nuevo',
      entity: loan.entity || 'Entidad Financiera',
      totalAmount: Number(loan.totalAmount) || 0,
      remainingBalance: Number(loan.remainingBalance !== undefined ? loan.remainingBalance : loan.totalAmount) || 0,
      monthlyInstallment: Number(loan.monthlyInstallment) || 0,
      paymentDay: Number(loan.paymentDay) || 15,
      sourceAccountId: loan.sourceAccountId || '',
      currency: loan.currency || 'CRC',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    data.loans.push(newLoan);
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_loans').insert(newLoan);
      } catch (_) {}
    }

    return newLoan;
  }

  async updateLoan(id, updates) {
    const data = this.readLocal();
    const idx = data.loans.findIndex(l => l.id === id);
    if (idx === -1) return null;

    data.loans[idx] = {
      ...data.loans[idx],
      ...updates
    };

    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_loans').update(data.loans[idx]).eq('id', id);
      } catch (_) {}
    }

    return data.loans[idx];
  }

  async deleteLoan(id) {
    const data = this.readLocal();
    const idx = data.loans.findIndex(l => l.id === id);
    if (idx === -1) return false;

    data.loans.splice(idx, 1);
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_loans').delete().eq('id', id);
      } catch (_) {}
    }

    return true;
  }

  // PAGO DE CUOTA DE PRÉSTAMO
  async payLoanInstallment(loanId, amount, accountId) {
    const data = this.readLocal();
    const loan = data.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Préstamo no encontrado');

    const payAmount = Number(amount) || loan.monthlyInstallment;
    loan.remainingBalance = Math.max(0, loan.remainingBalance - payAmount);
    if (loan.remainingBalance <= 0) {
      loan.status = 'paid';
    }

    // Registrar transacción de gasto
    const targetAccountId = accountId || loan.sourceAccountId || data.accounts[0]?.id;
    const tx = await this.addTransaction({
      accountId: targetAccountId,
      type: 'gasto',
      category: 'Servicios y Software',
      note: `Cuota mensual: ${loan.name} (${loan.entity})`,
      amount: payAmount,
      date: new Date().toISOString()
    });

    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_loans').update({
          remaining_balance: loan.remainingBalance,
          status: loan.status
        }).eq('id', loan.id);
      } catch (_) {}
    }

    return { loan, transaction: tx };
  }

  // TRANSACCIONES
  async addTransaction(tx) {
    const data = this.readLocal();
    const newTx = {
      id: 'tx_' + Date.now(),
      accountId: tx.accountId || data.accounts[0]?.id || 'acc_bac_debito',
      type: tx.type || 'gasto',
      category: tx.category || 'Varios',
      note: tx.note || '',
      merchant: tx.merchant || '',
      amount: Math.abs(Number(tx.amount) || 0),
      currency: tx.currency || 'CRC',
      source: tx.source || 'manual', // 'manual' | 'gmail_auto' | 'xml_hacienda'
      rawSnippet: tx.rawSnippet || null,
      date: tx.date || new Date().toISOString()
    };

    data.transactions.unshift(newTx);

    // Actualizar saldo de la cuenta correspondiente
    const targetAccount = data.accounts.find(a => a.id === newTx.accountId);
    if (targetAccount) {
      if (targetAccount.type === 'credito') {
        // En tarjeta de crédito: un gasto aumenta el saldo consumido (deuda); un pago/ingreso lo reduce
        if (newTx.type === 'gasto') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) + newTx.amount;
        } else if (newTx.type === 'ingreso') {
          targetAccount.balance = Math.max(0, (Number(targetAccount.balance) || 0) - newTx.amount);
        }
      } else {
        // En cuenta de débito: un gasto resta; un ingreso suma
        if (newTx.type === 'gasto') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) - newTx.amount;
        } else if (newTx.type === 'ingreso') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) + newTx.amount;
        }
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
        if (targetAccount) {
          await supabase.from('finance_accounts').update({ balance: targetAccount.balance }).eq('id', targetAccount.id);
        }
      } catch (_) {}
    }

    return newTx;
  }

  async deleteTransaction(id) {
    const data = this.readLocal();
    const index = data.transactions.findIndex(t => t.id === id);
    if (index === -1) return false;
    const [deleted] = data.transactions.splice(index, 1);
    const targetAccount = data.accounts.find(a => a.id === deleted.accountId);
    
    if (targetAccount) {
      if (targetAccount.type === 'credito') {
        if (deleted.type === 'gasto') {
          targetAccount.balance = Math.max(0, (Number(targetAccount.balance) || 0) - deleted.amount);
        } else if (deleted.type === 'ingreso') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) + deleted.amount;
        }
      } else {
        if (deleted.type === 'gasto') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) + deleted.amount;
        } else if (deleted.type === 'ingreso') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) - deleted.amount;
        }
      }
    }
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_transactions').delete().eq('id', id);
        if (targetAccount) {
          await supabase.from('finance_accounts').update({ balance: targetAccount.balance }).eq('id', targetAccount.id);
        }
      } catch (_) {}
    }

    return true;
  }

  async getFinancialStatements() {
    const summary = await this.getSummary();
    const accounts = summary.accounts || [];
    const loans = summary.loans || [];
    const transactions = summary.recentTransactions || [];

    // 1. Activos
    const liquidAssets = accounts
      .filter(a => a.type === 'debito' || a.type === 'efectivo')
      .map(a => ({ name: a.name, entity: a.entity || 'Tesorería', amount: Number(a.balance) || 0, currency: a.currency || 'CRC' }));
    const totalLiquidAssets = liquidAssets.reduce((sum, a) => sum + a.amount, 0);

    // 2. Pasivos
    const shortTermDebt = accounts
      .filter(a => a.type === 'credito')
      .map(a => ({ name: a.name, entity: a.entity || 'Tarjeta de Crédito', amount: Number(a.balance) || 0, currency: a.currency || 'CRC' }));
    const totalShortTermDebt = shortTermDebt.reduce((sum, a) => sum + a.amount, 0);

    const longTermDebt = loans
      .filter(l => l.status === 'active')
      .map(l => ({ name: l.name, entity: l.entity || 'Entidad', amount: Number(l.remainingBalance) || 0, currency: l.currency || 'CRC' }));
    const totalLongTermDebt = longTermDebt.reduce((sum, l) => sum + l.amount, 0);

    const totalLiabilities = totalShortTermDebt + totalLongTermDebt;
    const netWorth = totalLiquidAssets - totalLiabilities;

    // 3. Estado de Resultados (P&L)
    const incomeItems = transactions.filter(t => t.type === 'ingreso');
    const expenseItems = transactions.filter(t => t.type === 'gasto');

    const grossRevenue = incomeItems.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const operatingExpenses = expenseItems
      .filter(t => !t.category?.toLowerCase().includes('financiero') && !t.category?.toLowerCase().includes('interes'))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const financialCosts = expenseItems
      .filter(t => t.category?.toLowerCase().includes('financiero') || t.category?.toLowerCase().includes('interes'))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalExpenses = operatingExpenses + financialCosts;
    const netProfit = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0.0';

    return {
      balanceSheet: {
        assets: {
          items: liquidAssets,
          total: totalLiquidAssets
        },
        liabilities: {
          shortTerm: { items: shortTermDebt, total: totalShortTermDebt },
          longTerm: { items: longTermDebt, total: totalLongTermDebt },
          total: totalLiabilities
        },
        equity: {
          netWorth,
          status: netWorth >= 0 ? 'Solvente' : 'Déficit Pasivo'
        }
      },
      incomeStatement: {
        grossRevenue,
        operatingExpenses,
        financialCosts,
        totalExpenses,
        netProfit,
        profitMargin,
        isProfitable: netProfit >= 0
      },
      cashFlow: {
        beginningBalance: totalLiquidAssets - grossRevenue + totalExpenses,
        totalInflow: grossRevenue,
        totalOutflow: totalExpenses,
        netCashFlow: grossRevenue - totalExpenses,
        endingBalance: totalLiquidAssets
      }
    };
  }
}

module.exports = new FinanceService();

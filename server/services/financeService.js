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
          let customOrderIds = localAccounts.map(a => a.id);
          try {
            const { data: orderDoc } = await supabase.from('meetings').select('transcript').eq('id', '__sys_accounts_order__').single();
            if (orderDoc && orderDoc.transcript) {
              const parsed = JSON.parse(orderDoc.transcript);
              if (Array.isArray(parsed) && parsed.length > 0) customOrderIds = parsed;
            }
          } catch (_) {}

          const mapped = supaAccounts.map(sa => {
            const local = localAccounts.find(la => la.id === sa.id);
            return {
              ...local,
              ...sa,
              last4: sa.last4 || local?.last4,
              entity: sa.entity || local?.entity || (sa.name.includes('BAC') ? 'BAC Credomatic' : sa.name.includes('Popular') ? 'Banco Popular' : sa.name.includes('Wink') ? 'Wink' : 'Banco'),
              initialBalance: sa.initial_balance !== undefined ? sa.initial_balance : (local?.initialBalance || 0),
              creditLimit: sa.credit_limit !== undefined ? sa.credit_limit : (local?.creditLimit || (sa.type === 'credito' ? 1344000 : null)),
              cutOffDay: sa.cut_off_day !== undefined ? sa.cut_off_day : (local?.cutOffDay || (sa.type === 'credito' ? 13 : null)),
              paymentDueDay: sa.payment_due_day !== undefined ? sa.payment_due_day : (local?.paymentDueDay || (sa.type === 'credito' ? 2 : null)),
              debtUSD: local?.debtUSD ?? 0,
              creditLimitUSD: local?.creditLimitUSD ?? (sa.type === 'credito' ? 3000 : null),
              availableCredit: local?.availableCredit ?? (local?.creditLimit ? Math.max(0, local.creditLimit - (sa.balance || 0)) : null),
              availableCreditUSD: local?.availableCreditUSD ?? null,
              cashPaymentCRC: local?.cashPaymentCRC ?? 0,
              cashPaymentUSD: local?.cashPaymentUSD ?? 0,
              minPaymentCRC: local?.minPaymentCRC ?? 0,
              minPaymentUSD: local?.minPaymentUSD ?? 0,
              interestRateCRC: local?.interestRateCRC ?? 32,
              interestRateUSD: local?.interestRateUSD ?? 27.5,
              rewardPoints: local?.rewardPoints ?? 0
            };
          });

          const sorted = [];
          for (const id of customOrderIds) {
            const acc = mapped.find(m => m.id === id);
            if (acc) sorted.push(acc);
          }
          for (const acc of mapped) {
            if (!sorted.some(s => s.id === acc.id)) sorted.push(acc);
          }
          data.accounts = sorted;
        }
        if (supaLoans && supaLoans.length > 0) {
          data.loans = supaLoans;
        }
        if (supaTx && supaTx.length > 0) {
          const localTxs = data.transactions || [];
          data.transactions = supaTx.map(st => {
            const local = localTxs.find(lt => lt.id === st.id);
            return {
              ...local,
              ...st,
              accountId: st.account_id || st.accountId || local?.accountId,
              currency: st.currency || local?.currency || 'CRC',
              source: st.source || local?.source || 'gmail_auto',
              merchant: st.merchant || local?.merchant || ''
            };
          });
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

      let daysToDueDate = null;
      if (acc.dueDate) {
        try {
          const due = new Date(acc.dueDate + 'T00:00:00');
          if (!isNaN(due.getTime())) {
            const diffMs = due.getTime() - now.getTime();
            daysToDueDate = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          }
        } catch (_) {}
      }

      return {
        ...acc,
        daysToCutOff,
        daysToPayment,
        isPaymentUrgent,
        availableCredit,
        daysToDueDate
      };
    });

    const liquidOperatingAccounts = enrichedAccounts.filter(a => a.type === 'debito' || a.type === 'efectivo');
    const liquidBalanceCRC = liquidOperatingAccounts
      .filter(a => (a.currency || 'CRC').toUpperCase() === 'CRC')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const liquidBalanceUSD = liquidOperatingAccounts
      .filter(a => (a.currency || '').toUpperCase() === 'USD')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const savingsAccounts = enrichedAccounts.filter(a => a.type === 'ahorro' || a.type === 'objetivo' || a.type === 'cdp' || a.type === 'inversion');
    const savingsBalanceCRC = savingsAccounts
      .filter(a => (a.currency || 'CRC').toUpperCase() === 'CRC')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const savingsBalanceUSD = savingsAccounts
      .filter(a => (a.currency || '').toUpperCase() === 'USD')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const totalAssetsCRC = liquidBalanceCRC + savingsBalanceCRC;
    const totalAssetsUSD = liquidBalanceUSD + savingsBalanceUSD;

    const creditAccounts = enrichedAccounts.filter(a => a.type === 'credito');

    // Obligaciones exigibles a pagar en la próxima fecha de pago (Pago de Contado al corte)
    const creditDueCRC = creditAccounts
      .reduce((sum, a) => sum + (Number(a.cashPaymentCRC !== undefined && a.cashPaymentCRC !== null ? a.cashPaymentCRC : 0) || 0), 0);
    const creditDueUSD = creditAccounts
      .reduce((sum, a) => sum + (Number(a.cashPaymentUSD !== undefined && a.cashPaymentUSD !== null ? a.cashPaymentUSD : 0) || 0), 0);

    // Consumos flotantes que entran hasta el siguiente corte (no vencen ahora)
    const floatingDebtCRC = creditAccounts
      .reduce((sum, a) => sum + Math.max(0, (Number(a.balance) || 0) - (Number(a.cashPaymentCRC) || 0)), 0);
    const floatingDebtUSD = creditAccounts
      .reduce((sum, a) => sum + Math.max(0, (Number(a.debtUSD) || 0) - (Number(a.cashPaymentUSD) || 0)), 0);

    // Saldo total consumido en líneas de crédito
    const totalCreditBalanceCRC = creditAccounts
      .reduce((sum, a) => sum + ((a.currency || 'CRC').toUpperCase() === 'CRC' ? (Number(a.balance) || 0) : 0), 0);
    const totalCreditBalanceUSD = creditAccounts
      .reduce((sum, a) => sum + (Number(a.debtUSD) || ((a.currency || '').toUpperCase() === 'USD' ? Number(a.balance) : 0) || 0), 0);

    const liquidAccountIds = new Set(enrichedAccounts.filter(a => a.type !== 'credito').map(a => a.id));
    const creditAccountIds = new Set(creditAccounts.map(a => a.id));

    // Egresos líquidos: ÚNICAMENTE los que salen de cuentas de débito o efectivo
    const liquidExpenses = (data.transactions || []).filter(t => t.type === 'gasto' && liquidAccountIds.has(t.accountId || t.account_id));
    // Consumos en tarjetas de crédito: deuda asumida en tarjeta (tratamiento diferenciado)
    const creditExpenses = (data.transactions || []).filter(t => t.type === 'gasto' && creditAccountIds.has(t.accountId || t.account_id));
    const incomes = (data.transactions || []).filter(t => t.type === 'ingreso');

    const monthExpense = liquidExpenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const monthCreditExpense = creditExpenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
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
      balance: liquidBalanceCRC,
      balanceCRC: liquidBalanceCRC,
      balanceUSD: liquidBalanceUSD,
      liquidBalanceCRC,
      liquidBalanceUSD,
      savingsBalanceCRC,
      savingsBalanceUSD,
      totalAssetsCRC,
      totalAssetsUSD,
      creditDueCRC,
      creditDueUSD,
      floatingDebtCRC,
      floatingDebtUSD,
      creditDebt: creditDueCRC,
      creditDebtCRC: creditDueCRC,
      creditDebtUSD: creditDueUSD,
      totalCreditBalanceCRC,
      totalCreditBalanceUSD,
      monthExpense,
      monthCreditExpense,
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
      dueDate: acc.dueDate || null,
      interestRate: acc.interestRate !== undefined && acc.interestRate !== '' ? Number(acc.interestRate) : null,
      yieldAmount: acc.yieldAmount !== undefined && acc.yieldAmount !== '' ? Number(acc.yieldAmount) : null,
      yieldFrequency: acc.yieldFrequency || 'quincenal',
      yieldAccountId: acc.yieldAccountId || null,
      color: acc.color || '#3b82f6',
      createdAt: new Date().toISOString()
    };

    data.accounts.push(newAcc);
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_accounts').upsert({
          id: newAcc.id,
          name: newAcc.name,
          type: newAcc.type,
          balance: newAcc.balance,
          currency: newAcc.currency,
          color: newAcc.color
        });
      } catch (_) {}
    }

    return newAcc;
  }

  async updateAccount(id, updates) {
    const data = this.readLocal();
    let idx = data.accounts.findIndex(a => a.id === id);
    if (idx === -1) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: supaAcc } = await supabase.from('finance_accounts').select('*').eq('id', id).single();
          if (supaAcc) {
            data.accounts.push({
              id: supaAcc.id,
              name: supaAcc.name,
              type: supaAcc.type,
              balance: supaAcc.balance || 0,
              initialBalance: supaAcc.initial_balance || 0,
              currency: supaAcc.currency || 'USD',
              entity: supaAcc.entity || 'Banco',
              color: supaAcc.color || '#e4032b'
            });
            idx = data.accounts.length - 1;
          }
        } catch (_) {}
      }
    }
    if (idx === -1) return null;

    const newInit = updates.initialBalance !== undefined ? Number(updates.initialBalance) : (data.accounts[idx].initialBalance || 0);
    const newBal = updates.balance !== undefined ? Number(updates.balance) : (updates.initialBalance !== undefined ? Number(updates.initialBalance) : (data.accounts[idx].balance || 0));

    data.accounts[idx] = {
      ...data.accounts[idx],
      ...updates,
      last4: updates.last4 ? updates.last4.slice(-4) : (data.accounts[idx].last4 || ''),
      initialBalance: newInit,
      balance: newBal,
      dueDate: updates.dueDate !== undefined ? updates.dueDate : data.accounts[idx].dueDate,
      interestRate: updates.interestRate !== undefined && updates.interestRate !== '' ? (Number(updates.interestRate) || null) : data.accounts[idx].interestRate,
      yieldAmount: updates.yieldAmount !== undefined && updates.yieldAmount !== '' ? (Number(updates.yieldAmount) || null) : data.accounts[idx].yieldAmount,
      yieldFrequency: updates.yieldFrequency !== undefined ? updates.yieldFrequency : (data.accounts[idx].yieldFrequency || 'quincenal'),
      yieldAccountId: updates.yieldAccountId !== undefined ? updates.yieldAccountId : data.accounts[idx].yieldAccountId
    };

    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_accounts').upsert({
          id: data.accounts[idx].id,
          name: data.accounts[idx].name,
          type: data.accounts[idx].type,
          balance: data.accounts[idx].balance,
          currency: data.accounts[idx].currency,
          color: data.accounts[idx].color
        });
      } catch (_) {}
    }

    return data.accounts[idx];
  }

  async deleteAccount(id) {
    const data = this.readLocal();
    const idx = data.accounts.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.accounts.splice(idx, 1);
      this.writeLocal(data);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('finance_accounts').delete().eq('id', id);
        const { data: orderDoc } = await supabase.from('meetings').select('transcript').eq('id', '__sys_accounts_order__').single();
        if (orderDoc && orderDoc.transcript) {
          let list = JSON.parse(orderDoc.transcript);
          if (Array.isArray(list)) {
            list = list.filter(item => item !== id);
            await supabase.from('meetings').upsert({
              id: '__sys_accounts_order__',
              title: '[SYSTEM] Accounts Order',
              summary: 'Orden personalizado de cuentas bancarias',
              transcript: JSON.stringify(list),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          }
        }
      } catch (_) {}
    }

    return true;
  }

  async reorderAccounts(orderedIds) {
    if (!Array.isArray(orderedIds)) return false;
    const data = this.readLocal();
    const existing = data.accounts || [];
    const ordered = [];
    for (const id of orderedIds) {
      const acc = existing.find(a => a.id === id);
      if (acc) ordered.push(acc);
    }
    for (const acc of existing) {
      if (!ordered.some(o => o.id === acc.id)) ordered.push(acc);
    }
    data.accounts = ordered;
    this.writeLocal(data);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('meetings').upsert({
          id: '__sys_accounts_order__',
          title: '[SYSTEM] Accounts Order',
          summary: 'Orden personalizado de cuentas bancarias',
          transcript: JSON.stringify(ordered.map(a => a.id)),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      } catch (_) {}
    }

    return ordered;
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

  async addTransaction(tx) {
    const data = this.readLocal();
    const cleanAmount = Math.abs(Number(tx.amount) || 0);
    const cleanCurrency = tx.currency || 'CRC';
    const cleanType = tx.type || 'gasto';
    const cleanDate = tx.date || new Date().toISOString();

    // Evitar transacciones duplicadas por sincronización de correo
    if (tx.source === 'gmail_auto') {
      const isDuplicate = (data.transactions || []).some(existing => {
        return Math.abs(Number(existing.amount) || 0) === cleanAmount &&
          existing.currency === cleanCurrency &&
          existing.type === cleanType &&
          ((existing.merchant && tx.merchant && existing.merchant.toLowerCase() === tx.merchant.toLowerCase()) ||
           (existing.note && tx.note && existing.note.toLowerCase() === tx.note.toLowerCase())) &&
          (existing.date || '').slice(0, 10) === cleanDate.slice(0, 10);
      });
      if (isDuplicate) {
        return { isDuplicate: true };
      }

      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        try {
          const { data: supaDup } = await supabaseClient
            .from('finance_transactions')
            .select('id, amount, note, date')
            .eq('amount', cleanAmount)
            .limit(10);
          if (supaDup && supaDup.some(e => 
            (e.date || '').slice(0, 10) === cleanDate.slice(0, 10) &&
            ((tx.merchant && (e.note || '').toLowerCase().includes(tx.merchant.toLowerCase())) ||
             (tx.note && (e.note || '').toLowerCase() === tx.note.toLowerCase()))
          )) {
            return { isDuplicate: true };
          }
        } catch (_) {}
      }
    }

    const newTx = {
      id: 'tx_' + Date.now(),
      accountId: tx.accountId || data.accounts[0]?.id || 'acc_bac_debito',
      type: cleanType,
      category: tx.category || 'Varios',
      note: tx.note || '',
      merchant: tx.merchant || '',
      amount: cleanAmount,
      currency: cleanCurrency,
      source: tx.source || 'manual', // 'manual' | 'gmail_auto' | 'xml_hacienda'
      rawSnippet: tx.rawSnippet || null,
      date: cleanDate
    };

    data.transactions.unshift(newTx);

    // Actualizar saldo de la cuenta correspondiente (con conversión automática de divisa si difiere)
    const targetAccount = data.accounts.find(a => a.id === newTx.accountId);
    if (targetAccount) {
      const EXCHANGE_RATE = 520; // 1 USD ≈ 520 CRC (promedio bancario Costa Rica)
      let effectiveAmount = newTx.amount;

      if (newTx.currency === 'USD' && targetAccount.currency === 'CRC') {
        effectiveAmount = Math.round(newTx.amount * EXCHANGE_RATE);
        if (!newTx.note.includes('USD')) {
          newTx.note += ` (Orig: $${newTx.amount.toFixed(2)} USD @ ₡${EXCHANGE_RATE})`;
        }
      } else if (newTx.currency === 'CRC' && targetAccount.currency === 'USD') {
        effectiveAmount = +(newTx.amount / EXCHANGE_RATE).toFixed(2);
        if (!newTx.note.includes('CRC')) {
          newTx.note += ` (Orig: ₡${newTx.amount.toLocaleString()} CRC @ ₡${EXCHANGE_RATE})`;
        }
      }

      if (targetAccount.type === 'credito') {
        // En tarjeta de crédito: un gasto aumenta el saldo consumido (deuda); un pago/ingreso lo reduce
        if (newTx.type === 'gasto') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) + effectiveAmount;
        } else if (newTx.type === 'ingreso') {
          targetAccount.balance = Math.max(0, (Number(targetAccount.balance) || 0) - effectiveAmount);
        }
      } else {
        // En cuenta de débito: un gasto resta; un ingreso suma
        if (newTx.type === 'gasto') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) - effectiveAmount;
        } else if (newTx.type === 'ingreso') {
          targetAccount.balance = (Number(targetAccount.balance) || 0) + effectiveAmount;
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

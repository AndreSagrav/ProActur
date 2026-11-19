const config = require('../config');
const financeService = require('./financeService');
const financeCategorizer = require('./financeCategorizer');

const STATEMENT_MODELS = [
  config.GEMINI_MODEL || 'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash'
];

function extractJsonBlock(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeMerchant(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isSameOrCloseDate(dateA, dateB, maxDays = 2) {
  if (!dateA || !dateB) return false;
  const tA = new Date(String(dateA).slice(0, 10)).getTime();
  const tB = new Date(String(dateB).slice(0, 10)).getTime();
  if (Number.isNaN(tA) || Number.isNaN(tB)) return false;
  return Math.abs(tA - tB) <= maxDays * 24 * 60 * 60 * 1000;
}

class FinanceStatementService {
  async parseStatementWithGemini({ fileBase64, mimeType, fileName }) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada para analizar estados de cuenta o comprobantes.');
    }

    const safeMime = mimeType || 'application/pdf';
    const isText = safeMime.startsWith('text/') || /\.(csv|txt)$/i.test(fileName || '');

    const systemPrompt = `Eres un auditor contable experto en bancos de Costa Rica (BAC Credomatic, Banco Popular, BCR, Davivienda, Scotiabank, Wink, Coopeande, Coopenae).
Analiza el documento adjunto (puede ser un estado de cuenta de tarjeta de crédito, un estado de cuenta bancario o un comprobante de pago de tarjeta/transferencia).
Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "documentType": "credit_card_statement" | "payment_receipt" | "bank_statement",
  "bank": "Nombre del banco detectado",
  "cardLast4": "últimos 4 dígitos si aparecen o null",
  "accountHint": "descripción breve de cuenta/tarjeta",
  "statementInfo": {
    "cutoffDate": "YYYY-MM-DD o null",
    "dueDate": "YYYY-MM-DD o null",
    "cashPaymentCRC": number | null,
    "cashPaymentUSD": number | null,
    "minPaymentCRC": number | null,
    "minPaymentUSD": number | null,
    "totalBalanceCRC": number | null,
    "totalBalanceUSD": number | null
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "Comercio o contraparte limpia",
      "description": "Descripción original resumida",
      "amount": number (positivo),
      "currency": "CRC" | "USD",
      "type": "gasto" | "ingreso" | "pago_tarjeta",
      "category": "Categoría sugerida"
    }
  ]
}
Reglas:
- Si es un comprobante de pago de tarjeta de crédito, incluye la transacción principal con "type": "pago_tarjeta" y "documentType": "payment_receipt".
- Si es un estado de cuenta de tarjeta, extrae TODAS las líneas de consumo/cargos ("gasto") y abonos/pagos ("pago_tarjeta" o "ingreso"), respetando si cada línea está en CRC o USD.
- No inventes montos ni fechas.`;

    const parts = [{ text: systemPrompt }];
    if (isText) {
      const decodedText = Buffer.from(fileBase64, 'base64').toString('utf8').slice(0, 60000);
      parts.push({ text: `Archivo (${fileName || 'estado.csv'}):\n${decodedText}` });
    } else {
      parts.push({
        inlineData: {
          mimeType: safeMime,
          data: fileBase64
        }
      });
    }

    let lastError = null;
    for (const modelName of [...new Set(STATEMENT_MODELS)]) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = new Error(`Gemini ${modelName} (${response.status}): ${errText.slice(0, 200)}`);
          continue;
        }

        const payload = await response.json();
        const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = extractJsonBlock(rawText);
        if (parsed && Array.isArray(parsed.transactions)) {
          return parsed;
        }
        lastError = new Error(`Respuesta no estructurada de ${modelName}`);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('No se pudo analizar el documento con Gemini.');
  }

  async previewStatementImport({ fileBase64, mimeType, fileName, accountId }) {
    const parsed = await this.parseStatementWithGemini({ fileBase64, mimeType, fileName });
    const financeData = await financeService.getSummary();
    const accounts = financeData.accounts || [];
    const existingTxs = financeData.transactions || [];

    // Detectar cuenta destino automática por accountId, cardLast4 o banco (con alias Coopenae <-> Wink)
    let matchedAccount = accountId ? accounts.find(a => a.id === accountId) : null;
    if (!matchedAccount && parsed.cardLast4) {
      const last4 = String(parsed.cardLast4).trim();
      matchedAccount = accounts.find(a =>
        String(a.last4 || '').trim() === last4 || (a.name || '').includes(last4)
      );
    }
    if (!matchedAccount && parsed.bank) {
      const bankLower = parsed.bank.toLowerCase();
      const bankAliases = (bankLower.includes('coopenae') || bankLower.includes('wink'))
        ? ['coopenae', 'wink']
        : [bankLower.split(' ')[0]];

      const matchesAlias = (a) => {
        const hay = `${a.name || ''} ${a.entity || ''}`.toLowerCase();
        return bankAliases.some(alias => alias && hay.includes(alias));
      };

      if (parsed.documentType === 'credit_card_statement') {
        matchedAccount = accounts.find(a => a.type === 'credito' && matchesAlias(a))
          || accounts.find(a => a.type === 'credito');
      } else {
        matchedAccount = accounts.find(a => a.type !== 'ahorro' && a.type !== 'objetivo' && matchesAlias(a));
      }
    }
    if (!matchedAccount && parsed.documentType === 'credit_card_statement') {
      matchedAccount = accounts.find(a => a.type === 'credito');
    }

    const enrichedTransactions = (parsed.transactions || []).map((tx, idx) => {
      const cleanAmount = Math.abs(Number(tx.amount) || 0);
      const cleanCurrency = (tx.currency || 'CRC').toUpperCase() === 'USD' ? 'USD' : 'CRC';
      const normMerch = normalizeMerchant(tx.merchant || tx.description);

      const duplicate = existingTxs.find(ex => {
        const sameAmt = Math.abs(Number(ex.amount) - cleanAmount) < 0.5;
        const sameCurr = (ex.currency || 'CRC').toUpperCase() === cleanCurrency;
        const closeDate = isSameOrCloseDate(ex.date, tx.date, 3);
        const exNorm = normalizeMerchant(ex.merchant || ex.note);
        const similarMerch =
          !normMerch || !exNorm || exNorm.includes(normMerch.slice(0, 6)) || normMerch.includes(exNorm.slice(0, 6));
        return sameAmt && sameCurr && closeDate && similarMerch;
      });

      const suggestedCategory = tx.category || (
        tx.type === 'pago_tarjeta'
          ? 'Pago de Tarjeta'
          : (tx.type === 'ingreso'
              ? financeCategorizer.categorizeIncome(tx.description || '', false)
              : financeCategorizer.categorizeExpense(tx.merchant || '', tx.description || ''))
      );

      return {
        tempId: `imp_${idx}_${Date.now()}`,
        date: tx.date || new Date().toISOString().slice(0, 10),
        merchant: tx.merchant || tx.description || 'Movimiento bancario',
        description: tx.description || tx.merchant || '',
        amount: cleanAmount,
        currency: cleanCurrency,
        type: tx.type === 'pago_tarjeta' ? 'pago_tarjeta' : (tx.type === 'ingreso' ? 'ingreso' : 'gasto'),
        category: suggestedCategory,
        alreadyRecorded: Boolean(duplicate),
        selected: !duplicate
      };
    });

    const fallbackAcc = parsed.documentType === 'credit_card_statement'
      ? (accounts.find(a => a.type === 'credito') || accounts.find(a => a.type === 'debito') || accounts[0])
      : (accounts.find(a => a.type === 'debito') || accounts[0]);

    return {
      documentType: parsed.documentType || 'credit_card_statement',
      bank: parsed.bank || 'Banco',
      cardLast4: parsed.cardLast4 || null,
      accountHint: parsed.accountHint || null,
      matchedAccountId: matchedAccount?.id || fallbackAcc?.id || '',
      statementInfo: parsed.statementInfo || {},
      transactions: enrichedTransactions,
      summary: {
        totalFound: enrichedTransactions.length,
        duplicatesSkipped: enrichedTransactions.filter(t => t.alreadyRecorded).length,
        readyToImport: enrichedTransactions.filter(t => !t.alreadyRecorded).length
      }
    };
  }

  async applyStatementImport({
    targetAccountId,
    sourceAccountId,
    documentType,
    statementInfo,
    transactions = []
  }) {
    const financeData = await financeService.getSummary();
    const accounts = financeData.accounts || [];
    const targetAcc = accounts.find(a => a.id === targetAccountId);
    const sourceAcc = sourceAccountId ? accounts.find(a => a.id === sourceAccountId) : null;

    let importedCount = 0;
    let skippedCount = 0;

    const isClosedCreditStatement = documentType === 'credit_card_statement';

    for (const item of transactions) {
      if (!item || item.selected === false || Number(item.amount) <= 0) {
        skippedCount++;
        continue;
      }

      const isoDate = item.date && String(item.date).length === 10
        ? `${item.date}T12:00:00.000Z`
        : (item.date || new Date().toISOString());

      if (item.type === 'pago_tarjeta' || documentType === 'payment_receipt') {
        // 1. Si hay cuenta origen (débito) y es comprobante real de pago, registrar salida de dinero
        if (sourceAcc && sourceAcc.id !== targetAccountId && !isClosedCreditStatement) {
          await financeService.addTransaction({
            accountId: sourceAcc.id,
            type: 'gasto',
            category: 'Pago de Tarjeta',
            merchant: targetAcc ? targetAcc.name : (item.merchant || 'Tarjeta de Crédito'),
            note: `Pago Tarjeta: ${item.description || item.merchant || 'Abono'}`,
            amount: item.amount,
            currency: item.currency || 'CRC',
            source: 'statement_import',
            date: isoDate
          });
        }
        // 2. Registrar abono en la tarjeta de crédito destino (sin mutar balance si es histórico de estado de cuenta)
        if (targetAcc) {
          await financeService.addTransaction({
            accountId: targetAcc.id,
            type: 'ingreso',
            category: 'Pago de Tarjeta',
            merchant: item.merchant || 'Abono a Tarjeta',
            note: `Abono recibido: ${item.description || item.merchant || 'Pago de tarjeta'}`,
            amount: item.amount,
            currency: item.currency || 'CRC',
            source: 'statement_import',
            skipBalanceMutation: isClosedCreditStatement,
            date: isoDate
          });
        }
        importedCount++;
      } else {
        await financeService.addTransaction({
          accountId: targetAccountId,
          type: item.type === 'ingreso' ? 'ingreso' : 'gasto',
          category: item.category || 'Varios',
          merchant: item.merchant || '',
          note: `${item.merchant || item.description || 'Movimiento'} (Estado de Cuenta)`,
          amount: item.amount,
          currency: item.currency || 'CRC',
          source: 'statement_import',
          skipBalanceMutation: isClosedCreditStatement,
          date: isoDate
        });
        importedCount++;
      }
    }

    // Actualizar parámetros del estado de cuenta en la tarjeta si existen
    if (targetAcc && targetAcc.type === 'credito' && statementInfo) {
      const updates = {};
      if (statementInfo.cutoffDate) {
        const day = Number(String(statementInfo.cutoffDate).split('-')[2]);
        if (day >= 1 && day <= 31) updates.cutoffDay = day;
      }
      if (statementInfo.dueDate) {
        const day = Number(String(statementInfo.dueDate).split('-')[2]);
        if (day >= 1 && day <= 31) updates.dueDay = day;
      }
      if (statementInfo.cashPaymentCRC != null) updates.cashPaymentCRC = Number(statementInfo.cashPaymentCRC);
      if (statementInfo.cashPaymentUSD != null) updates.cashPaymentUSD = Number(statementInfo.cashPaymentUSD);
      if (statementInfo.minPaymentCRC != null) updates.minPaymentCRC = Number(statementInfo.minPaymentCRC);
      if (statementInfo.minPaymentUSD != null) updates.minPaymentUSD = Number(statementInfo.minPaymentUSD);
      if (Object.keys(updates).length > 0) {
        await financeService.updateAccount(targetAcc.id, updates);
      }
    }

    return {
      success: true,
      importedCount,
      skippedCount
    };
  }
}

module.exports = new FinanceStatementService();

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const financeService = require('./financeService');
const { getSupabaseClient } = require('./supabaseClient');

const CONFIG_FILE = process.env.VERCEL
  ? path.join('/tmp', 'mail_config.json')
  : path.join(__dirname, '..', 'data', 'mail_config.json');

const LOGS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'mail_sync_logs.json')
  : path.join(__dirname, '..', 'data', 'mail_sync_logs.json');

const DEFAULT_CONFIG = {
  email: '',
  appPassword: '', // Google App Password (16 caracteres)
  host: 'imap.gmail.com',
  port: 993,
  enabled: false,
  autoRecord: true, // Si es true, contabiliza de una vez en la cuenta correcta
  lastSync: null,
  syncIntervalMinutes: 15
};

class BankMailService {
  constructor() {
    this.ensureFiles();
  }

  ensureFiles() {
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      }
      if (!fs.existsSync(LOGS_FILE)) {
        fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (_) {}
  }

  getConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          appPasswordMasked: parsed.appPassword ? '••••••••••••••••' : ''
        };
      }
    } catch (_) {}
    return DEFAULT_CONFIG;
  }

  saveConfig(newConfig) {
    const current = this.getConfig();
    const updated = {
      ...current,
      email: newConfig.email !== undefined ? newConfig.email.trim() : current.email,
      appPassword: newConfig.appPassword !== undefined && newConfig.appPassword !== '••••••••••••••••'
        ? newConfig.appPassword.replace(/\s+/g, '')
        : current.appPassword,
      enabled: newConfig.enabled !== undefined ? !!newConfig.enabled : current.enabled,
      autoRecord: newConfig.autoRecord !== undefined ? !!newConfig.autoRecord : current.autoRecord,
      syncIntervalMinutes: Number(newConfig.syncIntervalMinutes) || 15
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return this.getConfig();
  }

  getLogs() {
    try {
      if (fs.existsSync(LOGS_FILE)) {
        const raw = fs.readFileSync(LOGS_FILE, 'utf8');
        return JSON.parse(raw).slice(0, 50);
      }
    } catch (_) {}
    return [];
  }

  addLog(logItem) {
    try {
      let logs = [];
      if (fs.existsSync(LOGS_FILE)) {
        logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      }
      logs.unshift({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        ...logItem
      });
      fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Filtro de descarte estricto: descarta órdenes patronales CCSS, boletines, etc.
   */
  isDiscardable(subject = '', body = '') {
    const text = (subject + ' ' + body).toLowerCase();
    const discardKeywords = [
      'orden patronal',
      'caja costarricense de seguro social',
      'ccss - orden',
      'boletin informativo',
      'seguridad de google',
      'alerta de seguridad',
      'newsletter',
      'promocion especial de bienvenida',
      'actualizacion de terminos'
    ];
    return discardKeywords.some(kw => text.includes(kw));
  }

  /**
   * Extractor de Comprobantes Bancarios (BAC, Popular, Coopeande, BCR, PayPal, etc.)
   */
  parseBankNotification(emailData) {
    const subject = emailData.subject || '';
    const body = emailData.body || emailData.snippet || '';
    const fullText = subject + ' ' + body;

    // Verificar si se descarta
    if (this.isDiscardable(subject, body)) {
      return {
        matched: false,
        reason: 'Correo descartado por regla (no financiero / orden patronal / boletín)'
      };
    }

    // 1. Detectar Entidad
    let entity = 'Comercio / Banco';
    const lower = fullText.toLowerCase();
    if (lower.includes('bac') || lower.includes('credomatic')) entity = 'BAC Credomatic';
    else if (lower.includes('popular') || lower.includes('bancopopular')) entity = 'Banco Popular';
    else if (lower.includes('coopeande')) entity = 'Coopeande';
    else if (lower.includes('bcr') || lower.includes('banco de costa rica')) entity = 'Banco de Costa Rica';
    else if (lower.includes('davivienda')) entity = 'Davivienda';
    else if (lower.includes('scotiabank')) entity = 'Scotiabank';
    else if (lower.includes('paypal')) entity = 'PayPal';
    else if (lower.includes('factura electronica') || lower.includes('comprobante electronico')) entity = 'Factura Electrónica';

    // 2. Detectar Moneda y Monto
    // Soporta: ₡ 24,500.00 | CRC 15.000 | $ 120.50 | USD 45.00
    let currency = 'CRC';
    let amount = 0;

    const crcMatch = fullText.match(/(?:₡|CRC|COLONES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)/i);
    const usdMatch = fullText.match(/(?:\$|USD|DOLARES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)/i);

    if (usdMatch && (!crcMatch || fullText.indexOf(usdMatch[0]) < fullText.indexOf(crcMatch[0]))) {
      currency = 'USD';
      amount = parseFloat(usdMatch[1].replace(/,/g, ''));
    } else if (crcMatch) {
      currency = 'CRC';
      const cleanNum = crcMatch[1].replace(/\./g, '').replace(/,/g, '.');
      amount = parseFloat(cleanNum);
    }

    // 3. Detectar últimos 4 dígitos de tarjeta o cuenta
    // Ej: terminada en 4120, tarjeta *8841, cuenta ...5201
    let last4 = null;
    const last4Match = fullText.match(/(?:tarjeta|cuenta|terminada en|terminacion|card|\*|\.{2,})\s*(?:no\.?\s*)?([0-9]{4})\b/i);
    if (last4Match) {
      last4 = last4Match[1];
    }

    // 4. Detectar Tipo (Gasto vs Ingreso)
    let type = 'gasto';
    if (lower.includes('deposito') || lower.includes('transferencia recibida') || lower.includes('credito a su cuenta') || lower.includes('pago recibido') || lower.includes('sinpe movil recibido')) {
      type = 'ingreso';
    }

    // 5. Detectar Comercio o Concepto
    let merchant = entity;
    const merchantMatch = fullText.match(/(?:en|comercio|establecimiento|concepto|detalle):\s*([^.\n\r,]+)/i);
    if (merchantMatch && merchantMatch[1]) {
      merchant = merchantMatch[1].trim();
    }

    // Si no logramos monto válido, no se considera transacción contable
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        matched: false,
        reason: 'No se detectó un monto financiero ejecutable'
      };
    }

    return {
      matched: true,
      entity,
      amount,
      currency,
      type,
      last4,
      merchant,
      note: `${type === 'gasto' ? 'Compra' : 'Ingreso'}: ${merchant} (${entity})`,
      category: this.categorizeExpense(merchant),
      date: emailData.date || new Date().toISOString()
    };
  }

  categorizeExpense(merchant = '') {
    const text = merchant.toLowerCase();
    if (text.includes('gas') || text.includes('delta') || text.includes('uber') || text.includes('didi') || text.includes('peaje')) return 'Gasolina y Transporte';
    if (text.includes('auto mercado') || text.includes('automercado') || text.includes('walmart') || text.includes('masxmenos') || text.includes('kfc') || text.includes('mcdonald') || text.includes('restaurante')) return 'Alimentación y Reuniones';
    if (text.includes('ice') || text.includes('kolbi') || text.includes('claro') || text.includes('liberty') || text.includes('aya') || text.includes('cnfl') || text.includes('google') || text.includes('apple') || text.includes('netflix') || text.includes('spotify') || text.includes('aws')) return 'Servicios y Software';
    if (text.includes('farmacia') || text.includes('clinica') || text.includes('hospital') || text.includes('laboratorio')) return 'Equipamiento';
    return 'Varios';
  }

  /**
   * Sincronizar un correo entrante y contabilizarlo
   */
  async processIncomingEmail(emailData) {
    const parsed = this.parseBankNotification(emailData);
    if (!parsed.matched) {
      this.addLog({
        status: 'discarded',
        subject: emailData.subject,
        from: emailData.from,
        reason: parsed.reason
      });
      return { status: 'discarded', reason: parsed.reason };
    }

    const summary = await financeService.getSummary();
    const accounts = summary.accounts || [];

    // Buscar la cuenta que coincide con los últimos 4 dígitos
    let targetAccount = null;
    if (parsed.last4) {
      targetAccount = accounts.find(a => a.last4 === parsed.last4);
    }

    // Si no coincide por last4, buscar por entidad o usar la primera cuenta
    if (!targetAccount) {
      targetAccount = accounts.find(a => {
        const accEnt = (a.entity || a.name || '').toLowerCase();
        const parseEnt = (parsed.entity || '').toLowerCase();
        return accEnt.includes(parseEnt) || parseEnt.includes(accEnt);
      });
    }
    if (!targetAccount) {
      targetAccount = accounts[0];
    }

    const config = this.getConfig();

    if (config.autoRecord && targetAccount) {
      // Contabilizar de inmediato
      const tx = await financeService.addTransaction({
        accountId: targetAccount.id,
        type: parsed.type,
        category: parsed.category,
        note: parsed.note,
        merchant: parsed.merchant,
        amount: parsed.amount,
        currency: parsed.currency,
        source: 'gmail_auto',
        rawSnippet: emailData.subject
      });

      this.addLog({
        status: 'recorded',
        subject: emailData.subject,
        amount: parsed.amount,
        currency: parsed.currency,
        accountName: targetAccount.name,
        accountId: targetAccount.id,
        last4: parsed.last4,
        type: parsed.type,
        txId: tx.id
      });

      return {
        status: 'recorded',
        transaction: tx,
        account: targetAccount
      };
    } else {
      // Registrar en log como pendiente de confirmación
      this.addLog({
        status: 'pending_confirmation',
        subject: emailData.subject,
        parsed,
        suggestedAccount: targetAccount ? targetAccount.name : 'No asignada'
      });

      return {
        status: 'pending_confirmation',
        parsed,
        targetAccount
      };
    }
  }

  /**
   * Probar conexión con Google IMAP
   */
  async testConnection(email, appPassword) {
    return new Promise((resolve) => {
      const cleanEmail = (email || '').trim();
      const cleanPass = (appPassword || '').replace(/\s+/g, '');

      if (!cleanEmail || !cleanPass) {
        return resolve({ success: false, error: 'Debe ingresar el correo y la Contraseña de Aplicación de 16 caracteres de Google.' });
      }

      const socket = tls.connect(993, 'imap.gmail.com', { rejectUnauthorized: true }, () => {
        let step = 0;
        let authSuccess = false;

        socket.on('data', (data) => {
          const str = data.toString();
          if (step === 0 && str.includes('* OK')) {
            step = 1;
            socket.write(`a001 LOGIN "${cleanEmail}" "${cleanPass}"\r\n`);
          } else if (step === 1) {
            if (str.includes('a001 OK')) {
              authSuccess = true;
              socket.write('a002 LOGOUT\r\n');
            } else if (str.includes('a001 NO') || str.includes('a001 BAD')) {
              socket.end();
              resolve({
                success: false,
                error: 'Credenciales inválidas. Asegúrese de usar una Contraseña de Aplicación generada en myaccount.google.com/apppasswords'
              });
            }
          }
        });

        socket.on('end', () => {
          if (authSuccess) {
            resolve({ success: true, message: '¡Conexión exitosa con el buzón de Gmail de forma 100% permanente!' });
          }
        });
      });

      socket.setTimeout(8000, () => {
        socket.destroy();
        resolve({ success: false, error: 'Tiempo de espera agotado al conectar con imap.gmail.com' });
      });

      socket.on('error', (err) => {
        resolve({ success: false, error: `Error de conexión: ${err.message}` });
      });
    });
  }
}

module.exports = new BankMailService();

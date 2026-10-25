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
  syncStartDate: '2026-10-25', // Ignorar correos anteriores a esta fecha
  lastSync: null,
  syncIntervalMinutes: 15
};

function decodeQuotedPrintable(str) {
  if (!str) return '';
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch (_) {
        return _;
      }
    });
}

function decodeMimeWords(str) {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf8');
      } else if (encoding.toUpperCase() === 'Q') {
        return text
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (__, hex) => String.fromCharCode(parseInt(hex, 16)));
      }
    } catch (_) {}
    return text;
  });
}

class BankMailService {
  constructor() {
    this.ensureFiles();
    this.startBackgroundPoller();
  }

  startBackgroundPoller() {
    // Sincronización automática periódica cada 15 minutos en background
    const timer = setInterval(async () => {
      try {
        const config = this.getConfig();
        if (config.enabled && config.email && config.appPassword) {
          await this.syncInbox();
        }
      } catch (_) {}
    }, 15 * 60 * 1000);
    if (timer && timer.unref) timer.unref();
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
      syncStartDate: newConfig.syncStartDate !== undefined ? newConfig.syncStartDate : current.syncStartDate,
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
   * Extractor de Comprobantes Bancarios (BAC, Popular, Coopeande, BCR, SINPE, etc.)
   */
  parseBankNotification(emailData) {
    const rawSubject = decodeMimeWords(emailData.subject || '');
    const rawBody = decodeQuotedPrintable(emailData.body || emailData.snippet || '');
    const fullText = rawSubject + ' ' + rawBody;

    // Verificar si se descarta
    if (this.isDiscardable(rawSubject, rawBody)) {
      return {
        matched: false,
        reason: 'Correo descartado por regla (no financiero / orden patronal / boletín)'
      };
    }

    // 1. Detectar Entidad
    let entity = 'Comercio / Banco';
    const lower = fullText.toLowerCase();
    if (lower.includes('bac') || lower.includes('credomatic')) entity = 'BAC Credomatic';
    else if (lower.includes('wink') || lower.includes('holawink')) entity = 'Wink';
    else if (lower.includes('popular') || lower.includes('bancopopular')) entity = 'Banco Popular';
    else if (lower.includes('coopeande')) entity = 'Coopeande';
    else if (lower.includes('bcr') || lower.includes('banco de costa rica')) entity = 'Banco de Costa Rica';
    else if (lower.includes('davivienda')) entity = 'Davivienda';
    else if (lower.includes('scotiabank')) entity = 'Scotiabank';
    else if (lower.includes('paypal')) entity = 'PayPal';

    let amount = 0;
    let currency = 'CRC';
    let last4 = null;
    let merchant = entity;
    let type = 'gasto';
    let date = emailData.date || new Date().toISOString();

    // ----------------------------------------------------------------
    // PARSER ESPECÍFICO BAC CREDOMATIC (Estructura de tablas HTML)
    // ----------------------------------------------------------------
    if (entity === 'BAC Credomatic') {
      // Comercio en BAC
      const merchMatch = rawBody.match(/Comercio:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      if (merchMatch) merchant = merchMatch[1].trim();

      // Tarjeta o Cuenta en BAC (ej: VISA: ************0095 o Cuenta: *******1234)
      const cardMatch = rawBody.match(/(?:VISA|MasterCard|AMEX|Cuenta|Tarjeta)[^<]*<\/td>\s*<td[^>]*>[*xX\s]*([0-9]{4})<\/td>/i)
        || rawBody.match(/\*{4,}([0-9]{4})/);
      if (cardMatch) last4 = cardMatch[1];

      // Monto en BAC (ej: CRC 2,492.00 o USD 15.00)
      const montoMatch = rawBody.match(/Monto:<\/td>\s*<td[^>]*>(?:([A-Z]{3}|₡|\$)\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)<\/td>/i);
      if (montoMatch) {
        const currSym = (montoMatch[1] || '').toUpperCase();
        currency = currSym.includes('$') || currSym.includes('USD') ? 'USD' : 'CRC';
        const numStr = montoMatch[2].replace(/,/g, '');
        amount = parseFloat(numStr);
      }

      // Tipo en BAC
      const tipoMatch = rawBody.match(/Tipo de Transacci[oó]n:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      if (tipoMatch) {
        const tStr = tipoMatch[1].toLowerCase();
        if (tStr.includes('deposito') || tStr.includes('transferencia recibida') || tStr.includes('credito') || tStr.includes('pago recibido')) {
          type = 'ingreso';
        }
      }

      // Fecha en BAC (ej: Oct 24, 2026, 17:24)
      const fechaMatch = rawBody.match(/Fecha:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      if (fechaMatch) {
        const parsedD = new Date(fechaMatch[1].trim());
        if (!isNaN(parsedD.getTime())) date = parsedD.toISOString();
      }
    }

    // ----------------------------------------------------------------
    // PARSER GENERAL / BANCO POPULAR / COOPEANDE / SINPE
    // ----------------------------------------------------------------
    if (!amount) {
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
    }

    if (!last4) {
      const last4Match = fullText.match(/(?:tarjeta|cuenta|terminada en|terminacion|card|\*|\.{2,})\s*(?:no\.?\s*)?([0-9]{4})\b/i);
      if (last4Match) last4 = last4Match[1];
    }

    // 5. Detectar Comercio, Motivo o Concepto (ej: SINPE "Diezmo", "Alquiler", etc.)
    const motiveMatch = fullText.match(/(?:motivo|detalle|concepto|mensaje|descripci[oó]n|comercio|establecimiento|en):\s*([^.\n\r,<]+)/i);
    if (motiveMatch && motiveMatch[1]) {
      merchant = motiveMatch[1].trim();
    }

    if (lower.includes('deposito') || lower.includes('transferencia recibida') || lower.includes('credito a su cuenta') || lower.includes('pago recibido') || lower.includes('sinpe movil recibido')) {
      type = 'ingreso';
    }

    // Si no logramos monto válido, no se considera transacción contable
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        matched: false,
        reason: 'No se detectó un monto financiero ejecutable'
      };
    }

    const isSinpe = lower.includes('sinpe');
    const notePrefix = isSinpe ? (type === 'gasto' ? 'SINPE Móvil' : 'SINPE Recibido') : (type === 'gasto' ? 'Compra' : 'Ingreso');

    return {
      matched: true,
      entity,
      amount,
      currency,
      type,
      last4,
      merchant,
      note: `${notePrefix}: ${merchant} (${entity})`,
      category: this.categorizeExpense(merchant, fullText),
      date
    };
  }

  categorizeExpense(merchant = '', fullText = '') {
    const text = (merchant + ' ' + fullText).toLowerCase();
    if (text.includes('diezmo') || text.includes('ofrenda') || text.includes('iglesia') || text.includes('donaci')) return 'Donaciones y Diezmos';
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

    const config = this.getConfig();

    // Si hay fecha de inicio configurada (ej: a partir de 2026-10-25), descartar anteriores
    if (config.syncStartDate && parsed.date) {
      const emailDate = parsed.date.slice(0, 10);
      if (emailDate < config.syncStartDate) {
        this.addLog({
          status: 'discarded',
          subject: emailData.subject,
          from: emailData.from,
          reason: `Descartado: correo anterior a la fecha de inicio contable (${config.syncStartDate})`
        });
        return { status: 'discarded', reason: `Anterior a ${config.syncStartDate}` };
      }
    }

    const summary = await financeService.getSummary();
    const accounts = summary.accounts || [];

    // Buscar la cuenta que coincide con los últimos 4 dígitos (priorizando coincidencia de moneda USD vs CRC)
    let targetAccount = null;
    if (parsed.last4) {
      const matchingLast4 = accounts.filter(a => a.last4 === parsed.last4);
      if (matchingLast4.length > 1) {
        targetAccount = matchingLast4.find(a => (a.currency || 'CRC') === (parsed.currency || 'CRC')) || matchingLast4[0];
      } else if (matchingLast4.length === 1) {
        targetAccount = matchingLast4[0];
      }
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
      let resolved = false;
      let socket = null;
      const done = (result) => {
        if (!resolved) {
          resolved = true;
          if (socket) {
            try {
              socket.removeAllListeners('data');
              socket.removeAllListeners('end');
              socket.on('error', () => {});
              socket.destroy();
            } catch (_) {}
          }
          resolve(result);
        }
      };

      const cfg = this.getConfig();
      const cleanEmail = (email || cfg.email || '').trim();
      const cleanPass = (appPassword && appPassword !== '••••••••••••••••' ? appPassword : cfg.appPassword || '').replace(/\s+/g, '');

      if (!cleanEmail || !cleanPass) {
        return done({ success: false, error: 'Debe ingresar el correo y la Contraseña de Aplicación de 16 caracteres de Google.' });
      }

      try {
        socket = tls.connect({
          host: 'imap.gmail.com',
          port: 993,
          servername: 'imap.gmail.com',
          rejectUnauthorized: false
        });

        socket.on('error', (err) => {
          done({ success: false, error: `Error de conexión: ${err.message}` });
        });

        socket.setTimeout(8000, () => {
          done({ success: false, error: 'Tiempo de espera agotado al conectar con imap.gmail.com' });
        });

        socket.on('end', () => {
          done({ success: false, error: 'La conexión fue cerrada por el servidor de Google.' });
        });

        socket.on('secureConnect', () => {
          let step = 0;

          socket.on('data', (data) => {
            const str = data.toString();
            if (step === 0 && str.includes('* OK')) {
              step = 1;
              socket.write(`a001 LOGIN "${cleanEmail}" "${cleanPass}"\r\n`);
            } else if (step === 1) {
              if (str.includes('a001 OK')) {
                try { socket.write('a002 LOGOUT\r\n'); } catch (_) {}
                done({ success: true, message: '¡Conexión exitosa con el buzón de Gmail de forma 100% permanente!' });
              } else if (str.includes('a001 NO') || str.includes('a001 BAD')) {
                done({
                  success: false,
                  error: 'Credenciales inválidas. Con Doble Factor activado en Google, debe usar la Contraseña de Aplicación de 16 letras generada en myaccount.google.com/apppasswords (no su contraseña normal).'
                });
              }
            }
          });
        });
      } catch (err) {
        done({ success: false, error: `Error de inicialización TLS: ${err.message}` });
      }
    });
  }

  /**
   * Sincronización real de correos bancarios vía IMAP SSL
   */
  async syncInbox() {
    const config = this.getConfig();
    if (!config.email || !config.appPassword) {
      return { success: false, error: 'Debe configurar y guardar su correo y Contraseña de Aplicación de Google primero.' };
    }

    return new Promise((resolve) => {
      let resolved = false;
      let socket = null;
      let processedCount = 0;
      let recordedCount = 0;

      const done = (res) => {
        if (!resolved) {
          resolved = true;
          if (socket) {
            try {
              socket.removeAllListeners('data');
              socket.removeAllListeners('end');
              socket.on('error', () => {});
              socket.destroy();
            } catch (_) {}
          }
          resolve(res);
        }
      };

      const cleanEmail = config.email.trim();
      const cleanPass = config.appPassword.replace(/\s+/g, '');

      try {
        socket = tls.connect({
          host: 'imap.gmail.com',
          port: 993,
          servername: 'imap.gmail.com',
          rejectUnauthorized: false
        });

        socket.on('error', (err) => {
          done({ success: false, error: `Error IMAP: ${err.message}` });
        });

        socket.setTimeout(25000, () => {
          done({ success: false, error: 'Tiempo de espera agotado durante la sincronización.' });
        });

        socket.on('end', () => {
          if (!resolved) {
            done({ success: true, processed: processedCount, recorded: recordedCount, message: 'Sincronización finalizada.' });
          }
        });

        socket.on('secureConnect', () => {
          let buffer = '';
          let step = 'WAIT_GREETING';
          let msgIds = [];
          let currentIndex = 0;

          const sendCmd = (tag, cmd) => {
            try { socket.write(`${tag} ${cmd}\r\n`); } catch (_) {}
          };

          socket.on('data', async (chunk) => {
            buffer += chunk.toString();

            if (step === 'WAIT_GREETING' && buffer.includes('* OK')) {
              buffer = '';
              step = 'WAIT_LOGIN';
              sendCmd('a001', `LOGIN "${cleanEmail}" "${cleanPass}"`);
            } else if (step === 'WAIT_LOGIN') {
              if (buffer.includes('a001 OK')) {
                buffer = '';
                step = 'WAIT_SELECT';
                sendCmd('a002', 'SELECT INBOX');
              } else if (buffer.includes('a001 NO') || buffer.includes('a001 BAD')) {
                done({ success: false, error: 'Credenciales inválidas de Gmail. Verifique la Contraseña de Aplicación.' });
              }
            } else if (step === 'WAIT_SELECT') {
              if (buffer.includes('a002 OK')) {
                buffer = '';
                step = 'WAIT_SEARCH';
                sendCmd('a003', 'SEARCH ALL');
              }
            } else if (step === 'WAIT_SEARCH') {
              if (buffer.includes('a003 OK')) {
                const searchMatch = buffer.match(/\* SEARCH ([\d\s]+)/);
                if (searchMatch && searchMatch[1].trim()) {
                  const allIds = searchMatch[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
                  msgIds = allIds.slice(-20).reverse();
                }
                buffer = '';
                if (msgIds.length === 0) {
                  sendCmd('a999', 'LOGOUT');
                  step = 'DONE';
                  done({ success: true, processed: 0, recorded: 0, message: 'Buzón sincronizado. No hay mensajes en la bandeja de entrada.' });
                  return;
                }
                step = 'FETCHING';
                fetchNext();
              }
            } else if (step === 'FETCHING') {
              const tag = `f${currentIndex}`;
              if (buffer.includes(`${tag} OK`)) {
                const currentChunk = buffer;
                buffer = '';

                const subjectMatch = currentChunk.match(/Subject:\s*([^\r\n]+)/i);
                const fromMatch = currentChunk.match(/From:\s*([^\r\n]+)/i);
                const dateMatch = currentChunk.match(/Date:\s*([^\r\n]+)/i);

                const subject = subjectMatch ? subjectMatch[1].trim() : '';
                const from = fromMatch ? fromMatch[1].trim() : '';
                const date = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : new Date().toISOString();

                try {
                  const res = await this.processIncomingEmail({
                    subject,
                    from,
                    date,
                    body: currentChunk
                  });
                  processedCount++;
                  if (res.status === 'recorded') recordedCount++;
                } catch (_) {}

                currentIndex++;
                fetchNext();
              }
            } else if (step === 'DONE') {
              done({
                success: true,
                processed: processedCount,
                recorded: recordedCount,
                message: `Sincronización completada: ${processedCount} correos analizados, ${recordedCount} comprobantes contabilizados.`
              });
            }
          });

          const fetchNext = () => {
            if (currentIndex < msgIds.length) {
              const id = msgIds[currentIndex];
              const tag = `f${currentIndex}`;
              sendCmd(tag, `FETCH ${id} (BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)] BODY.PEEK[TEXT]<0.14000>)`);
            } else {
              step = 'DONE';
              this.saveConfig({ ...config, lastSync: new Date().toISOString() });
              sendCmd('a999', 'LOGOUT');
              setTimeout(() => {
                done({
                  success: true,
                  processed: processedCount,
                  recorded: recordedCount,
                  message: `Sincronización completada: ${processedCount} correos analizados, ${recordedCount} comprobantes contabilizados.`
                });
              }, 600);
            }
          };
        });
      } catch (err) {
        done({ success: false, error: `Error de inicialización TLS: ${err.message}` });
      }
    });
  }
}

module.exports = new BankMailService();

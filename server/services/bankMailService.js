const fs = require('fs');
const path = require('path');
const tls = require('tls');
const crypto = require('crypto');
const financeService = require('./financeService');
const financeCategorizer = require('./financeCategorizer');
const financeStatementService = require('./financeStatementService');
const { getSupabaseClient } = require('./supabaseClient');

function extractAttachmentsFromRawMime(rawMime = '') {
  const attachments = [];
  if (!rawMime) return attachments;

  // Buscar bloques MIME con Content-Transfer-Encoding: base64 y PDF/Imagen
  const partRegex = /Content-Type:\s*(application\/pdf|image\/(?:png|jpeg|jpg|webp))[^\r\n]*(?:;[^\r\n]*)*[\s\S]*?Content-Transfer-Encoding:\s*base64[\r\n]+([\s\S]*?)(?=\r?\n--[A-Za-z0-9'()+_,\-./:=? ]+|\r?\n\)\r?\n|$)/gi;
  let match;
  while ((match = partRegex.exec(rawMime)) !== null) {
    const rawMimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const headerBlock = match[0].slice(0, match[0].indexOf('base64'));
    const nameMatch = headerBlock.match(/(?:filename|name)\s*=\s*"?([^"\r\n;]+)"?/i);
    const fileName = nameMatch ? nameMatch[1].trim() : (rawMimeType === 'application/pdf' ? 'comprobante.pdf' : 'comprobante.png');
    const cleanB64 = match[2].replace(/[^A-Za-z0-9+/=]/g, '');
    if (cleanB64.length > 200) {
      attachments.push({
        mimeType: rawMimeType,
        fileName,
        fileBase64: cleanB64
      });
    }
  }
  return attachments;
}

function getEncryptionKey() {
  const seed =
    process.env.MAIL_CONFIG_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GEMINI_API_KEY ||
    'proactur-local-fallback-key';
  return crypto.createHash('sha256').update(String(seed)).digest();
}

function encryptSecret(plainText) {
  if (!plainText) return '';
  if (String(plainText).startsWith('enc:v1:')) return String(plainText);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(value) {
  if (!value) return '';
  const str = String(value);
  if (!str.startsWith('enc:v1:')) return str; // Compatibilidad con configuraciones previas en texto plano
  try {
    const parts = str.split(':');
    if (parts.length !== 5) return '';
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (_) {
    return '';
  }
}

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

function parseCurrencyAmount(rawStr) {
  if (!rawStr) return 0;
  let str = String(rawStr).trim();
  // Si contiene comas y puntos
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      // Formato financiero costarricense/BAC/Popular: 2,000.50
      str = str.replace(/,/g, '');
    } else {
      // Formato europeo: 2.000,50
      str = str.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts[1] && parts[1].length === 2) {
      str = str.replace(/,/g, '.'); // 550,50 -> 550.50
    } else {
      str = str.replace(/,/g, ''); // 2,000 -> 2000
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts[1] && parts[1].length === 3) {
      str = str.replace(/\./g, ''); // 2.000 -> 2000
    }
  }
  return parseFloat(str) || 0;
}

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

function decodeEmailBody(raw) {
  if (!raw) return '';
  let text = raw;

  // Decodificar bloques base64 si existen (común en notificaciones de Banco Popular y otros)
  const b64Regex = /Content-Transfer-Encoding:\s*base64[\r\n]+([\s\S]*?)(?:--[^\r\n]+|$)/gi;
  text = text.replace(b64Regex, (match, b64Data) => {
    try {
      const cleanB64 = b64Data.replace(/[\r\n\s]/g, '');
      const decoded = Buffer.from(cleanB64, 'base64').toString('utf8');
      return decoded;
    } catch (_) {
      return match;
    }
  });

  // Decodificar quoted-printable
  text = decodeQuotedPrintable(text);

  return text;
}

function decodeMimeWords(str) {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf8');
      } else if (encoding.toUpperCase() === 'Q') {
        const bytes = [];
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === '_') {
            bytes.push(0x20);
          } else if (ch === '=' && i + 2 < text.length && /^[0-9A-Fa-f]{2}$/.test(text.substr(i + 1, 2))) {
            bytes.push(parseInt(text.substr(i + 1, 2), 16));
            i += 2;
          } else {
            bytes.push(ch.charCodeAt(0));
          }
        }
        return Buffer.from(bytes).toString((charset || 'utf8').toLowerCase().includes('utf-8') ? 'utf8' : 'latin1');
      }
    } catch (_) {}
    return text;
  });
}

class BankMailService {
  constructor() {
    this.isSyncing = false;
    this.ensureFiles();
    this.syncFromCloud().catch(() => {});
    this.startBackgroundPoller();
  }

  async syncFromCloud() {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      let cloudConfig = null;
      const { data: settingRow, error: settingErr } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'bank_mail_config')
        .single();

      if (!settingErr && settingRow && settingRow.value) {
        cloudConfig = typeof settingRow.value === 'string' ? JSON.parse(settingRow.value) : settingRow.value;
      } else if (settingErr && (settingErr.code === 'PGRST205' || String(settingErr.message || '').includes('app_settings'))) {
        // Fallback temporal mientras no exista la tabla app_settings en Supabase
        const { data, error } = await supabase
          .from('meetings')
          .select('transcript')
          .eq('id', '__sys_mail_config__')
          .single();
        if (!error && data && data.transcript) {
          cloudConfig = JSON.parse(data.transcript);
        }
      }

      if (cloudConfig && cloudConfig.email) {
        const current = this.getConfig();
        const decryptedCloudPwd = decryptSecret(cloudConfig.appPassword || '');
        const merged = {
          ...current,
          ...cloudConfig,
          appPassword: encryptSecret(decryptedCloudPwd || current.appPassword || '')
        };
        try {
          const dir = path.dirname(CONFIG_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
        } catch (_) {}
      }

      // Sincronizar logs de conciliación desde app_settings si existen
      const { data: logsRow, error: logsErr } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'bank_mail_logs')
        .single();
      if (!logsErr && logsRow && Array.isArray(logsRow.value)) {
        try {
          const dir = path.dirname(LOGS_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(LOGS_FILE, JSON.stringify(logsRow.value.slice(0, 50), null, 2), 'utf8');
        } catch (_) {}
      }
    } catch (_) {}
  }

  async saveConfigToCloud(cfg) {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const encryptedPayload = {
        ...cfg,
        appPassword: encryptSecret(cfg.appPassword || '')
      };
      delete encryptedPayload.appPasswordMasked;
      delete encryptedPayload.hasAppPassword;

      const { error } = await supabase.from('app_settings').upsert({
        key: 'bank_mail_config',
        value: encryptedPayload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      if (error && (error.code === 'PGRST205' || String(error.message || '').includes('app_settings'))) {
        await supabase.from('meetings').upsert({
          id: '__sys_mail_config__',
          title: '[SYSTEM] Bank Mail Configuration',
          summary: 'Encrypted cloud persistence for Gmail sync credentials',
          transcript: JSON.stringify(encryptedPayload),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }
    } catch (_) {}
  }

  async saveLogsToCloud(logs) {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      await supabase.from('app_settings').upsert({
        key: 'bank_mail_logs',
        value: logs.slice(0, 50),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (_) {}
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
        const decryptedPassword = decryptSecret(parsed.appPassword || '');
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          appPassword: decryptedPassword,
          hasAppPassword: Boolean(decryptedPassword),
          appPasswordMasked: decryptedPassword ? '••••••••••••••••' : ''
        };
      }
    } catch (_) {}
    return { ...DEFAULT_CONFIG, hasAppPassword: false, appPasswordMasked: '' };
  }

  getPublicConfig() {
    const cfg = this.getConfig();
    return {
      ...cfg,
      appPassword: '',
      hasAppPassword: Boolean(cfg.appPassword),
      appPasswordMasked: cfg.appPassword ? '••••••••••••••••' : ''
    };
  }

  async saveConfig(newConfig) {
    const current = this.getConfig();
    const plainPassword =
      newConfig.appPassword !== undefined && newConfig.appPassword !== '••••••••••••••••'
        ? newConfig.appPassword.replace(/\s+/g, '')
        : current.appPassword;

    const updated = {
      ...current,
      email: newConfig.email !== undefined ? newConfig.email.trim() : current.email,
      appPassword: plainPassword,
      enabled: newConfig.enabled !== undefined ? !!newConfig.enabled : current.enabled,
      autoRecord: newConfig.autoRecord !== undefined ? !!newConfig.autoRecord : current.autoRecord,
      syncStartDate: newConfig.syncStartDate !== undefined ? newConfig.syncStartDate : current.syncStartDate,
      syncIntervalMinutes: Number(newConfig.syncIntervalMinutes) || 15
    };

    const diskPayload = {
      ...updated,
      appPassword: encryptSecret(plainPassword)
    };
    delete diskPayload.appPasswordMasked;
    delete diskPayload.hasAppPassword;

    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(diskPayload, null, 2), 'utf8');
    await this.saveConfigToCloud(updated);
    return this.getPublicConfig();
  }

  getLogs() {
    try {
      if (fs.existsSync(LOGS_FILE)) {
        const raw = fs.readFileSync(LOGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed
          .filter(log => log.status === 'recorded' || log.status === 'pending_confirmation')
          .map(log => ({
            ...log,
            subject: decodeMimeWords(log.subject || '')
          }))
          .slice(0, 50);
      }
    } catch (_) {}
    return [];
  }

  addLog(logItem) {
    // Solo registrar comprobantes válidos (jamás correos descartados o spam)
    if (logItem.status !== 'recorded' && logItem.status !== 'pending_confirmation') {
      return;
    }
    try {
      let logs = [];
      if (fs.existsSync(LOGS_FILE)) {
        logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      }
      const cleanSubject = decodeMimeWords(logItem.subject || '');
      const cleanFrom = decodeMimeWords(logItem.from || '');

      // Evitar registrar entradas duplicadas en el log
      const alreadyInLog = logs.some(l => 
        (logItem.txId && l.txId === logItem.txId) ||
        (l.amount === logItem.amount && l.currency === logItem.currency && l.accountName === logItem.accountName && (l.subject === cleanSubject || (l.last4 && l.last4 === logItem.last4)))
      );
      if (alreadyInLog) {
        return;
      }

      logs.unshift({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        ...logItem,
        subject: cleanSubject,
        from: cleanFrom
      });
      const validLogs = logs.filter(l => l.status === 'recorded' || l.status === 'pending_confirmation').slice(0, 50);
      const dir = path.dirname(LOGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOGS_FILE, JSON.stringify(validLogs, null, 2), 'utf8');
      this.saveLogsToCloud(validLogs);
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
   * Extractor de Comprobantes Bancarios (BAC, Banco Popular, Wink, Coopeande, BCR, SINPE, etc.)
   */
  parseBankNotification(emailData) {
    const from = (emailData.from || '').toLowerCase();
    const rawSubject = decodeMimeWords(emailData.subject || '');
    const rawBody = decodeEmailBody(emailData.body || emailData.snippet || '');

    // Limpiar etiquetas HTML y entidades para un escaneo de texto puro sin interferencias
    const cleanBodyText = rawBody
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&eacute;/gi, 'é')
      .replace(/&iacute;/gi, 'í')
      .replace(/&aacute;/gi, 'á')
      .replace(/&ntilde;/gi, 'ñ')
      .replace(/\s+/g, ' ');

    const fullText = (from + ' ' + rawSubject + ' ' + cleanBodyText);

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
    if (lower.includes('bac') || lower.includes('credomatic') || from.includes('baccredomatic')) entity = 'BAC Credomatic';
    else if (lower.includes('popular') || lower.includes('bancopopular') || from.includes('bancopopular') || from.includes('bp.fi.cr') || lower.includes('bp.fi.cr')) entity = 'Banco Popular';
    else if (lower.includes('wink') || lower.includes('holawink') || from.includes('holawink')) entity = 'Wink';
    else if (lower.includes('coopeande') || from.includes('coopeande')) entity = 'Coopeande';
    else if (lower.includes('coopenae') || from.includes('coopenae')) entity = 'Coopenae';
    else if (lower.includes('bcr') || lower.includes('banco de costa rica') || from.includes('bancobcr')) entity = 'Banco de Costa Rica';
    else if (lower.includes('davivienda')) entity = 'Davivienda';
    else if (lower.includes('scotiabank')) entity = 'Scotiabank';
    else if (lower.includes('paypal')) entity = 'PayPal';
    else if (from.includes('sonivision') || lower.includes('sonivision')) entity = 'Sonivision';

    let amount = 0;
    let currency = 'CRC';
    let last4 = null;
    let merchant = entity;
    let type = 'gasto';
    let date = emailData.date || new Date().toISOString();

    // ----------------------------------------------------------------
    // PARSER ESPECÍFICO BANCO POPULAR (Comprobante de Compra / Depósito)
    // ----------------------------------------------------------------
    if (entity === 'Banco Popular') {
      // Comercio en Banco Popular
      const merchMatch = fullText.match(/Comercio:\s*([^.\r\n,]+(?:\s+[^.\r\n,]+)*?)(?:\s+(?:SAN JOSE|HEREDIA|ALAJUELA|CARTAGO|CR|PUNTARENAS|GUANACASTE|LIMON)\b|\s*Ciudad\b)/i);
      if (merchMatch) {
        merchant = merchMatch[1].replace(/SAN JOSE|CR/gi, '').trim();
      } else {
        const altMerch = fullText.match(/Comercio:\s*([^<\r\n]+)/i);
        if (altMerch) merchant = altMerch[1].trim();
      }
      merchant = merchant.replace(/Ciudad\s+y\s+pa[ií]s.*$/i, '').trim();

      // Tarjeta o Cuenta (ej: Visa: ************5330)
      const cardMatch = fullText.match(/(?:Visa|MasterCard|Tarjeta|Cuenta)[^0-9]*([0-9]{4})\b/i);
      if (cardMatch) last4 = cardMatch[1];

      // Monto (ej: Monto: CRC 2,000.00 o Monto: CRC 550.00)
      const montoMatch = fullText.match(/Monto:\s*(?:([A-Z]{3}|₡|\$)\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)/i);
      if (montoMatch) {
        const currSym = (montoMatch[1] || '').toUpperCase();
        currency = currSym.includes('$') || currSym.includes('USD') ? 'USD' : 'CRC';
        amount = parseCurrencyAmount(montoMatch[2]);
      }

      // Tipo de Transacción
      const tipoMatch = fullText.match(/Tipo de Transacci[oó]n:\s*([^<\r\n&]+)/i);
      if (tipoMatch) {
        const tStr = tipoMatch[1].toLowerCase();
        if (tStr.includes('deposito') || tStr.includes('credito') || tStr.includes('transferencia recibida') || tStr.includes('pago recibido')) {
          type = 'ingreso';
        } else {
          type = 'gasto';
        }
      }

      // Fecha
      const fechaMatch = fullText.match(/Fecha:\s*([A-Za-z]{3}\.?\s*[0-9]{1,2},?\s*[0-9]{4},?\s*[0-9]{1,2}:[0-9]{2})/i);
      if (fechaMatch) {
        const parsedD = new Date(fechaMatch[1].replace('Oct.', 'Oct').trim());
        if (!isNaN(parsedD.getTime())) date = parsedD.toISOString();
      }
    }

    // ----------------------------------------------------------------
    // PARSER ESPECÍFICO BAC CREDOMATIC (Tablas HTML y SINPE Móvil)
    // ----------------------------------------------------------------
    if (entity === 'BAC Credomatic') {
      // Comercio en BAC
      const merchMatch = rawBody.match(/Comercio:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i)
        || fullText.match(/Comercio:\s*([^<\r\n]+)/i);
      if (merchMatch) merchant = merchMatch[1].trim();

      // Si es transferencia SINPE de BAC: ej "Hola: ZUNIFY PAYMENTS : BAC le comunica..."
      const sinpeMerch = fullText.match(/Hola:\s*([^:]+)\s*:\s*BAC le comunica/i);
      if (sinpeMerch) {
        merchant = sinpeMerch[1].trim();
      }

      // Tarjeta o Cuenta en BAC (ej: VISA: ************0095 o Cuenta: *******1234 o IBAN CR2501XXXXXXXXXXXX3134)
      const cardMatch = rawBody.match(/(?:VISA|MasterCard|AMEX|Cuenta|Tarjeta)[^<]*<\/td>\s*<td[^>]*>[*xX\s]*([0-9]{4})<\/td>/i)
        || rawBody.match(/\*{4,}([0-9]{4})/)
        || fullText.match(/(?:CR[0-9]{2}[0-9A-Z*xX]+|cuenta|tarjeta|IBAN)[^0-9]*([0-9]{4})\b/i);
      if (cardMatch) last4 = cardMatch[1];

      // Monto en BAC (ej: CRC 2,492.00 o USD 15.00 o "monto de 20,000.00 Colones")
      const montoMatch = rawBody.match(/Monto:<\/td>\s*<td[^>]*>(?:([A-Z]{3}|₡|\$)\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)<\/td>/i)
        || fullText.match(/(?:monto de|monto:)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)\s*(?:([A-Z]{3}|₡|\$|Colones|D[oó]lares))/i);
      if (montoMatch) {
        const valStr = montoMatch[1] && isNaN(Number(montoMatch[1])) ? montoMatch[2] : montoMatch[1];
        amount = parseCurrencyAmount(valStr);
        const currText = ((montoMatch[1] || '') + ' ' + (montoMatch[2] || '')).toLowerCase();
        if (currText.includes('$') || currText.includes('usd') || currText.includes('dolar')) {
          currency = 'USD';
        } else {
          currency = 'CRC';
        }
      }

      // Tipo en BAC
      const tipoMatch = rawBody.match(/Tipo de Transacci[oó]n:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      if (tipoMatch) {
        const tStr = tipoMatch[1].toLowerCase();
        if (tStr.includes('deposito') || tStr.includes('transferencia recibida') || tStr.includes('credito') || tStr.includes('pago recibido')) {
          type = 'ingreso';
        }
      } else if (lower.includes('debitando su cuenta')) {
        type = 'gasto';
      } else if (lower.includes('acreditando su cuenta') || lower.includes('deposito')) {
        type = 'ingreso';
      }

      // Fecha en BAC (ej: Oct 24, 2026, 17:24 o 22/10/2026 06:30:15)
      const fechaMatch = rawBody.match(/Fecha:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i)
        || fullText.match(/D[ií]a y hora:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{1,2}:[0-9]{2}:[0-9]{2})/i);
      if (fechaMatch) {
        const parsedD = new Date(fechaMatch[1].trim());
        if (!isNaN(parsedD.getTime())) date = parsedD.toISOString();
      }
    }

    // ----------------------------------------------------------------
    // PARSER GENERAL / WINK / COOPEANDE / OTROS BANCOS
    // ----------------------------------------------------------------
    if (!amount) {
      const crcMatch = fullText.match(/(?:₡|CRC|COLONES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)/i);
      const usdMatch = fullText.match(/(?:\$|USD|DOLARES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)/i);

      if (usdMatch && (!crcMatch || fullText.indexOf(usdMatch[0]) < fullText.indexOf(crcMatch[0]))) {
        currency = 'USD';
        amount = parseCurrencyAmount(usdMatch[1]);
      } else if (crcMatch) {
        currency = 'CRC';
        amount = parseCurrencyAmount(crcMatch[1]);
      }
    }

    if (!last4) {
      const last4Match = fullText.match(/(?:tarjeta|cuenta|terminada en|terminacion|card|\*|\.{2,})\s*(?:no\.?\s*)?([0-9]{4})\b/i);
      if (last4Match) last4 = last4Match[1];
    }

    // Detectar Comercio, Motivo o Concepto si no se encontró
    if (merchant === entity || !merchant) {
      const motiveMatch = fullText.match(/(?:motivo|detalle|concepto|mensaje|descripci[oó]n|comercio|establecimiento|en):\s*([^.\n\r,<]+)/i);
      if (motiveMatch && motiveMatch[1]) {
        merchant = motiveMatch[1].trim();
      }
    }
    merchant = (merchant || entity).replace(/Ciudad\s+y\s+pa[ií]s.*$/i, '').trim();

    if (
      entity === 'Sonivision' ||
      lower.includes('deposito') ||
      lower.includes('transferencia recibida') ||
      lower.includes('credito a su cuenta') ||
      lower.includes('pago recibido') ||
      lower.includes('sinpe movil recibido') ||
      lower.includes('comprobantes de pago') ||
      lower.includes('comprobante de pago')
    ) {
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
    const isCardPayment = /pago\s+de\s+tarjeta|abono\s+a\s+tarjeta|pago\s+realizado\s+a\s+tarjeta|pago\s+tarjeta\s+de\s+cr[eé]dito/i.test(fullText);
    const notePrefix = isCardPayment
      ? 'Pago Tarjeta'
      : (isSinpe ? (type === 'gasto' ? 'SINPE Móvil' : 'SINPE Recibido') : (type === 'gasto' ? 'Compra' : 'Ingreso'));

    return {
      matched: true,
      entity,
      amount,
      currency,
      type,
      isCardPayment,
      last4,
      merchant,
      note: `${notePrefix}: ${merchant} (${entity})`,
      category: isCardPayment ? 'Pago de Tarjeta' : this.categorizeExpense(merchant, fullText),
      date
    };
  }

  categorizeExpense(merchant = '', fullText = '') {
    return financeCategorizer.categorizeExpense(merchant, fullText);
  }

  /**
   * Sincronizar un correo entrante y contabilizarlo
   */
  async processIncomingEmail(emailData) {
    const parsed = this.parseBankNotification(emailData);
    if (!parsed.matched) {
      return { status: 'discarded', reason: parsed.reason };
    }

    const config = this.getConfig();

    // Si hay fecha de inicio configurada (ej: a partir de 2026-10-25), descartar anteriores sin llenar el buzón de registros basura
    if (config.syncStartDate && parsed.date) {
      const emailDate = parsed.date.slice(0, 10);
      if (emailDate < config.syncStartDate) {
        return { status: 'discarded', reason: `Anterior a ${config.syncStartDate}` };
      }
    }

    const localData = financeService.readLocal();
    const accounts = localData.accounts || [];
    const transactions = localData.transactions || [];

    // Helper para obtener los 4 dígitos de la cuenta (de la propiedad last4 o extrayéndolos del nombre ej. "BAC Débito 0095")
    const getAccountLast4 = (a) => {
      if (a.last4) return String(a.last4).trim();
      const match = (a.name || '').match(/\b\d{4}\b/);
      return match ? match[0] : null;
    };

    // Buscar la cuenta que coincide con los últimos 4 dígitos (priorizando coincidencia de moneda USD vs CRC)
    let targetAccount = null;
    if (parsed.last4) {
      const cleanLast4 = String(parsed.last4).trim();
      const matchingLast4 = accounts.filter(a => getAccountLast4(a) === cleanLast4);
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

    // CONTROL ESTRICTO Y UNIVERSAL DE DUPLICADOS:
    // Una compra real (mismo monto, misma moneda, mismo comercio dentro de 72 horas) jamás debe registrarse más de una vez
    const isDuplicate = transactions.some(tx => {
      const sameAmount = Math.abs(Number(tx.amount) - Number(parsed.amount)) < 0.01;
      const sameCurrency = (tx.currency || 'CRC').toUpperCase() === (parsed.currency || 'CRC').toUpperCase();
      const txNote = (tx.merchant || tx.note || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const parseNote = (parsed.merchant || parsed.note || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sameMerchant = txNote.includes(parseNote) || parseNote.includes(txNote) || (txNote.includes('ampm') && parseNote.includes('ampm'));

      let isRecent = false;
      if (tx.date && parsed.date) {
        try {
          const diffHours = Math.abs(new Date(tx.date).getTime() - new Date(parsed.date).getTime()) / (1000 * 60 * 60);
          if (diffHours <= 72) isRecent = true;
        } catch (_) {}
      } else {
        isRecent = true;
      }

      return sameAmount && sameCurrency && sameMerchant && isRecent;
    });

    if (isDuplicate) {
      return {
        status: 'duplicate',
        reason: `Transacción ya registrada previamente (${parsed.merchant} - ${parsed.currency} ${parsed.amount})`
      };
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
        rawSnippet: emailData.subject,
        date: parsed.date
      });

      if (!tx) {
        return {
          status: 'duplicate',
          reason: `Gasto ya registrado previamente en BD (${parsed.merchant} - ${parsed.currency} ${parsed.amount})`
        };
      }

      this.addLog({
        status: 'recorded',
        subject: decodeMimeWords(emailData.subject),
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
        subject: decodeMimeWords(emailData.subject),
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

  isAttachmentCandidate(from = '', subject = '', dateIso = '', config = {}, textRes = {}) {
    const cleanFrom = decodeMimeWords(from).toLowerCase();
    const cleanSubj = decodeMimeWords(subject).toLowerCase();

    if (config.syncStartDate && dateIso) {
      if (dateIso.slice(0, 10) < config.syncStartDate) return false;
    }

    const emailKey = `${cleanFrom}|${cleanSubj}|${String(dateIso).slice(0, 10)}`;
    const existingLogs = this.getLogs();
    if (existingLogs.some(l => l.emailKey === emailKey)) {
      return false;
    }

    const isTrustedSender =
      cleanFrom.includes('sonivision.co.cr') ||
      cleanFrom.includes('coopenae.fi.cr') ||
      cleanFrom.includes('baccredomatic') ||
      cleanFrom.includes('bancopopular') ||
      cleanFrom.includes('bp.fi.cr') ||
      cleanFrom.includes('bancobcr') ||
      cleanFrom.includes('davivienda') ||
      cleanFrom.includes('scotiabank');

    const looksLikeStatementOrReceipt =
      cleanSubj.includes('estado de cuenta') ||
      cleanSubj.includes('comprobante') ||
      cleanSubj.includes('recibo de pago') ||
      cleanSubj.includes('liquidaci');

    return (isTrustedSender && (textRes.status === 'discarded' || looksLikeStatementOrReceipt)) || looksLikeStatementOrReceipt;
  }

  async processEmailAttachments({ from = '', subject = '', date = '', rawMime = '' }) {
    const cleanFrom = decodeMimeWords(from);
    const cleanSubj = decodeMimeWords(subject);
    const lowerFrom = cleanFrom.toLowerCase();
    const emailKey = `${lowerFrom}|${cleanSubj.toLowerCase()}|${String(date).slice(0, 10)}`;

    const attachments = extractAttachmentsFromRawMime(rawMime);
    if (attachments.length === 0) return { recorded: 0 };

    const financeData = await financeService.getAllData();
    const accounts = financeData.accounts || [];
    const primaryDebit = accounts.find(a => a.type === 'debito') || accounts[0];

    let totalImported = 0;

    for (const att of attachments) {
      try {
        const preview = await financeStatementService.previewStatementImport({
          fileBase64: att.fileBase64,
          mimeType: att.mimeType,
          fileName: att.fileName
        });

        let targetAccountId = preview.matchedAccountId;
        let sourceAccountId = null;
        let txs = preview.transactions || [];

        // Regla dedicada: Comprobantes de pago de Sonivision (financiero3@sonivision.co.cr) -> Ingreso a Débito
        if (lowerFrom.includes('sonivision')) {
          targetAccountId = primaryDebit?.id || targetAccountId;
          txs = txs.map(t => ({
            ...t,
            type: 'ingreso',
            category: t.category && t.category !== 'Varios' ? t.category : 'Honorarios Profesionales',
            merchant: t.merchant || 'Sonivision'
          }));
        } else if (preview.documentType === 'payment_receipt' && primaryDebit && targetAccountId !== primaryDebit.id) {
          sourceAccountId = primaryDebit.id;
        }

        const readyTxs = txs.filter(t => t.selected && !t.alreadyRecorded && Number(t.amount) > 0);
        if (readyTxs.length > 0 && targetAccountId) {
          const applied = await financeStatementService.applyStatementImport({
            targetAccountId,
            sourceAccountId,
            documentType: preview.documentType,
            statementInfo: preview.statementInfo,
            transactions: readyTxs
          });
          totalImported += applied.importedCount || 0;
        }
      } catch (err) {
        console.warn('[MailAttachment] Error procesando adjunto:', err.message);
      }
    }

    if (totalImported > 0) {
      this.addLog({
        status: 'recorded',
        emailKey,
        from: cleanFrom,
        subject: `${cleanSubj} [Adjunto procesado: ${totalImported} mov.]`,
        amount: totalImported,
        currency: 'MOV',
        accountName: lowerFrom.includes('sonivision') ? (primaryDebit?.name || 'Débito') : 'Estado/Comprobante',
        type: lowerFrom.includes('sonivision') ? 'ingreso' : 'gasto'
      });
    }

    return { recorded: totalImported };
  }

  /**
   * Sincronización real de correos bancarios vía IMAP SSL
   */
  async syncInbox() {
    if (this.isSyncing) {
      return { success: true, message: 'Sincronización ya en curso.' };
    }
    // En Vercel Serverless /tmp inicia vacío en cada cold start: hidratar config y finanzas desde Supabase primero
    await this.syncFromCloud();
    try {
      await financeService.getAllData();
    } catch (_) {}

    const config = this.getConfig();
    if (!config.email || !config.appPassword) {
      return { success: false, error: 'Debe configurar y guardar su correo y Contraseña de Aplicación de Google primero.' };
    }

    this.isSyncing = true;
    return new Promise((resolve) => {
      let resolved = false;
      let socket = null;
      let processedCount = 0;
      let recordedCount = 0;

      const done = (res) => {
        if (!resolved) {
          resolved = true;
          this.isSyncing = false;
          try {
            const currentCfg = this.getConfig();
            const diskPayload = {
              ...currentCfg,
              lastSync: new Date().toISOString(),
              appPassword: encryptSecret(currentCfg.appPassword || '')
            };
            delete diskPayload.appPasswordMasked;
            delete diskPayload.hasAppPassword;
            const dir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(diskPayload, null, 2), 'utf8');
          } catch (_) {}
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

        let socketClosingCleanly = false;
        let debugState = { step: 'INIT', currentIndex: 0, totalIds: 0, prioCount: 0, bufLen: 0, tail: '' };

        socket.on('error', (err) => {
          if (!socketClosingCleanly) {
            done({ success: false, error: `Error IMAP (${debugState.step}): ${err.message}` });
          }
        });

        socket.setTimeout(15000, () => {
          if (!socketClosingCleanly) {
            done({
              success: false,
              error: `Timeout (${debugState.step}, idx=${debugState.currentIndex}/${debugState.totalIds}, prio=${debugState.prioCount}, buf=${debugState.bufLen}, tail=${debugState.tail}).`
            });
          }
        });

        socket.on('end', () => {
          if (!resolved && !socketClosingCleanly) {
            done({ success: true, processed: processedCount, recorded: recordedCount, message: 'Sincronización finalizada.' });
          }
        });

        socket.on('secureConnect', () => {
          let buffer = '';
          let step = 'WAIT_GREETING';
          let msgIds = [];
          let priorityIds = new Set();
          let currentIndex = 0;
          const fetchedEmails = [];
          const startedAt = Date.now();

          const parseSearchIds = (raw) => {
            const m = raw.match(/\* SEARCH ([\d\s]+)/);
            if (!m || !m[1].trim()) return [];
            return m[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
          };

          const formatImapSince = (isoOrDate) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const d = isoOrDate ? new Date(isoOrDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const safeD = isNaN(d.getTime()) ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : d;
            return `${String(safeD.getUTCDate()).padStart(2, '0')}-${months[safeD.getUTCMonth()]}-${safeD.getUTCFullYear()}`;
          };

          const isFinancialHeader = (fromRaw = '', subjectRaw = '', dateStr = '') => {
            const f = decodeMimeWords(fromRaw).toLowerCase();
            const s = decodeMimeWords(subjectRaw).toLowerCase();
            const combined = `${f} ${s}`;
            if (this.isDiscardable(s, f)) return false;

            const d = dateStr ? new Date(dateStr) : null;
            if (config.syncStartDate && d && !isNaN(d.getTime())) {
              if (d.toISOString().slice(0, 10) < config.syncStartDate) return false;
            }

            const financialHints = [
              'bac', 'credomatic', 'popular', 'bp.fi.cr', 'wink', 'holawink',
              'coopeande', 'coopenae', 'bcr', 'bancobcr', 'davivienda', 'scotiabank',
              'paypal', 'sonivision', 'sinpe', 'comprobante', 'estado de cuenta',
              'transaccion', 'compra', 'transferencia', 'deposito', 'pago', 'tarjeta', 'recibo'
            ];
            return financialHints.some(kw => combined.includes(kw));
          };

          const sendCmd = (tag, cmd) => {
            try { socket.write(`${tag} ${cmd}\r\n`); } catch (_) {}
          };

          const finishImapAndProcess = async () => {
            if (socketClosingCleanly) return;
            socketClosingCleanly = true;
            try {
              sendCmd('a999', 'LOGOUT');
              socket.destroy();
            } catch (_) {}

            let attachmentsProcessed = 0;
            for (const item of fetchedEmails) {
              if ((Date.now() - startedAt) > 22000) break;
              try {
                const textRes = await this.processIncomingEmail({
                  subject: item.subject,
                  from: item.from,
                  date: item.date,
                  body: item.rawBody
                });
                processedCount++;
                if (textRes.status === 'recorded') recordedCount++;

                if (
                  attachmentsProcessed < 3 &&
                  this.isAttachmentCandidate(item.from, item.subject, item.date, config, textRes)
                ) {
                  attachmentsProcessed++;
                  const attRes = await this.processEmailAttachments({
                    from: item.from,
                    subject: item.subject,
                    date: item.date,
                    rawMime: item.rawBody
                  });
                  recordedCount += attRes.recorded || 0;
                }
              } catch (_) {}
            }

            try {
              await this.saveConfig({ ...config, lastSync: new Date().toISOString() });
            } catch (_) {}

            done({
              success: true,
              processed: processedCount,
              recorded: recordedCount,
              message: `Sincronización completada: ${processedCount} correos bancarios analizados, ${recordedCount} comprobantes contabilizados.`
            });
          };

          const fetchNext = () => {
            if (currentIndex < msgIds.length && (Date.now() - startedAt) < 12000) {
              const id = msgIds[currentIndex];
              const tag = `f${currentIndex}`;
              if (priorityIds.has(id)) {
                sendCmd(tag, `FETCH ${id} (BODY.PEEK[])`);
              } else {
                sendCmd(tag, `FETCH ${id} (BODY.PEEK[]<0.32000>)`);
              }
            } else {
              step = 'DONE';
              finishImapAndProcess();
            }
          };

          socket.on('data', (chunk) => {
            if (socketClosingCleanly) return;
            buffer += chunk.toString();
            debugState = {
              step,
              currentIndex,
              totalIds: msgIds.length,
              prioCount: priorityIds.size,
              bufLen: buffer.length,
              tail: buffer.slice(-160).replace(/[\r\n]+/g, ' | ')
            };

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
                step = 'WAIT_SEARCH_SONIVISION';
                const sinceStr = formatImapSince(config.syncStartDate);
                sendCmd('a003a', `SEARCH SINCE ${sinceStr} FROM "sonivision"`);
              }
            } else if (step === 'WAIT_SEARCH_SONIVISION') {
              if (/\ba003a (?:OK|NO|BAD)\b/.test(buffer)) {
                if (buffer.includes('a003a OK')) {
                  parseSearchIds(buffer).forEach(id => priorityIds.add(id));
                }
                buffer = '';
                step = 'WAIT_SEARCH_COOPENAE';
                const sinceStr = formatImapSince(config.syncStartDate);
                sendCmd('a003b', `SEARCH SINCE ${sinceStr} FROM "coopenae"`);
              }
            } else if (step === 'WAIT_SEARCH_COOPENAE') {
              if (/\ba003b (?:OK|NO|BAD)\b/.test(buffer)) {
                if (buffer.includes('a003b OK')) {
                  parseSearchIds(buffer).forEach(id => priorityIds.add(id));
                }
                buffer = '';
                step = 'WAIT_SEARCH';
                const sinceStr = formatImapSince(config.syncStartDate);
                sendCmd('a003', `SEARCH SINCE ${sinceStr}`);
              }
            } else if (step === 'WAIT_SEARCH') {
              if (/\ba003 (?:OK|NO|BAD)\b/.test(buffer)) {
                const allIds = buffer.includes('a003 OK') ? parseSearchIds(buffer) : [];
                buffer = '';
                // Priorizar Sonivision y Coopenae primero, luego los 30 más recientes desde syncStartDate
                const prioSorted = Array.from(priorityIds).sort((a, b) => b - a);
                const recentSorted = allIds.slice(-30).reverse();
                msgIds = Array.from(new Set([...prioSorted, ...recentSorted]));
                if (msgIds.length === 0) {
                  step = 'DONE';
                  finishImapAndProcess();
                  return;
                }
                step = 'FETCHING';
                fetchNext();
              }
            } else if (step === 'FETCHING') {
              const tag = `f${currentIndex}`;
              const tagDoneRegex = new RegExp(`\\b${tag} (?:OK|NO|BAD)\\b`);
              if (tagDoneRegex.test(buffer) || buffer.length > 3 * 1024 * 1024) {
                const currentChunk = buffer;
                buffer = '';
                const unfolded = unfoldHeaders(currentChunk);

                const subjectMatch = unfolded.match(/Subject:\s*([^\r\n]+)/i);
                const fromMatch = unfolded.match(/From:\s*([^\r\n]+)/i);
                const dateMatch = unfolded.match(/Date:\s*([^\r\n]+)/i);

                const subject = subjectMatch ? subjectMatch[1].trim() : '';
                const from = fromMatch ? fromMatch[1].trim() : '';
                const date = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : new Date().toISOString();

                if (currentChunk.length <= 3 * 1024 * 1024) {
                  fetchedEmails.push({
                    id: msgIds[currentIndex],
                    subject,
                    from,
                    date,
                    rawBody: currentChunk
                  });
                }

                currentIndex++;
                fetchNext();
              }
            }
          });
        });
      } catch (err) {
        done({ success: false, error: `Error de inicialización TLS: ${err.message}` });
      }
    });
  }
}

module.exports = new BankMailService();

const crypto = require('crypto');
const config = require('../config');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const PUBLIC_PATHS = new Set(['/health', '/keep-alive', '/cron/mail-sync', '/auth/status', '/auth/login']);

function isPinAuthEnabled() {
  return Boolean(config.PROACTUR_ACCESS_PIN && String(config.PROACTUR_ACCESS_PIN).trim().length > 0);
}

function getSigningSecret() {
  const base =
    config.AUTH_SECRET ||
    config.SUPABASE_SERVICE_ROLE_KEY ||
    config.GEMINI_API_KEY ||
    config.PROACTUR_ACCESS_PIN ||
    'proactur-ephemeral-secret';
  return crypto.createHash('sha256').update(`proactur-auth:${base}`).digest();
}

function safeEqualText(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signToken(expMs) {
  const payload = `v1.${expMs}`;
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expMs = Number(parts[1]);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return false;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`v1.${parts[1]}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(parts[2], 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch (_) {
    return false;
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function getAuthStatus(req, res) {
  const pinRequired = isPinAuthEnabled();
  const token = extractBearerToken(req);
  const authenticated = !pinRequired || verifyToken(token);
  res.json({ pinRequired, authenticated });
}

function loginHandler(req, res) {
  if (!isPinAuthEnabled()) {
    return res.json({ pinRequired: false, authenticated: true, token: null });
  }
  const submittedPin = req.body && req.body.pin !== undefined ? String(req.body.pin).trim() : '';
  const configuredPin = String(config.PROACTUR_ACCESS_PIN).trim();
  if (!submittedPin || !safeEqualText(submittedPin, configuredPin)) {
    return res.status(401).json({ error: 'PIN incorrecto', code: 'INVALID_PIN' });
  }
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signToken(expiresAt);
  return res.json({ pinRequired: true, authenticated: true, token, expiresAt });
}

function requireApiAuth(req, res, next) {
  if (req.method === 'OPTIONS' || !isPinAuthEnabled()) {
    return next();
  }
  const normalizedPath = req.path === '/' ? '/' : req.path.replace(/\/+$/, '');
  if (PUBLIC_PATHS.has(normalizedPath)) {
    return next();
  }
  // Permitir servir archivos estáticos del frontend cuando Express sirve client/dist en '/'
  if (
    req.baseUrl === '' &&
    req.method === 'GET' &&
    (normalizedPath === '/' ||
      normalizedPath === '/index.html' ||
      normalizedPath.startsWith('/assets/') ||
      /\.(js|css|png|jpg|jpeg|svg|ico|webp|woff2?|webmanifest)$/i.test(normalizedPath))
  ) {
    return next();
  }
  const token = extractBearerToken(req);
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Sesión requerida o expirada', code: 'AUTH_REQUIRED' });
  }
  return next();
}

module.exports = {
  isPinAuthEnabled,
  getAuthStatus,
  loginHandler,
  requireApiAuth
};

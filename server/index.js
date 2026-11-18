// Escudo de protección global contra excepciones imprevistas (DNS drops, socket errors, API timeouts)
process.on('uncaughtException', (err) => {
  console.error('[Shield uncaughtException]:', err && err.message ? err.message : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Shield unhandledRejection]:', reason);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const apiRoutes = require('./routes/api');
const { getAuthStatus, loginHandler, requireApiAuth } = require('./middleware/authMiddleware');

const app = express();
const PORT = config.PORT;

// Cabeceras básicas de seguridad HTTP
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configuración de CORS restringida a orígenes confiables (web, Capacitor Android/iOS, dev local)
const DEFAULT_TRUSTED_ORIGINS = [
  'https://pro-actur.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:38472',
  'http://127.0.0.1:5173'
];
const envOrigins = (config.ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const trustedOrigins = new Set([...DEFAULT_TRUSTED_ORIGINS, ...envOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin cabecera Origin (curl/apps nativas/same-origin) o dentro de la whitelist
    if (!origin || trustedOrigins.has('*') || trustedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Endpoints de autenticación y protección de API
app.get('/api/auth/status', getAuthStatus);
app.post('/api/auth/login', loginHandler);
app.get('/auth/status', getAuthStatus);
app.post('/auth/login', loginHandler);

// Rutas de API protegidas por PIN cuando PROACTUR_ACCESS_PIN está configurado
app.use('/api', requireApiAuth, apiRoutes);
app.use('/', requireApiAuth, apiRoutes);

// Servir frontend compilado si existe
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.json({
        name: 'ProActur AI Server',
        status: 'running',
        apiDocs: '/api/health'
      });
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('=========================================');
    console.log('🚀 ProActur AI Server ejecutándose en:');
    console.log(`📡 http://localhost:${PORT}`);
    console.log('🧠 Modelo IA activo:', config.GEMINI_MODEL || 'gemini-3.6-flash');
    console.log('⚡ Persistencia:', config.SUPABASE_URL ? 'Supabase + Local Cache' : 'Local (meetings.json)');
    console.log('=========================================');
  });
}

module.exports = app;

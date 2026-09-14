const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = config.PORT;

// Configuración de CORS
const allowedOrigin = config.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(','),
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Middlewares
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Rutas de API
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

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
        name: 'Proactor AI Server',
        status: 'running',
        apiDocs: '/api/health'
      });
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('=========================================');
    console.log('🚀 Proactor AI Server ejecutándose en:');
    console.log(`📡 http://localhost:${PORT}`);
    console.log('🧠 Modelo IA activo:', config.GEMINI_MODEL || 'gemini-3.6-flash');
    console.log('⚡ Persistencia:', config.SUPABASE_URL ? 'Supabase + Local Cache' : 'Local (meetings.json)');
    console.log('=========================================');
  });
}

module.exports = app;

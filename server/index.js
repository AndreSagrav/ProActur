require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rutas de API
app.use('/api', apiRoutes);

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

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Proactor AI Server ejecutándose en:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`=========================================`);
});

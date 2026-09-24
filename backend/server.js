require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const prisma = require('./src/lib/prisma');
const authRoutes = require('./src/routes/authRoutes');
const pesquisaRoutes = require('./src/routes/pesquisaRoutes');
const userRoutes = require('./src/routes/userRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500').split(',').map((value) => value.trim()).filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origem não permitida pelo CORS.'));
} }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ok', database: 'ok', service: 'ponde-pesquisas-api' });
  } catch (error) {
    return res.status(503).json({ status: 'error', database: 'offline', service: 'ponde-pesquisas-api' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/pesquisas', pesquisaRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

async function start() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => console.log(`API disponível em http://localhost:${PORT}`));
  } catch (error) {
    console.error('Falha ao conectar no PostgreSQL:', error.message);
    process.exit(1);
  }
}

start();

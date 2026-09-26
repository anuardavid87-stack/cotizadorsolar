import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initDatabase, db, syncToSupabase, ensureLatestDb } from './db.js';
import { seed } from './seed.js';
import { securityHeaders } from './middleware/security.js';
import { syncUsersWithSQLite } from './supabase.js';

import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import productRoutes from './routes/products.js';
import quoteRoutes from './routes/quotes.js';
import followupRoutes from './routes/followups.js';
import settingsRoutes from './routes/settings.js';
import visitsRoutes from './routes/visits.js';
import contractRoutes from './routes/contracts.js';
import logRoutes from './routes/logs.js';
import legalizationRoutes from './routes/legalizations.js';
import rolesRoutes from './routes/roles.js';
import backupRoutes from './routes/backup.js';
import jobsRoutes from './routes/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Cybersecurity: Security Headers
app.use(securityHeaders);

// Cybersecurity: Hardened CORS policy
const allowedOrigins = [
  'https://cotizador-solar-pro-one.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Init database and verify seeding
initDatabase();
seed();

// Reconcile users with Supabase Cloud
syncUsersWithSQLite(db).catch(err => console.warn('[Supabase Users Reconcile Notice]:', err.message));

// Ensure container has freshest database before handling any API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await ensureLatestDb();
    } catch (e) {}
  }
  next();
});

// Auto Cloud Sync: whenever ANY API mutation succeeds (POST, PUT, DELETE, PATCH)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.path.startsWith('/api')) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        syncToSupabase().catch(err => console.warn('[Auto Cloud Sync Notice]:', err.message));
      }
    });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/legalizations', legalizationRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/jobs', jobsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'SolarQuote Pro API',
    time: new Date().toISOString()
  });
});

// PWA Support: Serve Service Worker & Manifest with optimal headers
const publicPath = path.join(__dirname, '..', 'public');
const distPath = path.join(__dirname, '..', 'dist');

app.get('/sw.js', (req, res, next) => {
  const swDist = path.join(distPath, 'sw.js');
  const swPublic = path.join(publicPath, 'sw.js');
  const targetPath = fs.existsSync(swDist) ? swDist : fs.existsSync(swPublic) ? swPublic : null;
  if (targetPath) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(targetPath);
  }
  next();
});

app.get(['/manifest.webmanifest', '/manifest.json'], (req, res, next) => {
  const manDist = path.join(distPath, 'manifest.webmanifest');
  const manPublic = path.join(publicPath, 'manifest.webmanifest');
  const targetPath = fs.existsSync(manDist) ? manDist : fs.existsSync(manPublic) ? manPublic : null;
  if (targetPath) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.sendFile(targetPath);
  }
  next();
});

// Serve frontend in production
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`⚡ SolarQuote Pro API Server running on port ${PORT}`);
  console.log(`🌐 API ready at http://localhost:${PORT}/api/health`);
});

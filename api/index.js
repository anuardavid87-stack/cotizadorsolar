import express from 'express';
import cors from 'cors';
import { initDatabase, syncToSupabase, ensureLatestDb, db } from '../server/db.js';
import { seed } from '../server/seed.js';
import { securityHeaders } from '../server/middleware/security.js';
import { syncUsersWithSQLite } from '../server/supabase.js';

import authRoutes from '../server/routes/auth.js';
import clientRoutes from '../server/routes/clients.js';
import productRoutes from '../server/routes/products.js';
import quoteRoutes from '../server/routes/quotes.js';
import followupRoutes from '../server/routes/followups.js';
import settingsRoutes from '../server/routes/settings.js';
import visitsRoutes from '../server/routes/visits.js';
import contractRoutes from '../server/routes/contracts.js';
import logRoutes from '../server/routes/logs.js';
import legalizationRoutes from '../server/routes/legalizations.js';
import rolesRoutes from '../server/routes/roles.js';
import backupRoutes from '../server/routes/backup.js';
import jobsRoutes from '../server/routes/jobs.js';

const app = express();

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

// Ensure serverless functions read the freshest DB before processing requests
app.use(async (req, res, next) => {
  try {
    await ensureLatestDb();
  } catch (e) {}
  next();
});

// Ensure DB mutations are completely persisted to Supabase Storage before response closes
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json;
    res.json = async function(body) {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        try {
          await syncToSupabase();
        } catch (err) {
          console.warn('[Supabase Sync Warning]:', err.message);
        }
      }
      return originalJson.call(this, body);
    };
  }
  next();
});

try {
  initDatabase();
  seed();
  // Asynchronously reconcile users with Supabase PostgreSQL
  syncUsersWithSQLite(db).catch(err => console.warn('[Supabase Users Reconcile Notice]:', err.message));
} catch (e) {
  console.error('Database initialization error:', e);
}

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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'SolarQuote Pro API (Vercel Serverless & Supabase Cloud)',
    time: new Date().toISOString()
  });
});

export default app;

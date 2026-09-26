import express from 'express';
import { db } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Middleware: Admin Only
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Este módulo está reservado exclusivamente para el usuario Administrador.' });
  }
  next();
}

/**
 * GET /api/logs
 * Query audit logs with rich filters, search, pagination, and KPI statistics
 */
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      module,
      action,
      user_id,
      search,
      date_range,
      limit = 100,
      offset = 0
    } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const params = [];
    const countParams = [];

    // Filter by module
    if (module && module !== 'all') {
      query += ' AND module = ?';
      countQuery += ' AND module = ?';
      params.push(module);
      countParams.push(module);
    }

    // Filter by action
    if (action && action !== 'all') {
      query += ' AND action = ?';
      countQuery += ' AND action = ?';
      params.push(action);
      countParams.push(action);
    }

    // Filter by user
    if (user_id && user_id !== 'all') {
      const uId = parseInt(user_id, 10);
      if (!isNaN(uId)) {
        query += ' AND user_id = ?';
        countQuery += ' AND user_id = ?';
        params.push(uId);
        countParams.push(uId);
      }
    }

    // Search query
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ' AND (description LIKE ? OR entity_id LIKE ? OR user_name LIKE ? OR action LIKE ? OR module LIKE ?)';
      countQuery += ' AND (description LIKE ? OR entity_id LIKE ? OR user_name LIKE ? OR action LIKE ? OR module LIKE ?)';
      params.push(term, term, term, term, term);
      countParams.push(term, term, term, term, term);
    }

    // Date range filter
    if (date_range === 'today') {
      query += " AND date(created_at) = date('now', 'localtime')";
      countQuery += " AND date(created_at) = date('now', 'localtime')";
    } else if (date_range === 'week') {
      query += " AND created_at >= datetime('now', '-7 days', 'localtime')";
      countQuery += " AND created_at >= datetime('now', '-7 days', 'localtime')";
    } else if (date_range === 'month') {
      query += " AND created_at >= datetime('now', '-30 days', 'localtime')";
      countQuery += " AND created_at >= datetime('now', '-30 days', 'localtime')";
    }

    // Get total matching
    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    // Get ordered paginated results
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit, 10) || 100, 500), parseInt(offset, 10) || 0);

    const logs = db.prepare(query).all(...params);

    // Compute high-level KPI metrics for the header cards
    const todayCount = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE date(created_at) = date('now', 'localtime')").get()?.c || 0;
    const totalCount = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get()?.c || 0;
    const userEventsCount = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE module IN ('usuarios', 'seguridad')").get()?.c || 0;
    const quoteEventsCount = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE module IN ('cotizaciones', 'contratos')").get()?.c || 0;
    const clientEventsCount = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE module = 'clientes'").get()?.c || 0;

    // Distinct modules and users for filter dropdowns
    const availableModules = db.prepare("SELECT DISTINCT module FROM audit_logs WHERE module IS NOT NULL AND module != '' ORDER BY module ASC").all().map(r => r.module);
    const availableUsers = db.prepare("SELECT DISTINCT user_id, user_name FROM audit_logs WHERE user_name IS NOT NULL AND user_name != '' ORDER BY user_name ASC").all();

    res.json({
      logs,
      total,
      stats: {
        totalLogs: totalCount,
        todayLogs: todayCount,
        userEvents: userEventsCount,
        quoteEvents: quoteEventsCount,
        clientEvents: clientEventsCount
      },
      availableModules,
      availableUsers
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/logs/clear
 * Admin endpoint to clean up old audit logs
 */
router.post('/clear', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { mode } = req.body;
    if (mode === 'all') {
      db.prepare('DELETE FROM audit_logs').run();
    } else if (mode === 'old90') {
      db.prepare("DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days')").run();
    } else {
      db.prepare("DELETE FROM audit_logs WHERE created_at < datetime('now', '-30 days')").run();
    }
    res.json({ message: 'Registros de auditoría depurados exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

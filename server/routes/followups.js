import express from 'express';
import { db } from '../db.js';
import { authenticateToken, requirePermission, getUserPermissions } from './auth.js';

const router = express.Router();

// Get follow-up list with friendly filters
router.get('/', authenticateToken, requirePermission('crm'), (req, res) => {
  try {
    const { filter, search } = req.query;
    // Current date YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    let query = `
      SELECT q.id as quote_id, q.quote_code, q.system_type, q.status as quote_status,
             q.total_price, q.installed_power_kwp, q.installed_panels,
             q.interest_score, q.followup_date, q.created_at as quote_created_at,
             c.id as client_id, c.name as client_name, c.phone as client_phone,
             c.email as client_email, c.city as client_city, c.operator as client_operator,
             u.name as advisor_name,
             (SELECT comments FROM followups WHERE quote_id = q.id ORDER BY id DESC LIMIT 1) as last_comment,
             (SELECT interaction_type FROM followups WHERE quote_id = q.id ORDER BY id DESC LIMIT 1) as last_interaction_type,
             (SELECT desist_reason FROM followups WHERE quote_id = q.id ORDER BY id DESC LIMIT 1) as desist_reason,
             (SELECT COUNT(*) FROM followups WHERE quote_id = q.id) as total_interactions
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter modes
    if (filter === 'today') {
      // Pending for today
      query += ` AND q.status = 'pendiente' AND date(q.followup_date) = date(?)`;
      params.push(today);
    } else if (filter === 'overdue') {
      // Overdue (older than today and still pending)
      query += ` AND q.status = 'pendiente' AND date(q.followup_date) < date(?)`;
      params.push(today);
    } else if (filter === 'upcoming') {
      // Upcoming in next 7 days
      query += ` AND q.status = 'pendiente' AND date(q.followup_date) > date(?) AND date(q.followup_date) <= date(?, '+7 days')`;
      params.push(today, today);
    } else if (filter === 'hot') {
      // Hot leads: score 8 to 10
      query += ` AND q.status = 'pendiente' AND q.interest_score >= 8`;
    } else if (filter === 'desist') {
      // Archived / Desistidos
      query += ` AND q.status = 'desistida'`;
    } else if (filter === 'won') {
      // Aprobados / Ganados
      query += ` AND q.status = 'aprobada'`;
    } else {
      // Default: All active pending followups (not desistidas)
      if (filter !== 'all_history') {
        query += ` AND q.status = 'pendiente'`;
      }
    }

    if (search && search.trim() !== '') {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.city LIKE ? OR q.quote_code LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    // Sort: Overdue first, then today, then upcoming
    query += ` ORDER BY q.followup_date ASC, q.interest_score DESC`;

    const followups = db.prepare(query).all(...params);

    // Get summary badges for quick count
    const statsQuery = `
      SELECT
        COUNT(CASE WHEN status = 'pendiente' AND date(followup_date) = date(?) THEN 1 END) as today_count,
        COUNT(CASE WHEN status = 'pendiente' AND date(followup_date) < date(?) THEN 1 END) as overdue_count,
        COUNT(CASE WHEN status = 'pendiente' AND date(followup_date) > date(?) AND date(followup_date) <= date(?, '+7 days') THEN 1 END) as upcoming_count,
        COUNT(CASE WHEN status = 'pendiente' AND interest_score >= 8 THEN 1 END) as hot_count,
        COUNT(CASE WHEN status = 'pendiente' THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'desistida' THEN 1 END) as desist_count,
        COUNT(CASE WHEN status = 'aprobada' THEN 1 END) as won_count
      FROM quotes
    `;
    const stats = db.prepare(statsQuery).get(today, today, today, today);

    res.json({ followups, stats, server_today: today });
  } catch (error) {
    console.error('Error in followups list:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record a new follow-up interaction
router.post('/', authenticateToken, requirePermission('crm'), (req, res) => {
  try {
    const {
      quote_id, client_id, interaction_type, interest_score,
      comments, action_taken, next_followup_date, desist_reason
    } = req.body;

    if (!quote_id || !comments) {
      return res.status(400).json({ error: 'La cotización y los comentarios son obligatorios.' });
    }

    const validScore = Math.max(1, Math.min(10, parseInt(interest_score) || 7));
    const finalAction = action_taken || 'reprogramar';

    // Insert log record
    const result = db.prepare(`
      INSERT INTO followups (
        quote_id, client_id, user_id, interaction_type, interest_score,
        comments, action_taken, next_followup_date, desist_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quote_id,
      client_id,
      req.user.id,
      interaction_type || 'llamada',
      validScore,
      comments.trim(),
      finalAction,
      next_followup_date || null,
      desist_reason || null
    );

    // Update quote status and score according to action
    if (finalAction === 'desiste') {
      db.prepare(`
        UPDATE quotes
        SET status = 'desistida', interest_score = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(validScore, quote_id);
    } else if (finalAction === 'ganado') {
      db.prepare(`
        UPDATE quotes
        SET status = 'aprobada', interest_score = 10, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(quote_id);
    } else if (next_followup_date) {
      db.prepare(`
        UPDATE quotes
        SET followup_date = ?, interest_score = ?, status = 'pendiente', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(next_followup_date, validScore, quote_id);
    } else {
      db.prepare(`
        UPDATE quotes
        SET interest_score = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(validScore, quote_id);
    }

    res.status(201).json({
      message: 'Seguimiento registrado exitosamente',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error saving followup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get interaction history for a quote (Requires crm or quotes permission)
router.get('/history/:quoteId', authenticateToken, (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  const perms = getUserPermissions(req.user?.role);
  if (perms.includes('crm') || perms.includes('quotes')) return next();
  return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para ver el historial de seguimientos.' });
}, (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    const history = db.prepare(`
      SELECT f.*, u.name as user_name
      FROM followups f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.quote_id = ?
      ORDER BY f.id DESC
    `).all(quoteId);

    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

import express from 'express';
import { db, syncToSupabase, recordAuditLog } from '../db.js';
import { authenticateToken, requirePermission, requireAdmin, getUserPermissions } from './auth.js';

const router = express.Router();

// Generate quote code: COT-YYYY-NNN
export function generateNextQuoteCode() {
  const currentYear = new Date().getFullYear();
  const prefix = `COT-${currentYear}-`;
  const rows = db.prepare('SELECT quote_code FROM quotes WHERE quote_code LIKE ?').all(`${prefix}%`);
  let maxSeq = 0;
  for (const r of rows) {
    if (r.quote_code) {
      const parts = r.quote_code.split('-');
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (db.prepare('SELECT id FROM quotes WHERE quote_code = ?').get(candidate)) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

// Get quotes list with filters
router.get('/', authenticateToken, requirePermission('quotes'), (req, res) => {
  try {
    const { status, system_type, client_id, search, min_score, max_score } = req.query;
    let query = `
      SELECT q.*, c.name as client_name, c.phone as client_phone, c.city as client_city, 
             c.doc_number as client_doc, u.name as user_name,
             (SELECT COUNT(*) FROM followups WHERE quote_id = q.id) as followups_count,
             (SELECT comments FROM followups WHERE quote_id = q.id ORDER BY id DESC LIMIT 1) as last_comment
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND q.status = ?';
      params.push(status);
    }

    if (system_type && system_type !== 'all') {
      query += ' AND q.system_type = ?';
      params.push(system_type);
    }

    if (client_id) {
      query += ' AND q.client_id = ?';
      params.push(client_id);
    }

    if (min_score) {
      query += ' AND q.interest_score >= ?';
      params.push(parseInt(min_score));
    }

    if (max_score) {
      query += ' AND q.interest_score <= ?';
      params.push(parseInt(max_score));
    }

    if (search && search.trim() !== '') {
      query += ' AND (q.quote_code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.city LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY q.id DESC';

    const quotes = db.prepare(query).all(...params);
    res.json({ quotes });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single quote by ID with full details (Admins, Advisors, Contracts, CRM, Visits managers)
router.get('/:id', authenticateToken, (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  const perms = getUserPermissions(req.user?.role);
  if (perms.includes('quotes') || perms.includes('contracts') || perms.includes('crm') || perms.includes('visits')) return next();
  return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para ver cotizaciones.' });
}, (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    const quote = db.prepare(`
      SELECT q.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
             c.doc_type as client_doc_type, c.doc_number as client_doc_number,
             c.address as client_address, c.city as client_city, c.department as client_department,
             c.operator as client_operator, c.client_type as client_type_name, c.stratum as client_stratum,
             u.name as user_name, u.email as user_email
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      WHERE q.id = ?
    `).get(quoteId);

    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    // Parse JSON fields
    quote.selected_inverters = JSON.parse(quote.selected_inverters_json || '[]');
    quote.selected_batteries = JSON.parse(quote.selected_batteries_json || '[]');
    quote.selected_pumps = JSON.parse(quote.selected_pumps_json || '[]');

    // Get follow-up logs
    const followups = db.prepare(`
      SELECT f.*, u.name as user_name
      FROM followups f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.quote_id = ?
      ORDER BY f.id DESC
    `).all(quoteId);

    // Get company settings for PDF/print template
    const settings = db.prepare('SELECT * FROM company_settings WHERE is_default = 1 UNION SELECT * FROM company_settings WHERE id = 1 LIMIT 1').get() || {};

    res.json({ quote, followups, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create quote
router.post('/', authenticateToken, requirePermission('quotes'), (req, res) => {
  try {
    if (req.user.role === 'tecnico') {
      return res.status(403).json({ error: 'El rol técnico no tiene permisos para crear o modificar cotizaciones.' });
    }

    const {
      client_id, system_type, interest_score, followup_date,
      client_consumption_kwh, radiation_coefficient, required_power_kwp,
      panel_model_id, panel_power_w, panel_unit_price, suggested_panels,
      installed_panels, installed_power_kwp,
      selected_inverters, selected_batteries, selected_pumps,
      mdo_unit_price, mdo_total, structure_type, structure_unit_price, structure_total,
      panels_total, inverters_total, batteries_total, pumps_total,
      legalization_included, legalization_design_price, legalization_tramite_price,
      legalization_bidi_price, legalization_retie_price, caja_ac_price, accessories_price,
      legalization_total, subtotal, discount_percent, discount_amount, total_price,
      financing_down_payment_percent, financing_down_payment_amount, financing_amount,
      financing_term_months, financing_monthly_fee, financing_monthly_rate, visit_id, notes
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'Debes seleccionar un cliente.' });
    }

    const parsedClientId = parseInt(client_id, 10);
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(parsedClientId);
    if (!client) {
      return res.status(404).json({ error: 'El cliente seleccionado no existe.' });
    }

    if (!followup_date) {
      return res.status(400).json({ error: 'La fecha de seguimiento es obligatoria.' });
    }

    let quoteUserId = null;
    if (req.user?.id) {
      const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id);
      if (u) quoteUserId = u.id;
    }

    // Safely validate panel_model_id against products
    let validPanelModelId = null;
    if (panel_model_id) {
      const pId = parseInt(panel_model_id, 10);
      if (!isNaN(pId)) {
        const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(pId);
        if (prod) validPanelModelId = prod.id;
      }
    }

    // Safely validate visit_id against technical_visits
    let validVisitId = null;
    if (visit_id) {
      const vId = parseInt(visit_id, 10);
      if (!isNaN(vId)) {
        const v = db.prepare('SELECT id FROM technical_visits WHERE id = ?').get(vId);
        if (v) validVisitId = v.id;
      }
    }

    // Anti-double-click debounce for quotes (prevents rapid double submissions)
    const recentDuplicateQuote = db.prepare(`
      SELECT id, quote_code, total_price, created_at FROM quotes 
      WHERE client_id = ? 
        AND ABS(total_price - ?) < 1
        AND (strftime('%s', 'now') - strftime('%s', created_at)) < 20
    `).get(client.id, parseFloat(total_price) || 0);

    if (recentDuplicateQuote) {
      console.log(`[Anti-Duplicate] Prevented duplicate quote creation for client ${client.id}. Returning existing ${recentDuplicateQuote.quote_code}`);
      return res.status(200).json({
        message: `Cotización ${recentDuplicateQuote.quote_code} ya fue procesada exitosamente`,
        id: recentDuplicateQuote.id,
        quote_code: recentDuplicateQuote.quote_code
      });
    }

    const quoteCode = generateNextQuoteCode();

    const insertStmt = db.prepare(`
      INSERT INTO quotes (
        quote_code, client_id, user_id, system_type, status, interest_score, followup_date,
        client_consumption_kwh, radiation_coefficient, required_power_kwp, panel_model_id,
        panel_power_w, panel_unit_price, suggested_panels, installed_panels, installed_power_kwp,
        selected_inverters_json, selected_batteries_json, selected_pumps_json,
        mdo_unit_price, mdo_total, structure_type, structure_unit_price, structure_total,
        panels_total, inverters_total, batteries_total, pumps_total,
        legalization_included, legalization_design_price, legalization_tramite_price,
        legalization_bidi_price, legalization_retie_price, caja_ac_price, accessories_price,
        legalization_total, subtotal, discount_percent, discount_amount, total_price,
        financing_down_payment_percent, financing_down_payment_amount, financing_amount,
        financing_term_months, financing_monthly_fee, financing_monthly_rate, visit_id, notes
      ) VALUES (
        ?, ?, ?, ?, 'pendiente', ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      quoteCode,
      client.id,
      quoteUserId,
      system_type || 'ongrid',
      interest_score || 7,
      followup_date,
      parseFloat(client_consumption_kwh) || 0,
      parseFloat(radiation_coefficient) || 10.1,
      parseFloat(required_power_kwp) || 0,
      validPanelModelId,
      parseFloat(panel_power_w) || 720,
      parseFloat(panel_unit_price) || 470000,
      parseInt(suggested_panels) || 0,
      parseInt(installed_panels) || 0,
      parseFloat(installed_power_kwp) || 0,
      JSON.stringify(selected_inverters || []),
      JSON.stringify(selected_batteries || []),
      JSON.stringify(selected_pumps || []),
      parseFloat(mdo_unit_price) || 400000,
      parseFloat(mdo_total) || 0,
      structure_type || 'Coplanar / Teja',
      parseFloat(structure_unit_price) || 280000,
      parseFloat(structure_total) || 0,
      parseFloat(panels_total) || 0,
      parseFloat(inverters_total) || 0,
      parseFloat(batteries_total) || 0,
      parseFloat(pumps_total) || 0,
      legalization_included !== undefined ? (legalization_included ? 1 : 0) : 1,
      parseFloat(legalization_design_price) || 0,
      parseFloat(legalization_tramite_price) || 1400000,
      parseFloat(legalization_bidi_price) || 1890000,
      parseFloat(legalization_retie_price) || 3820000,
      parseFloat(caja_ac_price) || 2500000,
      parseFloat(accessories_price) || 5000000,
      parseFloat(legalization_total) || 0,
      parseFloat(subtotal) || 0,
      parseFloat(discount_percent) || 0,
      parseFloat(discount_amount) || 0,
      parseFloat(total_price) || 0,
      parseFloat(financing_down_payment_percent) || 0,
      parseFloat(financing_down_payment_amount) || 0,
      parseFloat(financing_amount) || 0,
      parseInt(financing_term_months) || 48,
      parseFloat(financing_monthly_fee) || 0,
      parseFloat(financing_monthly_rate) || 0.015,
      validVisitId,
      notes || ''
    );

    const newQuoteId = result.lastInsertRowid;

    // If linked to a technical visit, mark that visit as 'cotizada' so it passes to history!
    if (validVisitId) {
      try {
        db.prepare(`
          UPDATE technical_visits 
          SET status = 'cotizada', quote_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newQuoteId, validVisitId);
      } catch (errVisit) {
        console.warn('Could not link visit:', errVisit.message);
      }
    }

    // Create initial follow-up record
    try {
      db.prepare(`
        INSERT INTO followups (quote_id, client_id, user_id, interaction_type, interest_score, comments, action_taken, next_followup_date)
        VALUES (?, ?, ?, 'llamada', ?, ?, 'reprogramar', ?)
      `).run(
        newQuoteId,
        client.id,
        quoteUserId,
        interest_score || 7,
        `Cotización ${quoteCode} generada. Próximo contacto programado para el ${followup_date}.`,
        followup_date
      );
    } catch (errFollow) {
      console.warn('Could not record initial followup:', errFollow.message);
    }

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CREAR',
      module: 'cotizaciones',
      entityType: 'Cotización',
      entityId: quoteCode,
      description: `Cotización ${quoteCode} creada para ${client.name} por $${Math.round(total_price || 0).toLocaleString('es-CO')}`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.status(201).json({
      message: 'Cotización creada exitosamente',
      id: newQuoteId,
      quote_code: quoteCode
    });
  } catch (error) {
    console.error('Error creating quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quote details
router.put('/:id', authenticateToken, requirePermission('quotes'), (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
    if (!existing) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const {
      client_id, system_type, interest_score, followup_date,
      client_consumption_kwh, radiation_coefficient, required_power_kwp,
      panel_model_id, panel_power_w, panel_unit_price, suggested_panels,
      installed_panels, installed_power_kwp,
      selected_inverters, selected_batteries, selected_pumps,
      mdo_unit_price, mdo_total, structure_type, structure_unit_price, structure_total,
      panels_total, inverters_total, batteries_total, pumps_total,
      legalization_included, legalization_design_price, legalization_tramite_price,
      legalization_bidi_price, legalization_retie_price, caja_ac_price, accessories_price,
      legalization_total, subtotal, discount_percent, discount_amount, total_price,
      financing_down_payment_percent, financing_down_payment_amount, financing_amount,
      financing_term_months, financing_monthly_fee, financing_monthly_rate, visit_id, notes
    } = req.body;

    // Safe client_id check
    let validClientId = existing.client_id;
    if (client_id) {
      const c = db.prepare('SELECT id FROM clients WHERE id = ?').get(parseInt(client_id, 10));
      if (c) validClientId = c.id;
    }

    // Safe panel_model_id check
    let validPanelModelId = null;
    if (panel_model_id !== undefined) {
      if (panel_model_id) {
        const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(parseInt(panel_model_id, 10));
        if (prod) validPanelModelId = prod.id;
      }
    } else {
      validPanelModelId = existing.panel_model_id;
    }

    // Safe visit_id check
    let validVisitId = null;
    if (visit_id !== undefined) {
      if (visit_id) {
        const v = db.prepare('SELECT id FROM technical_visits WHERE id = ?').get(parseInt(visit_id, 10));
        if (v) validVisitId = v.id;
      }
    } else {
      validVisitId = existing.visit_id;
    }

    db.prepare(`
      UPDATE quotes SET
        client_id = ?, system_type = ?, interest_score = ?, followup_date = ?,
        client_consumption_kwh = ?, radiation_coefficient = ?, required_power_kwp = ?,
        panel_model_id = ?, panel_power_w = ?, panel_unit_price = ?, suggested_panels = ?,
        installed_panels = ?, installed_power_kwp = ?,
        selected_inverters_json = ?, selected_batteries_json = ?, selected_pumps_json = ?,
        mdo_unit_price = ?, mdo_total = ?, structure_type = ?, structure_unit_price = ?, structure_total = ?,
        panels_total = ?, inverters_total = ?, batteries_total = ?, pumps_total = ?,
        legalization_included = ?, legalization_design_price = ?, legalization_tramite_price = ?,
        legalization_bidi_price = ?, legalization_retie_price = ?, caja_ac_price = ?, accessories_price = ?,
        legalization_total = ?, subtotal = ?, discount_percent = ?, discount_amount = ?, total_price = ?,
        financing_down_payment_percent = ?, financing_down_payment_amount = ?, financing_amount = ?,
        financing_term_months = ?, financing_monthly_fee = ?, financing_monthly_rate = ?,
        visit_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      validClientId,
      system_type || existing.system_type,
      interest_score !== undefined ? parseInt(interest_score) : existing.interest_score,
      followup_date || existing.followup_date,
      client_consumption_kwh !== undefined ? parseFloat(client_consumption_kwh) : existing.client_consumption_kwh,
      radiation_coefficient !== undefined ? parseFloat(radiation_coefficient) : existing.radiation_coefficient,
      required_power_kwp !== undefined ? parseFloat(required_power_kwp) : existing.required_power_kwp,
      validPanelModelId,
      panel_power_w !== undefined ? parseFloat(panel_power_w) : existing.panel_power_w,
      panel_unit_price !== undefined ? parseFloat(panel_unit_price) : existing.panel_unit_price,
      suggested_panels !== undefined ? parseInt(suggested_panels) : existing.suggested_panels,
      installed_panels !== undefined ? parseInt(installed_panels) : existing.installed_panels,
      installed_power_kwp !== undefined ? parseFloat(installed_power_kwp) : existing.installed_power_kwp,
      selected_inverters !== undefined ? JSON.stringify(selected_inverters) : existing.selected_inverters_json,
      selected_batteries !== undefined ? JSON.stringify(selected_batteries) : existing.selected_batteries_json,
      selected_pumps !== undefined ? JSON.stringify(selected_pumps) : existing.selected_pumps_json,
      mdo_unit_price !== undefined ? parseFloat(mdo_unit_price) : existing.mdo_unit_price,
      mdo_total !== undefined ? parseFloat(mdo_total) : existing.mdo_total,
      structure_type || existing.structure_type,
      structure_unit_price !== undefined ? parseFloat(structure_unit_price) : existing.structure_unit_price,
      structure_total !== undefined ? parseFloat(structure_total) : existing.structure_total,
      panels_total !== undefined ? parseFloat(panels_total) : existing.panels_total,
      inverters_total !== undefined ? parseFloat(inverters_total) : existing.inverters_total,
      batteries_total !== undefined ? parseFloat(batteries_total) : existing.batteries_total,
      pumps_total !== undefined ? parseFloat(pumps_total) : existing.pumps_total,
      legalization_included !== undefined ? (legalization_included ? 1 : 0) : existing.legalization_included,
      legalization_design_price !== undefined ? parseFloat(legalization_design_price) : existing.legalization_design_price,
      legalization_tramite_price !== undefined ? parseFloat(legalization_tramite_price) : existing.legalization_tramite_price,
      legalization_bidi_price !== undefined ? parseFloat(legalization_bidi_price) : existing.legalization_bidi_price,
      legalization_retie_price !== undefined ? parseFloat(legalization_retie_price) : existing.legalization_retie_price,
      caja_ac_price !== undefined ? parseFloat(caja_ac_price) : existing.caja_ac_price,
      accessories_price !== undefined ? parseFloat(accessories_price) : existing.accessories_price,
      legalization_total !== undefined ? parseFloat(legalization_total) : existing.legalization_total,
      subtotal !== undefined ? parseFloat(subtotal) : existing.subtotal,
      discount_percent !== undefined ? parseFloat(discount_percent) : existing.discount_percent,
      discount_amount !== undefined ? parseFloat(discount_amount) : existing.discount_amount,
      total_price !== undefined ? parseFloat(total_price) : existing.total_price,
      financing_down_payment_percent !== undefined ? parseFloat(financing_down_payment_percent) : existing.financing_down_payment_percent,
      financing_down_payment_amount !== undefined ? parseFloat(financing_down_payment_amount) : existing.financing_down_payment_amount,
      financing_amount !== undefined ? parseFloat(financing_amount) : existing.financing_amount,
      financing_term_months !== undefined ? parseInt(financing_term_months) : existing.financing_term_months,
      financing_monthly_fee !== undefined ? parseFloat(financing_monthly_fee) : existing.financing_monthly_fee,
      financing_monthly_rate !== undefined ? parseFloat(financing_monthly_rate) : existing.financing_monthly_rate,
      validVisitId,
      notes !== undefined ? notes : existing.notes,
      quoteId
    );

    // Record a followup entry to log the edit in CRM history
    try {
      const followupUserId = req.user?.id && db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id) ? req.user.id : null;
      db.prepare(`
        INSERT INTO followups (quote_id, client_id, user_id, interaction_type, interest_score, comments, action_taken, next_followup_date)
        VALUES (?, ?, ?, 'llamada', ?, ?, 'reprogramar', ?)
      `).run(
        quoteId,
        client_id ? parseInt(client_id) : existing.client_id,
        followupUserId,
        interest_score !== undefined ? parseInt(interest_score) : existing.interest_score,
        `Cotización ${existing.quote_code} editada y actualizada. Total: $${Math.round(total_price ? total_price : existing.total_price)}`,
        followup_date || existing.followup_date
      );
    } catch (errFollow) {
      console.warn('Could not log followup on quote update:', errFollow.message);
    }

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ACTUALIZAR',
      module: 'cotizaciones',
      entityType: 'Cotización',
      entityId: existing.quote_code,
      description: `Cotización ${existing.quote_code} editada y actualizada. Total: $${Math.round(total_price ? total_price : existing.total_price).toLocaleString('es-CO')}`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.json({
      message: 'Cotización actualizada exitosamente',
      id: quoteId,
      quote_code: existing.quote_code
    });
  } catch (error) {
    console.error('Error updating quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quote status
router.patch('/:id/status', authenticateToken, requirePermission('quotes'), (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    const { status, desist_reason } = req.body;

    const validStatuses = ['pendiente', 'aprobada', 'ganada', 'desistida', 'rechazada', 'revision'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Estado no válido. Estados permitidos: ${validStatuses.join(', ')}` });
    }

    const quoteBefore = db.prepare('SELECT client_id, quote_code FROM quotes WHERE id = ?').get(quoteId);

    db.prepare(`
      UPDATE quotes 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, quoteId);

    const followupUserId = req.user?.id && db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id) ? req.user.id : null;

    if (status === 'desistida' && desist_reason) {
      if (quoteBefore) {
        db.prepare(`
          INSERT INTO followups (quote_id, client_id, user_id, interaction_type, interest_score, comments, action_taken, desist_reason)
          VALUES (?, ?, ?, 'llamada', 1, ?, 'desiste', ?)
        `).run(quoteId, quoteBefore.client_id, followupUserId, `Cliente desiste del proyecto. Motivo: ${desist_reason}`, desist_reason);
      }
    } else if (status === 'ganada') {
      if (quoteBefore) {
        db.prepare(`
          INSERT INTO followups (quote_id, client_id, user_id, interaction_type, interest_score, comments, action_taken)
          VALUES (?, ?, ?, 'reunion', 10, ?, 'cierre_exitoso')
        `).run(quoteId, quoteBefore.client_id, followupUserId, `¡Proyecto ganado! Cotización ${quoteBefore.quote_code} aprobada por el cliente. Pendiente elaboración de contrato.`);
      }
    }

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CAMBIO_ESTADO',
      module: 'cotizaciones',
      entityType: 'Cotización',
      entityId: quoteBefore?.quote_code || String(quoteId),
      description: `Estado de cotización ${quoteBefore?.quote_code || quoteId} actualizado a "${status.toUpperCase()}"`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.json({ message: 'Estado de la cotización actualizado exitosamente', status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete quote (Admin only + protection against destroying contracts)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    const existing = db.prepare('SELECT id, quote_code FROM quotes WHERE id = ?').get(quoteId);
    if (!existing) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    // Check for associated contract
    const contract = db.prepare('SELECT id, contract_code FROM contracts WHERE quote_id = ?').get(quoteId);
    if (contract && req.query.force !== 'true') {
      return res.status(400).json({
        error: `La cotización ${existing.quote_code} está vinculada al contrato de obra ${contract.contract_code}. Para evitar pérdida de trazabilidad legal, confirme la eliminación forzada.`,
        requiresForce: true
      });
    }

    // 1. Unlink any technical visits that point to this quote
    db.prepare(`
      UPDATE technical_visits 
      SET quote_id = NULL, status = 'completada', updated_at = CURRENT_TIMESTAMP 
      WHERE quote_id = ?
    `).run(quoteId);

    // 2. Unlink any contracts pointing to this quote
    db.prepare('UPDATE contracts SET quote_id = NULL WHERE quote_id = ?').run(quoteId);

    // 3. Delete all followups associated with this quote
    db.prepare('DELETE FROM followups WHERE quote_id = ?').run(quoteId);

    // 4. Delete the quote
    db.prepare('DELETE FROM quotes WHERE id = ?').run(quoteId);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR',
      module: 'cotizaciones',
      entityType: 'Cotización',
      entityId: existing.quote_code,
      description: `Cotización ${existing.quote_code} eliminada del sistema`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.json({ message: `Cotización ${existing.quote_code} eliminada exitosamente` });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

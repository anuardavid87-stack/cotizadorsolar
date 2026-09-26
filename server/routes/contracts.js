import express from 'express';
import { db, recordAuditLog } from '../db.js';
import { authenticateToken, requirePermission, requireAdmin } from './auth.js';
import { generateNextExpedienteCode } from './legalizations.js';

const router = express.Router();

// Helper to generate next contract code like CTR-2026-001
function generateNextContractCode() {
  const currentYear = new Date().getFullYear();
  const prefix = `CTR-${currentYear}-`;

  const lastContract = db.prepare(`
    SELECT contract_code FROM contracts 
    WHERE contract_code LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextSeq = 1;
  if (lastContract) {
    const parts = lastContract.contract_code.split('-');
    const seq = parseInt(parts[2], 10);
    nextSeq = isNaN(seq) ? 1 : seq + 1;
  }
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (db.prepare('SELECT id FROM contracts WHERE contract_code = ?').get(candidate)) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

// GET /api/contracts/pending-quotes - Won quotes awaiting a contract
router.get('/pending-quotes', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {
    const pendingQuotes = db.prepare(`
      SELECT q.id as quote_id, q.quote_code, q.system_type, q.installed_power_kwp, q.installed_panels,
             q.total_price, q.created_at, q.updated_at,
             c.id as client_id, c.name as client_name, c.doc_type as client_doc_type,
             c.doc_number as client_doc_number, c.phone as client_phone, c.email as client_email,
             c.city as client_city, c.address as client_address,
             u.name as advisor_name
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN contracts ct ON q.id = ct.quote_id
      WHERE q.status IN ('aprobada', 'ganada') AND ct.id IS NULL
      ORDER BY q.updated_at DESC
    `).all();

    res.json({ pendingQuotes });
  } catch (error) {
    console.error('Error fetching pending contract quotes:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contracts - List contracts with filters and stats
router.get('/', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {
    const { status, client_id, search } = req.query;

    let query = `
      SELECT ct.*, 
             c.name as client_name, c.doc_type as client_doc_type, c.doc_number as client_doc_number,
             c.phone as client_phone, c.email as client_email, c.city as client_city, c.address as client_address,
             q.quote_code, q.system_type as quote_system_type, q.installed_power_kwp as quote_power_kwp,
             u.name as advisor_name
      FROM contracts ct
      JOIN clients c ON ct.client_id = c.id
      LEFT JOIN quotes q ON ct.quote_id = q.id
      LEFT JOIN users u ON ct.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND ct.status = ?';
      params.push(status);
    }

    if (client_id) {
      query += ' AND ct.client_id = ?';
      params.push(client_id);
    }

    if (search && search.trim() !== '') {
      query += ` AND (c.name LIKE ? OR c.doc_number LIKE ? OR ct.contract_code LIKE ? OR q.quote_code LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY ct.id DESC';

    const contracts = db.prepare(query).all(...params);

    // Calculate quick stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'borrador' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'firmado' THEN 1 END) as signed_count,
        COUNT(CASE WHEN status = 'en_ejecucion' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'finalizado' THEN 1 END) as completed_count,
        COALESCE(SUM(total_contract_value), 0) as total_value,
        COALESCE(SUM(down_payment_amount), 0) as total_down_payment,
        COALESCE(SUM(financed_amount), 0) as total_financed
      FROM contracts
    `).get();

    stats.pending_count = db.prepare(`
      SELECT COUNT(*) as c
      FROM quotes q
      LEFT JOIN contracts ct ON q.id = ct.quote_id
      WHERE q.status IN ('aprobada', 'ganada') AND ct.id IS NULL
    `).get().c;

    res.json({ contracts, stats });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contracts/quote/:quoteId - Get contract for a quote
router.get('/quote/:quoteId', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    const contract = db.prepare(`
      SELECT ct.*, c.name as client_name, q.quote_code
      FROM contracts ct
      JOIN clients c ON ct.client_id = c.id
      LEFT JOIN quotes q ON ct.quote_id = q.id
      WHERE ct.quote_id = ?
      LIMIT 1
    `).get(quoteId);

    if (!contract) {
      return res.status(404).json({ error: 'No existe contrato para esta cotización.' });
    }

    res.json({ contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contracts/:id - Get single contract with full details & company settings
router.get('/:id', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const contract = db.prepare(`
      SELECT ct.*, 
             c.name as client_name, c.doc_type as client_doc_type, c.doc_number as client_doc_number,
             c.phone as client_phone, c.email as client_email, c.city as client_city, c.department as client_department,
             c.address as client_address, c.operator as client_operator,
             q.quote_code, q.system_type as quote_system_type, q.installed_power_kwp, q.installed_panels,
             q.panel_power_w, q.structure_type, COALESCE(ct.legalization_included, q.legalization_included, 1) as legalization_included,
             q.selected_inverters_json, q.selected_batteries_json, q.selected_pumps_json,
             u.name as advisor_name, u.email as advisor_email
      FROM contracts ct
      JOIN clients c ON ct.client_id = c.id
      LEFT JOIN quotes q ON ct.quote_id = q.id
      LEFT JOIN users u ON ct.user_id = u.id
      WHERE ct.id = ?
    `).get(contractId);

    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado.' });
    }

    const settings = db.prepare('SELECT * FROM company_settings WHERE is_default = 1 UNION SELECT * FROM company_settings WHERE id = 1 LIMIT 1').get() || {};

    res.json({ contract, settings });
  } catch (error) {
    console.error('Error fetching contract details:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contracts - Create new contract from quote
router.post('/', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {

    const {
      quote_id, client_id, contract_date,
      legalization_included,
      total_contract_value, down_payment_amount, financed_amount,
      has_interest, monthly_interest_rate, installments_count,
      first_installment_date, installments_schedule, is_custom_schedule,
      execution_time_days, warranty_years_panels, warranty_years_inverter,
      warranty_years_installation, equipment_summary,
      contractor_rep_name, contractor_rep_doc, custom_clauses, notes
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'El cliente es obligatorio.' });
    }

    const totalVal = parseFloat(total_contract_value) || 0;
    const downPay = parseFloat(down_payment_amount) || 0;
    const financed = parseFloat(financed_amount) || Math.max(0, totalVal - downPay);

    const contractCode = generateNextContractCode();
    const today = new Date().toISOString().split('T')[0];

    const quoteRow = quote_id ? db.prepare('SELECT installed_power_kwp, system_type, legalization_included FROM quotes WHERE id = ?').get(parseInt(quote_id)) : null;
    const finalLegIncluded = legalization_included !== undefined 
      ? (legalization_included ? 1 : 0) 
      : (quoteRow?.legalization_included !== undefined ? quoteRow.legalization_included : 1);

    const insertStmt = db.prepare(`
      INSERT INTO contracts (
        contract_code, quote_id, client_id, user_id, contract_date, status, legalization_included,
        total_contract_value, down_payment_amount, financed_amount,
        has_interest, monthly_interest_rate, installments_count,
        first_installment_date, installments_schedule_json, is_custom_schedule,
        execution_time_days, warranty_years_panels, warranty_years_inverter,
        warranty_years_installation, equipment_summary_json,
        contractor_rep_name, contractor_rep_doc, custom_clauses, notes
      ) VALUES (
        ?, ?, ?, ?, ?, 'borrador', ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      contractCode,
      quote_id ? parseInt(quote_id) : null,
      parseInt(client_id),
      req.user.id,
      contract_date || today,
      finalLegIncluded,
      totalVal,
      downPay,
      financed,
      has_interest ? 1 : 0,
      parseFloat(monthly_interest_rate) || 0,
      parseInt(installments_count) || 1,
      first_installment_date || null,
      JSON.stringify(installments_schedule || []),
      is_custom_schedule ? 1 : 0,
      parseInt(execution_time_days) || 45,
      parseInt(warranty_years_panels) || 25,
      parseInt(warranty_years_inverter) || 5,
      parseInt(warranty_years_installation) || 2,
      JSON.stringify(equipment_summary || {}),
      contractor_rep_name || 'Representante Legal Renova Energy',
      contractor_rep_doc || 'NIT 901.482.915-1',
      custom_clauses || '',
      notes || ''
    );

    const newContractId = result.lastInsertRowid;

    // Update quote status to 'aprobada' if linked
    if (quote_id) {
      db.prepare(`
        UPDATE quotes 
        SET status = 'aprobada', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(parseInt(quote_id));

      // Log in followups
      try {
        db.prepare(`
          INSERT INTO followups (quote_id, client_id, user_id, interaction_type, interest_score, comments, action_taken)
          VALUES (?, ?, ?, 'reunion', 10, ?, 'ganado')
        `).run(
          parseInt(quote_id),
          parseInt(client_id),
          req.user.id,
          `Contrato ${contractCode} generado exitosamente por valor total de $${Math.round(totalVal).toLocaleString('es-CO')}. Cuota inicial: $${Math.round(downPay).toLocaleString('es-CO')}, Plazo: ${installments_count} cuotas.`
        );
      } catch (errFollow) {
        console.warn('Could not log followup for contract creation:', errFollow.message);
      }
    }

    // Record audit log
    recordAuditLog({
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      action: 'CREAR',
      module: 'contratos',
      entityType: 'Contrato',
      entityId: contractCode,
      description: `Creación de contrato ${contractCode} con valor total de $${totalVal} (${finalLegIncluded ? 'con legalización' : 'sin legalización'})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Automatically create network legalization dossier for this contract ONLY IF legalization is included
    let createdExpedienteCode = null;
    if (finalLegIncluded === 1) {
      try {
        const existingDossier = db.prepare('SELECT id, expediente_code FROM network_legalizations WHERE contract_id = ?').get(newContractId);
        if (!existingDossier) {
          createdExpedienteCode = generateNextExpedienteCode();
          const clientRow = db.prepare('SELECT id, name, operator, COALESCE(nic_number, "") as nic_number FROM clients WHERE id = ?').get(parseInt(client_id));

          db.prepare(`
            INSERT INTO network_legalizations (
              expediente_code, contract_id, client_id, user_id,
              operator, status, nic_number,
              installed_power_kwp, system_type, general_notes
            ) VALUES (?, ?, ?, ?, ?, 'en_tramite', ?, ?, ?, ?)
          `).run(
            createdExpedienteCode,
            newContractId,
            parseInt(client_id),
            req.user.id,
            clientRow?.operator || 'Afinia',
            clientRow?.nic_number || '',
            quoteRow?.installed_power_kwp || 0,
            quoteRow?.system_type || 'ongrid',
            `Expediente aperturado automáticamente al formalizar el contrato ${contractCode}`
          );

          recordAuditLog({
            userId: req.user.id,
            userName: req.user.name || req.user.username,
            action: 'APERTURA_AUTOMATICA_EXPEDIENTE',
            module: 'legalizaciones',
            entityType: 'Expediente Legalización',
            entityId: createdExpedienteCode,
            description: `Expediente ${createdExpedienteCode} generado automáticamente al guardar y formalizar contrato ${contractCode} para cliente ${clientRow?.name || 'ID ' + client_id}`,
            ip: req.ip || req.headers['x-forwarded-for']
          });
        } else {
          createdExpedienteCode = existingDossier.expediente_code;
        }
      } catch (legErr) {
        console.warn('[Auto-Legalization Notice]:', legErr.message);
      }
    }

    res.status(201).json({
      message: 'Contrato creado exitosamente y expediente de legalización aperturado',
      id: newContractId,
      contract_code: contractCode,
      expediente_code: createdExpedienteCode
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/contracts/:id - Update contract terms & schedule
router.put('/:id', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
    if (!existing) {
      return res.status(404).json({ error: 'Contrato no encontrado.' });
    }

    const {
      contract_date, status, legalization_included,
      total_contract_value, down_payment_amount, financed_amount,
      has_interest, monthly_interest_rate, installments_count,
      first_installment_date, installments_schedule, is_custom_schedule,
      execution_time_days, warranty_years_panels, warranty_years_inverter,
      warranty_years_installation, equipment_summary,
      contractor_rep_name, contractor_rep_doc, custom_clauses, notes
    } = req.body;

    const totalVal = parseFloat(total_contract_value) !== undefined ? parseFloat(total_contract_value) : existing.total_contract_value;
    const downPay = parseFloat(down_payment_amount) !== undefined ? parseFloat(down_payment_amount) : existing.down_payment_amount;
    const financed = parseFloat(financed_amount) !== undefined ? parseFloat(financed_amount) : existing.financed_amount;
    const finalLegIncluded = legalization_included !== undefined ? (legalization_included ? 1 : 0) : (existing.legalization_included !== undefined ? existing.legalization_included : 1);

    db.prepare(`
      UPDATE contracts SET
        contract_date = ?, status = ?, legalization_included = ?,
        total_contract_value = ?, down_payment_amount = ?, financed_amount = ?,
        has_interest = ?, monthly_interest_rate = ?, installments_count = ?,
        first_installment_date = ?, installments_schedule_json = ?, is_custom_schedule = ?,
        execution_time_days = ?, warranty_years_panels = ?, warranty_years_inverter = ?,
        warranty_years_installation = ?, equipment_summary_json = ?,
        contractor_rep_name = ?, contractor_rep_doc = ?, custom_clauses = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      contract_date || existing.contract_date,
      status || existing.status,
      finalLegIncluded,
      totalVal,
      downPay,
      financed,
      has_interest !== undefined ? (has_interest ? 1 : 0) : existing.has_interest,
      monthly_interest_rate !== undefined ? parseFloat(monthly_interest_rate) : existing.monthly_interest_rate,
      installments_count ? parseInt(installments_count) : existing.installments_count,
      first_installment_date || existing.first_installment_date,
      installments_schedule ? JSON.stringify(installments_schedule) : existing.installments_schedule_json,
      is_custom_schedule !== undefined ? (is_custom_schedule ? 1 : 0) : existing.is_custom_schedule,
      execution_time_days ? parseInt(execution_time_days) : existing.execution_time_days,
      warranty_years_panels ? parseInt(warranty_years_panels) : existing.warranty_years_panels,
      warranty_years_inverter ? parseInt(warranty_years_inverter) : existing.warranty_years_inverter,
      warranty_years_installation ? parseInt(warranty_years_installation) : existing.warranty_years_installation,
      equipment_summary ? JSON.stringify(equipment_summary) : existing.equipment_summary_json,
      contractor_rep_name || existing.contractor_rep_name,
      contractor_rep_doc || existing.contractor_rep_doc,
      custom_clauses !== undefined ? custom_clauses : existing.custom_clauses,
      notes !== undefined ? notes : existing.notes,
      contractId
    );

    // Ensure network legalization dossier exists for this contract ONLY IF legalization is included
    if (finalLegIncluded === 1) {
      try {
        const existingDossier = db.prepare('SELECT id, expediente_code FROM network_legalizations WHERE contract_id = ?').get(contractId);
        if (!existingDossier) {
          const expedienteCode = generateNextExpedienteCode();
          const clientRow = db.prepare('SELECT id, name, operator, COALESCE(nic_number, "") as nic_number FROM clients WHERE id = ?').get(existing.client_id);
          const quoteRow = existing.quote_id ? db.prepare('SELECT installed_power_kwp, system_type FROM quotes WHERE id = ?').get(existing.quote_id) : null;

          db.prepare(`
            INSERT INTO network_legalizations (
              expediente_code, contract_id, client_id, user_id,
              operator, status, nic_number,
              installed_power_kwp, system_type, general_notes
            ) VALUES (?, ?, ?, ?, ?, 'en_tramite', ?, ?, ?, ?)
          `).run(
            expedienteCode,
            contractId,
            existing.client_id,
            req.user.id,
            clientRow?.operator || 'Afinia',
            clientRow?.nic_number || '',
            quoteRow?.installed_power_kwp || 0,
            quoteRow?.system_type || 'ongrid',
            `Expediente aperturado al actualizar/formalizar contrato ${existing.contract_code}`
          );

          recordAuditLog({
            userId: req.user.id,
            userName: req.user.name || req.user.username,
            action: 'APERTURA_AUTOMATICA_EXPEDIENTE',
            module: 'legalizaciones',
            entityType: 'Expediente Legalización',
            entityId: expedienteCode,
            description: `Expediente ${expedienteCode} generado automáticamente al actualizar contrato ${existing.contract_code}`,
            ip: req.ip || req.headers['x-forwarded-for']
          });
        }
      } catch (legErr) {
        console.warn('[Auto-Legalization Notice on Update]:', legErr.message);
      }
    }

    res.json({
      message: 'Contrato actualizado exitosamente y expediente verificado',
      id: contractId,
      contract_code: existing.contract_code
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/contracts/:id/status - Update contract status
router.patch('/:id/status', authenticateToken, requirePermission('contracts'), (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['borrador', 'firmado', 'en_ejecucion', 'finalizado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado de contrato no válido.' });
    }

    db.prepare(`
      UPDATE contracts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, contractId);

    res.json({ message: `Estado del contrato actualizado a: ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/contracts/:id - Delete contract (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const existing = db.prepare('SELECT id, contract_code FROM contracts WHERE id = ?').get(contractId);
    if (!existing) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const legalization = db.prepare('SELECT id, expediente_code FROM network_legalizations WHERE contract_id = ?').get(contractId);
    if (legalization && req.query.force !== 'true') {
      return res.status(400).json({
        error: `El contrato ${existing.contract_code} está vinculado al expediente de legalización ${legalization.expediente_code}. Para evitar inconsistencias de legalización, confirme la eliminación forzada.`,
        requiresForce: true
      });
    }

    // Unlink legalization if forced
    if (legalization) {
      db.prepare('UPDATE network_legalizations SET contract_id = NULL WHERE contract_id = ?').run(contractId);
    }

    db.prepare('DELETE FROM contracts WHERE id = ?').run(contractId);
    res.json({ message: `Contrato ${existing.contract_code} eliminado exitosamente.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

import express from 'express';
import { db, recordAuditLog, syncToSupabase } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

// Role middleware: admin, tecnico, or roles with legalizations permission
function requireLegalizationAccess(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'tecnico') {
    return next();
  }
  try {
    const roleRow = db.prepare('SELECT permissions_json FROM roles WHERE slug = ?').get(req.user?.role);
    if (roleRow && roleRow.permissions_json) {
      const perms = JSON.parse(roleRow.permissions_json);
      if (Array.isArray(perms) && perms.includes('legalizations')) {
        return next();
      }
    }
  } catch (err) {}

  return res.status(403).json({
    error: 'Acceso denegado: El módulo de legalizaciones ante el operador de red está reservado para Administradores, Técnicos o usuarios autorizados.'
  });
}

// Generate next code: LEG-YYYY-NNN
export function generateNextExpedienteCode() {
  const currentYear = new Date().getFullYear();
  const prefix = `LEG-${currentYear}-`;
  const rows = db.prepare('SELECT expediente_code FROM network_legalizations WHERE expediente_code LIKE ?').all(`${prefix}%`);
  let maxSeq = 0;
  for (const r of rows) {
    if (r.expediente_code) {
      const parts = r.expediente_code.split('-');
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (db.prepare('SELECT id FROM network_legalizations WHERE expediente_code = ?').get(candidate)) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

// Definition of the 9 regulatory & engineering steps
export const LEGALIZATION_STEPS = [
  { num: 1, key: 'docs', field: 'step1_docs_ok', title: '1. Documentos Básicos del Cliente' },
  { num: 2, key: 'renova', field: 'step_renova_ok', title: '2. Diseño e Información Renova' },
  { num: 3, key: 'designs', field: 'step2_designs_ok', title: '3. Diseños de Ingeniería' },
  { num: 4, key: 'retie', field: 'step3_retie_ok', title: '4. Certificación RETIE' },
  { num: 5, key: 'radication', field: 'step4_radication_ok', title: '5. Radicación ante el Operador' },
  { num: 6, key: 'approval', field: 'step5_approval_ok', title: '6. Aprobación del Operador de Red' },
  { num: 7, key: 'visit', field: 'step6_visit_ok', title: '7. Visita Técnica del Operador' },
  { num: 8, key: 'meter', field: 'step7_meter_ok', title: '8. Instalación del Medidor Bidireccional' },
  { num: 9, key: 'agpe', field: 'step8_agpe_ok', title: '9. Carta AGPE Final' }
];

export function enrichDossier(d) {
  let completedSteps = 0;
  for (const step of LEGALIZATION_STEPS) {
    if (d[step.field] === 1 || d[step.field] === true) {
      completedSteps++;
    }
  }

  // Determine last activity timestamp
  const dateCandidates = [
    d.step8_agpe_date,
    d.step7_meter_date,
    d.step6_visit_date,
    d.step5_approval_date,
    d.step4_radication_date,
    d.step3_retie_date,
    d.step2_designs_date,
    d.step_renova_date,
    d.step1_docs_date,
    d.updated_at,
    d.created_at
  ].filter(Boolean);

  let lastActivityDate = null;
  let maxTimestamp = 0;
  for (const dateStr of dateCandidates) {
    const t = new Date(dateStr).getTime();
    if (!isNaN(t) && t > maxTimestamp) {
      maxTimestamp = t;
      lastActivityDate = dateStr;
    }
  }

  const now = Date.now();
  let daysInactive = 0;
  let isStagnant = false;

  if (maxTimestamp > 0) {
    daysInactive = Math.max(0, Math.floor((now - maxTimestamp) / (1000 * 60 * 60 * 24)));
  }

  // Flag as stagnant if not finished and 15+ days without any progress
  if (d.status !== 'finalizado_agpe' && daysInactive >= 15) {
    isStagnant = true;
  }

  return {
    ...d,
    completed_steps: completedSteps,
    total_steps: LEGALIZATION_STEPS.length,
    progress_percentage: Math.round((completedSteps / LEGALIZATION_STEPS.length) * 100),
    days_inactive: daysInactive,
    is_stagnant: isStagnant,
    last_activity_date: lastActivityDate
  };
}

// GET /api/legalizations - List with filters
router.get('/', authenticateToken, requireLegalizationAccess, (req, res) => {
  try {
    const { status, operator, search } = req.query;
    let query = `
      SELECT l.*,
             c.name as client_name, c.phone as client_phone, c.email as client_email,
             c.city as client_city, c.department as client_department, c.doc_number as client_doc,
             ct.contract_code, ct.contract_date, ct.total_contract_value,
             u.name as engineer_name
      FROM network_legalizations l
      JOIN clients c ON l.client_id = c.id
      LEFT JOIN contracts ct ON l.contract_id = ct.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND l.status = ?';
      params.push(status);
    }

    if (operator && operator !== 'all') {
      query += ' AND l.operator = ?';
      params.push(operator);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (
        c.name LIKE ? OR c.phone LIKE ? OR c.city LIKE ? OR
        l.expediente_code LIKE ? OR l.radicado_number LIKE ? OR l.nic_number LIKE ? OR
        ct.contract_code LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term);
    }

    query += ' ORDER BY l.id DESC';

    const dossiers = db.prepare(query).all(...params);
    const enriched = dossiers.map(enrichDossier);

    res.json({ dossiers: enriched });
  } catch (error) {
    console.error('Error in GET /api/legalizations:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legalizations/stats - Internal reports & alerts (not in general dashboard)
router.get('/stats', authenticateToken, requireLegalizationAccess, (req, res) => {
  try {
    const dossiers = db.prepare(`
      SELECT l.*, c.name as client_name, c.city as client_city, ct.contract_code
      FROM network_legalizations l
      JOIN clients c ON l.client_id = c.id
      LEFT JOIN contracts ct ON l.contract_id = ct.id
      ORDER BY l.id DESC
    `).all();

    const total = dossiers.length;
    let enTramite = 0;
    let finalizadosAgpe = 0;
    let detenidos = 0;
    let stagnantCount = 0;

    const stepProgress = {
      step1: 0,
      step2: 0,
      step3: 0,
      step4: 0,
      step5: 0,
      step6: 0,
      step7: 0,
      step8: 0,
      step9: 0
    };

    const operatorCounts = {};
    const internalAlerts = [];

    const enrichedDossiers = dossiers.map(enrichDossier);

    enrichedDossiers.forEach(d => {
      if (d.status === 'finalizado_agpe') finalizadosAgpe++;
      else if (d.status === 'detenido') detenidos++;
      else enTramite++;

      if (d.is_stagnant) {
        stagnantCount++;
        internalAlerts.push({
          id: `alert-stagnant-${d.id}`,
          dossier_id: d.id,
          code: d.expediente_code,
          client_name: d.client_name,
          type: 'urgent',
          step: 'Alerta de Inactividad (>15 días)',
          message: `Lleva ${d.days_inactive} días sin registrar avance o actualización. Requiere gestión prioritaria.`
        });
      }

      const op = d.operator || 'Afinia';
      operatorCounts[op] = (operatorCounts[op] || 0) + 1;

      // Check steps (9 steps)
      if (d.step1_docs_ok) stepProgress.step1++;
      if (d.step_renova_ok) stepProgress.step2++;
      if (d.step2_designs_ok) stepProgress.step3++;
      if (d.step3_retie_ok) stepProgress.step4++;
      if (d.step4_radication_ok) stepProgress.step5++;
      if (d.step5_approval_ok) stepProgress.step6++;
      if (d.step6_visit_ok) stepProgress.step7++;
      if (d.step7_meter_ok) stepProgress.step8++;
      if (d.step8_agpe_ok) stepProgress.step9++;

      // Compute internal sequential step alert if not finalized
      if (d.status !== 'finalizado_agpe') {
        if (!d.step1_docs_ok) {
          internalAlerts.push({
            id: `alert-docs-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'warning',
            step: 'Paso 1: Documentos Básicos',
            message: 'Pendiente recolección de documentos básicos del cliente (cédula, factura, certificado de tradición).'
          });
        } else if (!d.step_renova_ok) {
          internalAlerts.push({
            id: `alert-renova-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'warning',
            step: 'Paso 2: Diseño e Información Renova',
            message: 'Pendiente consolidación de diagramas internos Renova, ficha técnica de equipos y memoria técnica del sistema.'
          });
        } else if (!d.step2_designs_ok) {
          internalAlerts.push({
            id: `alert-designs-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'info',
            step: 'Paso 3: Diseños de Ingeniería',
            message: 'Pendiente elaboración o visto bueno de planos unifilares y memorias de cálculo ante el OR.'
          });
        } else if (!d.step3_retie_ok) {
          internalAlerts.push({
            id: `alert-retie-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'warning',
            step: 'Paso 4: Certificación RETIE',
            message: 'Pendiente dictamen de inspección técnica RETIE del organismo evaluador.'
          });
        } else if (!d.step4_radication_ok) {
          internalAlerts.push({
            id: `alert-rad-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'urgent',
            step: 'Paso 5: Radicación ante Operador',
            message: `Listo para radicar ante el operador ${d.operator}. Asignar número de radicado.`
          });
        } else if (!d.step5_approval_ok) {
          internalAlerts.push({
            id: `alert-appr-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'info',
            step: 'Paso 6: Aprobación del Operador',
            message: `Radicado en trámite ante ${d.operator}. En espera de concepto de conexión favorable.`
          });
        } else if (!d.step6_visit_ok) {
          internalAlerts.push({
            id: `alert-visit-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'warning',
            step: 'Paso 7: Visita Técnica de Operador',
            message: `Aprobado en revisión documental. Pendiente programar visita de recibo de obra por ${d.operator}.`
          });
        } else if (!d.step7_meter_ok) {
          internalAlerts.push({
            id: `alert-meter-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'urgent',
            step: 'Paso 8: Medidor Bidireccional',
            message: 'Pendiente instalación y parametrización de medida bidireccional.'
          });
        } else if (!d.step8_agpe_ok) {
          internalAlerts.push({
            id: `alert-agpe-${d.id}`,
            dossier_id: d.id,
            code: d.expediente_code,
            client_name: d.client_name,
            type: 'info',
            step: 'Paso 9: Carta AGPE Final',
            message: 'Medidor instalado. Pendiente expedición de Carta / Acta de puesta en servicio AGPE.'
          });
        }
      }
    });

    res.json({
      total,
      en_tramite: enTramite,
      finalizados_agpe: finalizadosAgpe,
      detenidos,
      stagnant_count: stagnantCount,
      step_progress: stepProgress,
      operator_counts: operatorCounts,
      internal_alerts: internalAlerts
    });
  } catch (error) {
    console.error('Error in GET /api/legalizations/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legalizations/eligible-contracts - Contracts ready for legalization
router.get('/eligible-contracts', authenticateToken, requireLegalizationAccess, (req, res) => {
  try {
    const includeDismissed = req.query.include_dismissed === 'true';
    let query = `
      SELECT ct.id as contract_id, ct.contract_code, ct.contract_date, ct.status as contract_status,
             ct.total_contract_value, ct.legalization_included, ct.legalization_alert_dismissed,
             c.id as client_id, c.name as client_name, c.phone as client_phone, c.city as client_city,
             c.operator as client_operator,
             q.installed_power_kwp, q.system_type
      FROM contracts ct
      JOIN clients c ON ct.client_id = c.id
      LEFT JOIN quotes q ON ct.quote_id = q.id
      WHERE ct.id NOT IN (SELECT contract_id FROM network_legalizations WHERE contract_id IS NOT NULL)
        AND ct.client_id NOT IN (SELECT client_id FROM network_legalizations WHERE client_id IS NOT NULL)
        AND (ct.legalization_included IS NULL OR ct.legalization_included = 1)
    `;

    if (!includeDismissed) {
      query += ` AND (ct.legalization_alert_dismissed IS NULL OR ct.legalization_alert_dismissed = 0)`;
    }

    query += ` ORDER BY ct.id DESC`;

    const contracts = db.prepare(query).all();

    // Also count dismissed contracts for restore feature
    let dismissedCount = 0;
    try {
      const dRow = db.prepare(`
        SELECT COUNT(*) as count FROM contracts ct
        WHERE ct.id NOT IN (SELECT contract_id FROM network_legalizations WHERE contract_id IS NOT NULL)
          AND ct.client_id NOT IN (SELECT client_id FROM network_legalizations WHERE client_id IS NOT NULL)
          AND (ct.legalization_included IS NULL OR ct.legalization_included = 1)
          AND ct.legalization_alert_dismissed = 1
      `).get();
      dismissedCount = dRow?.count || 0;
    } catch (e) {}

    res.json({ eligible_contracts: contracts, dismissed_count: dismissedCount });
  } catch (error) {
    console.error('Error in GET /api/legalizations/eligible-contracts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/legalizations/dismiss-eligible-contract - Super admin dismisses proactive alert
router.post('/dismiss-eligible-contract', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { contract_id, dismiss_all } = req.body;

    if (dismiss_all) {
      const info = db.prepare(`
        UPDATE contracts 
        SET legalization_alert_dismissed = 1 
        WHERE id NOT IN (SELECT contract_id FROM network_legalizations WHERE contract_id IS NOT NULL)
      `).run();

      recordAuditLog({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username,
        action: 'DESCARTAR_AVISO',
        module: 'legalizaciones',
        entityType: 'AvisoLegalizacion',
        entityId: 'ALL',
        description: `Super Administrador descartó los avisos de contratos sin expediente (${info.changes} contrato(s) ocultados)`,
        ip: req.ip || req.headers['x-forwarded-for']
      });

      await syncToSupabase();

      return res.json({
        success: true,
        message: 'Todos los avisos de contratos sin expediente han sido descartados exitosamente.'
      });
    }

    if (!contract_id) {
      return res.status(400).json({ error: 'contract_id es requerido para descartar aviso individual.' });
    }

    const cId = parseInt(contract_id, 10);
    const contract = db.prepare('SELECT contract_code FROM contracts WHERE id = ?').get(cId);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado.' });
    }

    db.prepare('UPDATE contracts SET legalization_alert_dismissed = 1 WHERE id = ?').run(cId);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'DESCARTAR_AVISO',
      module: 'legalizaciones',
      entityType: 'AvisoLegalizacion',
      entityId: contract.contract_code,
      description: `Super Administrador descartó el aviso de legalización para el contrato ${contract.contract_code}`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    await syncToSupabase();

    res.json({
      success: true,
      message: `Aviso del contrato ${contract.contract_code} descartado exitosamente.`
    });
  } catch (error) {
    console.error('Error in dismiss-eligible-contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/legalizations/restore-eligible-contracts - Super admin restores dismissed alerts
router.post('/restore-eligible-contracts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const info = db.prepare(`
      UPDATE contracts 
      SET legalization_alert_dismissed = 0 
      WHERE legalization_alert_dismissed = 1
    `).run();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'RESTAURAR_AVISOS',
      module: 'legalizaciones',
      entityType: 'AvisoLegalizacion',
      entityId: 'ALL',
      description: `Super Administrador restauró los avisos de contratos descartados (${info.changes} contratos restaurados)`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    await syncToSupabase();

    res.json({
      success: true,
      message: `${info.changes} aviso(s) de contratos han sido restaurados con éxito.`
    });
  } catch (error) {
    console.error('Error in restore-eligible-contracts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legalizations/:id - Single dossier
router.get('/:id', authenticateToken, requireLegalizationAccess, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dossier = db.prepare(`
      SELECT l.*,
             c.name as client_name, c.phone as client_phone, c.email as client_email,
             c.city as client_city, c.department as client_department, c.doc_number as client_doc,
             c.address as client_address,
             ct.contract_code, ct.contract_date, ct.total_contract_value,
             u.name as engineer_name
      FROM network_legalizations l
      JOIN clients c ON l.client_id = c.id
      LEFT JOIN contracts ct ON l.contract_id = ct.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `).get(id);

    if (!dossier) {
      return res.status(404).json({ error: 'Expediente de legalización no encontrado.' });
    }

    res.json({ dossier: enrichDossier(dossier) });
  } catch (error) {
    console.error('Error in GET /api/legalizations/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/legalizations - Open new dossier (by contract OR client name)
router.post('/', authenticateToken, requireLegalizationAccess, async (req, res) => {
  try {
    const {
      contract_id, client_id, client_name, client_phone, client_city,
      operator, nic_number, radicado_number, transformer_code,
      installed_power_kwp, system_type, general_notes
    } = req.body;

    let finalClientId = client_id ? parseInt(client_id, 10) : null;
    let finalContractId = contract_id ? parseInt(contract_id, 10) : null;

    // Verify existing client by ID if provided
    if (finalClientId) {
      const existingClientById = db.prepare('SELECT id, name, phone, city, operator FROM clients WHERE id = ?').get(finalClientId);
      if (!existingClientById) {
        finalClientId = null;
      }
    }

    // If client_name provided and no valid client_id, find existing or create new client
    if (!finalClientId && client_name && client_name.trim() !== '') {
      const trimmedName = client_name.trim();
      const existingClient = db.prepare('SELECT id, name, phone, city, operator FROM clients WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1').get(trimmedName);
      if (existingClient) {
        finalClientId = existingClient.id;
      } else {
        const createClient = db.prepare(`
          INSERT INTO clients (name, operator, phone, city, client_type)
          VALUES (?, ?, ?, ?, 'Residencial')
        `).run(
          trimmedName,
          operator || 'Afinia',
          client_phone || '',
          client_city || 'Colombia'
        );
        finalClientId = createClient.lastInsertRowid;
      }
    }

    // If contract_id provided, verify contract and link
    let contractCode = 'Directo';
    if (finalContractId) {
      const contract = db.prepare('SELECT id, contract_code, client_id FROM contracts WHERE id = ?').get(finalContractId);
      if (!contract) {
        return res.status(404).json({ error: 'El contrato seleccionado no existe.' });
      }
      contractCode = contract.contract_code;
      if (!finalClientId) {
        finalClientId = contract.client_id;
      }

      // Check if contract already has an active dossier
      const existing = db.prepare('SELECT id, expediente_code FROM network_legalizations WHERE contract_id = ?').get(finalContractId);
      if (existing) {
        return res.status(400).json({
          error: `Este contrato ya cuenta con un expediente de legalización activo (${existing.expediente_code}).`
        });
      }
    }

    if (!finalClientId) {
      return res.status(400).json({ error: 'Debes proporcionar al menos el nombre del cliente o seleccionar un contrato para aperturar el expediente.' });
    }

    const code = generateNextExpedienteCode();
    const engineerId = req.user?.id || null;

    let parsedPower = 0;
    if (installed_power_kwp !== undefined && installed_power_kwp !== null && installed_power_kwp !== '') {
      parsedPower = typeof installed_power_kwp === 'string'
        ? parseFloat(installed_power_kwp.replace(',', '.')) || 0
        : parseFloat(installed_power_kwp) || 0;
    }

    const clientRow = db.prepare('SELECT id, name, operator FROM clients WHERE id = ?').get(finalClientId);

    const result = db.prepare(`
      INSERT INTO network_legalizations (
        expediente_code, contract_id, client_id, user_id,
        operator, status, nic_number, radicado_number, transformer_code,
        installed_power_kwp, system_type, general_notes
      ) VALUES (?, ?, ?, ?, ?, 'en_tramite', ?, ?, ?, ?, ?, ?)
    `).run(
      code,
      finalContractId,
      finalClientId,
      engineerId,
      operator || clientRow?.operator || 'Afinia',
      nic_number || clientRow?.nic_number || '',
      radicado_number || '',
      transformer_code || '',
      parsedPower,
      system_type || 'ongrid',
      general_notes || ''
    );

    // Automatically mark alert as dismissed/resolved for linked contract and client
    if (finalContractId) {
      db.prepare('UPDATE contracts SET legalization_alert_dismissed = 1 WHERE id = ?').run(finalContractId);
    }
    if (finalClientId) {
      db.prepare('UPDATE contracts SET legalization_alert_dismissed = 1 WHERE client_id = ?').run(finalClientId);
    }

    const newDossier = db.prepare(`
      SELECT l.*, c.name as client_name, ct.contract_code
      FROM network_legalizations l
      JOIN clients c ON l.client_id = c.id
      LEFT JOIN contracts ct ON l.contract_id = ct.id
      WHERE l.id = ?
    `).get(result.lastInsertRowid);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'APERTURA_EXPEDIENTE',
      module: 'legalizaciones',
      entityType: 'Expediente Legalización',
      entityId: code,
      description: `Apertura de expediente de legalización ${code} ante ${operator || 'Afinia'} para cliente ${newDossier?.client_name || 'Cliente'} ${finalContractId ? `(Contrato ${contractCode})` : '(Registro directo)'}`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    await syncToSupabase();

    res.status(201).json({
      message: `Expediente de legalización ${code} aperturado exitosamente.`,
      dossier: newDossier
    });
  } catch (error) {
    console.error('Error in POST /api/legalizations:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/legalizations/:id - Update dossier steps and details
router.put('/:id', authenticateToken, requireLegalizationAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM network_legalizations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    const {
      client_name, client_phone, client_city,
      operator, status, nic_number, radicado_number, transformer_code,
      installed_power_kwp, system_type,
      step1_docs_ok, step1_docs_comments, step1_docs_date,
      step_renova_ok, step_renova_comments, step_renova_date,
      step2_designs_ok, step2_designs_comments, step2_designs_date,
      step3_retie_ok, step3_retie_comments, step3_retie_date,
      step4_radication_ok, step4_radication_comments, step4_radication_date,
      step5_approval_ok, step5_approval_comments, step5_approval_date,
      step6_visit_ok, step6_visit_comments, step6_visit_date,
      step7_meter_ok, step7_meter_comments, step7_meter_date,
      step8_agpe_ok, step8_agpe_comments, step8_agpe_date,
      general_notes
    } = req.body;

    // Update client basic details if provided
    if (existing.client_id && (client_name || client_phone !== undefined || client_city !== undefined)) {
      try {
        db.prepare(`
          UPDATE clients SET
            name = COALESCE(?, name),
            phone = COALESCE(?, phone),
            city = COALESCE(?, city)
          WHERE id = ?
        `).run(
          client_name ? client_name.trim() : null,
          client_phone !== undefined ? client_phone : null,
          client_city !== undefined ? client_city : null,
          existing.client_id
        );
      } catch (cErr) {
        console.warn('Could not update client details in PUT /legalizations:', cErr.message);
      }
    }

    // Automatic status update to 'finalizado_agpe' if step 9 (step8_agpe_ok) is fulfilled and status not explicitly set
    let computedStatus = status || existing.status;
    if (step8_agpe_ok && computedStatus === 'en_tramite') {
      computedStatus = 'finalizado_agpe';
    }

    db.prepare(`
      UPDATE network_legalizations SET
        operator = ?, status = ?, nic_number = ?, radicado_number = ?, transformer_code = ?,
        installed_power_kwp = ?, system_type = ?,
        step1_docs_ok = ?, step1_docs_comments = ?, step1_docs_date = ?,
        step_renova_ok = ?, step_renova_comments = ?, step_renova_date = ?,
        step2_designs_ok = ?, step2_designs_comments = ?, step2_designs_date = ?,
        step3_retie_ok = ?, step3_retie_comments = ?, step3_retie_date = ?,
        step4_radication_ok = ?, step4_radication_comments = ?, step4_radication_date = ?,
        step5_approval_ok = ?, step5_approval_comments = ?, step5_approval_date = ?,
        step6_visit_ok = ?, step6_visit_comments = ?, step6_visit_date = ?,
        step7_meter_ok = ?, step7_meter_comments = ?, step7_meter_date = ?,
        step8_agpe_ok = ?, step8_agpe_comments = ?, step8_agpe_date = ?,
        general_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      operator !== undefined ? operator : existing.operator,
      computedStatus,
      nic_number !== undefined ? nic_number : existing.nic_number,
      radicado_number !== undefined ? radicado_number : existing.radicado_number,
      transformer_code !== undefined ? transformer_code : existing.transformer_code,
      installed_power_kwp !== undefined ? (parseFloat(installed_power_kwp) || 0) : existing.installed_power_kwp,
      system_type !== undefined ? system_type : existing.system_type,
      step1_docs_ok ? 1 : 0, step1_docs_comments || '', step1_docs_date || null,
      step_renova_ok ? 1 : 0, step_renova_comments || '', step_renova_date || null,
      step2_designs_ok ? 1 : 0, step2_designs_comments || '', step2_designs_date || null,
      step3_retie_ok ? 1 : 0, step3_retie_comments || '', step3_retie_date || null,
      step4_radication_ok ? 1 : 0, step4_radication_comments || '', step4_radication_date || null,
      step5_approval_ok ? 1 : 0, step5_approval_comments || '', step5_approval_date || null,
      step6_visit_ok ? 1 : 0, step6_visit_comments || '', step6_visit_date || null,
      step7_meter_ok ? 1 : 0, step7_meter_comments || '', step7_meter_date || null,
      step8_agpe_ok ? 1 : 0, step8_agpe_comments || '', step8_agpe_date || null,
      general_notes !== undefined ? general_notes : existing.general_notes,
      id
    );

    const updated = db.prepare('SELECT * FROM network_legalizations WHERE id = ?').get(id);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ACTUALIZAR_EXPEDIENTE',
      module: 'legalizaciones',
      entityType: 'Expediente Legalización',
      entityId: existing.expediente_code,
      description: `Actualización de pasos y estado del expediente ${existing.expediente_code} (${computedStatus})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    await syncToSupabase();

    res.json({
      message: 'Expediente de legalización actualizado exitosamente.',
      dossier: updated
    });
  } catch (error) {
    console.error('Error in PUT /api/legalizations/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/legalizations/:id - Delete (Admin, Técnico or authorized role)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'tecnico') {
      let hasPerm = false;
      try {
        const roleRow = db.prepare('SELECT permissions_json FROM roles WHERE slug = ?').get(req.user.role);
        if (roleRow && roleRow.permissions_json) {
          const perms = JSON.parse(roleRow.permissions_json);
          if (Array.isArray(perms) && perms.includes('legalizations')) {
            hasPerm = true;
          }
        }
      } catch (e) {}
      if (!hasPerm) {
        return res.status(403).json({ error: 'Solo los administradores, técnicos o usuarios con permiso asignado pueden eliminar expedientes de legalización.' });
      }
    }

    const id = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT id, expediente_code FROM network_legalizations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    db.prepare('DELETE FROM network_legalizations WHERE id = ?').run(id);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR_EXPEDIENTE',
      module: 'legalizaciones',
      entityType: 'Expediente Legalización',
      entityId: existing.expediente_code,
      description: `Expediente de legalización ${existing.expediente_code} eliminado por ${req.user?.name || req.user?.username}`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    await syncToSupabase();

    res.json({ message: `Expediente ${existing.expediente_code} eliminado exitosamente.` });
  } catch (error) {
    console.error('Error in DELETE /api/legalizations/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper for step field names
function getStepSuffix(stepNum) {
  switch (stepNum) {
    case 1: return 'docs';
    case 2: return 'designs';
    case 3: return 'retie';
    case 4: return 'radication';
    case 5: return 'approval';
    case 6: return 'visit';
    case 7: return 'meter';
    case 8: return 'agpe';
    default: return 'step';
  }
}

export default router;

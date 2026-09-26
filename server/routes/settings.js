import express from 'express';
import { db, syncToSupabase, recordAuditLog } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

// Helper to get active/default company
export function getActiveCompany() {
  let comp = null;
  try {
    comp = db.prepare('SELECT * FROM company_settings WHERE is_default = 1 LIMIT 1').get();
  } catch (e) {}
  if (!comp) {
    comp = db.prepare('SELECT * FROM company_settings ORDER BY id ASC LIMIT 1').get();
  }
  return comp;
}

// Get active company settings (or specific company by ?id=)
router.get('/', authenticateToken, (req, res) => {
  try {
    const compId = req.query.id ? parseInt(req.query.id, 10) : null;
    let settings = null;
    if (compId) {
      settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);
    }
    if (!settings) {
      settings = getActiveCompany();
    }
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/companies - List all registered companies
router.get('/companies', authenticateToken, (req, res) => {
  try {
    const companies = db.prepare('SELECT * FROM company_settings ORDER BY is_default DESC, id ASC').all();
    res.json({ companies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/companies - Create new company (Admin only)
router.post('/companies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      company_name, nit, phone, email, address, website,
      legal_rep_name, legal_rep_doc, bank_name, bank_account_type, bank_account_number,
      instagram, city, department,
      default_radiation_coef, default_mdo_rate, default_structure_rate,
      default_caja_ac, default_accessories,
      warranty_panels_years, warranty_inverter_years,
      warranty_batteries_years, warranty_installation_years,
      terms_and_conditions, is_default
    } = req.body;

    const count = db.prepare('SELECT COUNT(*) as c FROM company_settings').get()?.c || 0;
    const shouldBeDefault = is_default ? 1 : (count === 0 ? 1 : 0);

    if (shouldBeDefault) {
      db.prepare('UPDATE company_settings SET is_default = 0').run();
    }

    const result = db.prepare(`
      INSERT INTO company_settings (
        company_name, nit, phone, email, address, website,
        legal_rep_name, legal_rep_doc, bank_name, bank_account_type, bank_account_number,
        instagram, city, department,
        default_radiation_coef, default_mdo_rate, default_structure_rate,
        default_caja_ac, default_accessories,
        warranty_panels_years, warranty_inverter_years,
        warranty_batteries_years, warranty_installation_years,
        terms_and_conditions, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_name ? company_name.trim() : 'Nueva Empresa Solar',
      nit || '',
      phone || '',
      email || '',
      address || '',
      website || '',
      legal_rep_name || '',
      legal_rep_doc || '',
      bank_name || '',
      bank_account_type || '',
      bank_account_number || '',
      instagram || '',
      city || '',
      department || '',
      parseFloat(default_radiation_coef) || 10.1,
      parseFloat(default_mdo_rate) || 400000,
      parseFloat(default_structure_rate) || 280000,
      parseFloat(default_caja_ac) || 2500000,
      parseFloat(default_accessories) || 5000000,
      parseInt(warranty_panels_years) || 25,
      parseInt(warranty_inverter_years) || 5,
      parseInt(warranty_batteries_years) || 10,
      parseInt(warranty_installation_years) || 2,
      terms_and_conditions || '',
      shouldBeDefault
    );

    const newCompany = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(result.lastInsertRowid);

    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CREAR_EMPRESA',
      module: 'configuracion',
      entityType: 'Empresa',
      entityId: String(result.lastInsertRowid),
      description: `Creación de la empresa "${newCompany.company_name}" (NIT: ${newCompany.nit || 'S/N'})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.status(201).json({
      message: `Empresa "${newCompany.company_name}" creada exitosamente.`,
      company: newCompany
    });
  } catch (error) {
    console.error('Error in POST /api/settings/companies:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/companies/:id - Update company details (Admin only)
router.put('/companies/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const compId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);
    if (!existing) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }

    const {
      company_name, nit, phone, email, address, website,
      legal_rep_name, legal_rep_doc, bank_name, bank_account_type, bank_account_number,
      instagram, city, department,
      default_radiation_coef, default_mdo_rate, default_structure_rate,
      default_caja_ac, default_accessories,
      warranty_panels_years, warranty_inverter_years,
      warranty_batteries_years, warranty_installation_years,
      terms_and_conditions, is_default
    } = req.body;

    if (is_default) {
      db.prepare('UPDATE company_settings SET is_default = 0').run();
    }

    db.prepare(`
      UPDATE company_settings SET
        company_name = ?, nit = ?, phone = ?, email = ?, address = ?, website = ?,
        legal_rep_name = ?, legal_rep_doc = ?, bank_name = ?, bank_account_type = ?, bank_account_number = ?,
        instagram = ?, city = ?, department = ?,
        default_radiation_coef = ?, default_mdo_rate = ?, default_structure_rate = ?,
        default_caja_ac = ?, default_accessories = ?,
        warranty_panels_years = ?, warranty_inverter_years = ?,
        warranty_batteries_years = ?, warranty_installation_years = ?,
        terms_and_conditions = ?,
        is_default = CASE WHEN ? = 1 THEN 1 ELSE is_default END
      WHERE id = ?
    `).run(
      company_name !== undefined ? company_name : existing.company_name,
      nit !== undefined ? nit : existing.nit,
      phone !== undefined ? phone : existing.phone,
      email !== undefined ? email : existing.email,
      address !== undefined ? address : existing.address,
      website !== undefined ? website : existing.website,
      legal_rep_name !== undefined ? legal_rep_name : existing.legal_rep_name,
      legal_rep_doc !== undefined ? legal_rep_doc : existing.legal_rep_doc,
      bank_name !== undefined ? bank_name : existing.bank_name,
      bank_account_type !== undefined ? bank_account_type : existing.bank_account_type,
      bank_account_number !== undefined ? bank_account_number : existing.bank_account_number,
      instagram !== undefined ? instagram : existing.instagram,
      city !== undefined ? city : existing.city,
      department !== undefined ? department : existing.department,
      default_radiation_coef !== undefined ? parseFloat(default_radiation_coef) : existing.default_radiation_coef,
      default_mdo_rate !== undefined ? parseFloat(default_mdo_rate) : existing.default_mdo_rate,
      default_structure_rate !== undefined ? parseFloat(default_structure_rate) : existing.default_structure_rate,
      default_caja_ac !== undefined ? parseFloat(default_caja_ac) : existing.default_caja_ac,
      default_accessories !== undefined ? parseFloat(default_accessories) : existing.default_accessories,
      warranty_panels_years !== undefined ? parseInt(warranty_panels_years) : existing.warranty_panels_years,
      warranty_inverter_years !== undefined ? parseInt(warranty_inverter_years) : existing.warranty_inverter_years,
      warranty_batteries_years !== undefined ? parseInt(warranty_batteries_years) : existing.warranty_batteries_years,
      warranty_installation_years !== undefined ? parseInt(warranty_installation_years) : existing.warranty_installation_years,
      terms_and_conditions !== undefined ? terms_and_conditions : existing.terms_and_conditions,
      is_default ? 1 : 0,
      compId
    );

    const updated = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);

    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'MODIFICAR_EMPRESA',
      module: 'configuracion',
      entityType: 'Empresa',
      entityId: String(compId),
      description: `Actualización de datos corporativos de la empresa "${updated.company_name}"`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      message: 'Datos de la empresa actualizados exitosamente.',
      company: updated,
      settings: updated
    });
  } catch (error) {
    console.error('Error in PUT /api/settings/companies/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/settings/companies/:id - Delete company (Admin only)
router.delete('/companies/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const compId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);
    if (!existing) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }

    const total = db.prepare('SELECT COUNT(*) as c FROM company_settings').get()?.c || 0;
    if (total <= 1) {
      return res.status(400).json({
        error: 'No se puede eliminar la única empresa registrada. Si deseas cambiar sus datos, puedes editarlos o usar la opción "Dejar en blanco".'
      });
    }

    db.prepare('DELETE FROM company_settings WHERE id = ?').run(compId);

    // If the deleted company was default, assign default to the first remaining company
    if (existing.is_default) {
      const remaining = db.prepare('SELECT id FROM company_settings ORDER BY id ASC LIMIT 1').get();
      if (remaining) {
        db.prepare('UPDATE company_settings SET is_default = 1 WHERE id = ?').run(remaining.id);
      }
    }

    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR_EMPRESA',
      module: 'configuracion',
      entityType: 'Empresa',
      entityId: String(compId),
      description: `Eliminación de la empresa "${existing.company_name}"`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      message: `Empresa "${existing.company_name}" eliminada exitosamente.`
    });
  } catch (error) {
    console.error('Error in DELETE /api/settings/companies/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/companies/:id/set-default - Set company as active default
router.post('/companies/:id/set-default', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const compId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);
    if (!existing) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }

    db.prepare('UPDATE company_settings SET is_default = 0').run();
    db.prepare('UPDATE company_settings SET is_default = 1 WHERE id = ?').run(compId);

    const updated = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);

    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ESTABLECER_EMPRESA_PREDETERMINADA',
      module: 'configuracion',
      entityType: 'Empresa',
      entityId: String(compId),
      description: `"${updated.company_name}" seleccionada como empresa predeterminada para cotizaciones y contratos`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      message: `Empresa "${updated.company_name}" establecida como predeterminada.`,
      company: updated
    });
  } catch (error) {
    console.error('Error in POST /api/settings/companies/:id/set-default:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/companies/:id/clear - Reset / clear all company data to blank
router.post('/companies/:id/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const compId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);
    if (!existing) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }

    db.prepare(`
      UPDATE company_settings SET
        company_name = '',
        nit = '',
        phone = '',
        email = '',
        address = '',
        website = '',
        legal_rep_name = '',
        legal_rep_doc = '',
        bank_name = '',
        bank_account_type = '',
        bank_account_number = '',
        instagram = '',
        city = '',
        department = '',
        terms_and_conditions = ''
      WHERE id = ?
    `).run(compId);

    const cleared = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(compId);

    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'VACIAR_DATOS_EMPRESA',
      module: 'configuracion',
      entityType: 'Empresa',
      entityId: String(compId),
      description: `Datos corporativos de la empresa ID ${compId} dejados en blanco`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      message: 'Los datos de la empresa han sido vaciados y dejados en blanco.',
      company: cleared,
      settings: cleared
    });
  } catch (error) {
    console.error('Error in POST /api/settings/companies/:id/clear:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update default company settings (backwards compatibility for PUT /api/settings)
router.put('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden modificar la configuración de la empresa.' });
    }

    const activeComp = getActiveCompany();
    const targetId = activeComp?.id || 1;

    const {
      company_name, nit, phone, email, address, website,
      legal_rep_name, legal_rep_doc, bank_name, bank_account_type, bank_account_number,
      instagram, city, department,
      default_radiation_coef, default_mdo_rate, default_structure_rate,
      default_caja_ac, default_accessories,
      warranty_panels_years, warranty_inverter_years,
      warranty_batteries_years, warranty_installation_years,
      terms_and_conditions
    } = req.body;

    db.prepare(`
      UPDATE company_settings SET
        company_name = ?, nit = ?, phone = ?, email = ?, address = ?, website = ?,
        legal_rep_name = ?, legal_rep_doc = ?, bank_name = ?, bank_account_type = ?, bank_account_number = ?,
        instagram = ?, city = ?, department = ?,
        default_radiation_coef = ?, default_mdo_rate = ?, default_structure_rate = ?,
        default_caja_ac = ?, default_accessories = ?,
        warranty_panels_years = ?, warranty_inverter_years = ?,
        warranty_batteries_years = ?, warranty_installation_years = ?,
        terms_and_conditions = ?
      WHERE id = ?
    `).run(
      company_name || '', nit || '', phone || '', email || '', address || '', website || '',
      legal_rep_name || '', legal_rep_doc || '', bank_name || '', bank_account_type || '', bank_account_number || '',
      instagram || '', city || '', department || '',
      parseFloat(default_radiation_coef) || 10.1,
      parseFloat(default_mdo_rate) || 400000,
      parseFloat(default_structure_rate) || 280000,
      parseFloat(default_caja_ac) || 2500000,
      parseFloat(default_accessories) || 5000000,
      parseInt(warranty_panels_years) || 25,
      parseInt(warranty_inverter_years) || 5,
      parseInt(warranty_batteries_years) || 10,
      parseInt(warranty_installation_years) || 2,
      terms_and_conditions || '',
      targetId
    );

    const updated = db.prepare('SELECT * FROM company_settings WHERE id = ?').get(targetId);

    await syncToSupabase();

    res.json({ message: 'Configuración actualizada con éxito', settings: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats endpoint
router.get('/dashboard-stats', authenticateToken, (req, res) => {
  try {
    const today = (req.query.client_date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.client_date))
      ? req.query.client_date
      : new Date().toISOString().split('T')[0];

    const stats = {
      total_clients: db.prepare('SELECT COUNT(*) as c FROM clients').get().c,
      total_quotes: db.prepare('SELECT COUNT(*) as c FROM quotes').get().c,
      total_quoted_money: db.prepare("SELECT SUM(total_price) as s FROM quotes").get().s || 0,
      total_approved_money: db.prepare("SELECT SUM(total_price) as s FROM quotes WHERE status = 'aprobada'").get().s || 0,
      
      pending_today_count: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status = 'pendiente' AND date(followup_date) = date(?)").get(today).c,
      overdue_count: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status = 'pendiente' AND date(followup_date) < date(?)").get(today).c,
      hot_leads_count: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status = 'pendiente' AND interest_score >= 8").get().c,
      approved_quotes_count: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status = 'aprobada'").get().c,
      desisted_quotes_count: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status = 'desistida'").get().c,
      
      pending_visits_to_quote_count: db.prepare("SELECT COUNT(*) as c FROM technical_visits WHERE status = 'realizada_pendiente_cotizar'").get().c,
      scheduled_visits_count: db.prepare("SELECT COUNT(*) as c FROM technical_visits WHERE status = 'agendada'").get().c,
      overdue_visits_count: db.prepare("SELECT COUNT(*) as c FROM technical_visits WHERE status = 'agendada' AND date(scheduled_date) < date(?)").get(today).c,
      today_visits_count: db.prepare("SELECT COUNT(*) as c FROM technical_visits WHERE status = 'agendada' AND date(scheduled_date) = date(?)").get(today).c,

      overdue_jobs_count: (() => {
        try {
          return db.prepare("SELECT COUNT(*) as c FROM technical_jobs WHERE status IN ('pendiente', 'en_progreso') AND date(scheduled_date) < date(?)").get(today)?.c || 0;
        } catch (e) { return 0; }
      })(),
      today_jobs_count: (() => {
        try {
          return db.prepare("SELECT COUNT(*) as c FROM technical_jobs WHERE status IN ('pendiente', 'en_progreso') AND date(scheduled_date) = date(?)").get(today)?.c || 0;
        } catch (e) { return 0; }
      })(),
      urgent_jobs: (() => {
        try {
          return db.prepare(`
            SELECT j.*, u.name as technician_name, c.name as client_name, c.phone as client_phone
            FROM technical_jobs j
            LEFT JOIN users u ON j.technician_id = u.id
            LEFT JOIN clients c ON j.client_id = c.id
            WHERE j.status IN ('pendiente', 'en_progreso') AND date(j.scheduled_date) <= date(?)
            ORDER BY j.scheduled_date ASC, j.scheduled_time ASC
            LIMIT 6
          `).all(today);
        } catch (e) { return []; }
      })(),

      pending_contracts_count: db.prepare(`
        SELECT COUNT(*) as c
        FROM quotes q
        LEFT JOIN contracts ct ON q.id = ct.quote_id
        WHERE q.status IN ('aprobada', 'ganada') AND ct.id IS NULL
      `).get().c,

      pending_contracts_quotes: db.prepare(`
        SELECT q.id as quote_id, q.quote_code, q.system_type, q.installed_power_kwp, q.installed_panels,
               q.total_price, q.updated_at,
               c.id as client_id, c.name as client_name, c.phone as client_phone, c.city as client_city,
               u.name as advisor_name
        FROM quotes q
        JOIN clients c ON q.client_id = c.id
        LEFT JOIN users u ON q.user_id = u.id
        LEFT JOIN contracts ct ON q.id = ct.quote_id
        WHERE q.status IN ('aprobada', 'ganada') AND ct.id IS NULL
        ORDER BY q.updated_at DESC
        LIMIT 6
      `).all(),

      pending_visits_to_quote: db.prepare(`
        SELECT v.id as visit_id, v.visit_code, v.scheduled_date, v.voltage_level,
               v.recommended_system_type, v.client_consumption_kwh, v.technician_notes,
               c.id as client_id, c.name as client_name, c.phone as client_phone, c.city as client_city,
               u.name as technician_name
        FROM technical_visits v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN users u ON v.user_id = u.id
        WHERE v.status = 'realizada_pendiente_cotizar'
        ORDER BY v.scheduled_date ASC
        LIMIT 6
      `).all(),

      overdue_and_today_visits: db.prepare(`
        SELECT v.id as visit_id, v.visit_code, v.scheduled_date, v.scheduled_time, v.voltage_level,
               v.technician_notes,
               c.id as client_id, c.name as client_name, c.phone as client_phone, c.city as client_city,
               c.address as client_address,
               u.name as technician_name
        FROM technical_visits v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN users u ON v.user_id = u.id
        WHERE v.status = 'agendada' AND date(v.scheduled_date) <= date(?)
        ORDER BY v.scheduled_date ASC, v.scheduled_time ASC
        LIMIT 6
      `).all(today),

      systems_breakdown: db.prepare(`
        SELECT system_type, COUNT(*) as count, SUM(total_price) as total_amount
        FROM quotes
        GROUP BY system_type
      `).all(),

      recent_quotes: db.prepare(`
        SELECT q.id, q.quote_code, q.system_type, q.status, q.total_price, q.followup_date, q.interest_score,
               c.name as client_name, c.phone as client_phone
        FROM quotes q
        JOIN clients c ON q.client_id = c.id
        ORDER BY q.id DESC
        LIMIT 6
      `).all(),

      urgent_followups: db.prepare(`
        SELECT q.id as quote_id, q.quote_code, q.system_type, q.total_price, q.followup_date, q.interest_score,
               c.name as client_name, c.phone as client_phone, c.city as client_city
        FROM quotes q
        JOIN clients c ON q.client_id = c.id
        WHERE q.status = 'pendiente' AND (date(q.followup_date) <= date(?))
        ORDER BY q.followup_date ASC, q.interest_score DESC
        LIMIT 5
      `).all(today)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

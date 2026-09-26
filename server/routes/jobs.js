import express from 'express';
import { db, recordAuditLog } from '../db.js';
import { authenticateToken, requirePermission, requireAdmin } from './auth.js';

const router = express.Router();

/**
 * Generate correlative Job code: TRB-YYYY-NNN
 */
export function generateNextJobCode() {
  const currentYear = new Date().getFullYear();
  const prefix = `TRB-${currentYear}-`;
  const rows = db.prepare('SELECT job_code FROM technical_jobs WHERE job_code LIKE ?').all(`${prefix}%`);
  let maxSeq = 0;
  for (const r of rows) {
    if (r.job_code) {
      const parts = r.job_code.split('-');
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (db.prepare('SELECT id FROM technical_jobs WHERE job_code = ?').get(candidate)) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

/**
 * Enrich job with overdue calculations and human labels
 */
export function enrichJob(job, clientDateStr = null) {
  const todayStr = clientDateStr || new Date().toISOString().slice(0, 10);
  const schedDate = job.scheduled_date || '';

  let isOverdue = false;
  let isToday = false;
  let daysOverdue = 0;

  if (['pendiente', 'en_progreso'].includes(job.status) && schedDate) {
    if (schedDate < todayStr) {
      isOverdue = true;
      const t1 = new Date(schedDate).getTime();
      const t2 = new Date(todayStr).getTime();
      daysOverdue = Math.max(1, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
    } else if (schedDate === todayStr) {
      isToday = true;
    }
  }

  return {
    ...job,
    is_overdue: isOverdue,
    days_overdue: daysOverdue,
    is_today: isToday
  };
}

/**
 * GET /api/jobs - List technical jobs with filters
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const { status, priority, technician_id, client_id, date, search, client_date } = req.query;

    let query = `
      SELECT j.*,
             u.name as technician_full_name, u.email as technician_email, u.role as technician_role,
             c.name as real_client_name, c.phone as real_client_phone, c.address as real_client_address, c.city as real_client_city,
             ctr.contract_code
      FROM technical_jobs j
      LEFT JOIN users u ON j.technician_id = u.id
      LEFT JOIN clients c ON j.client_id = c.id
      LEFT JOIN contracts ctr ON j.contract_id = ctr.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by technician if explicitly requested
    if (technician_id && technician_id !== 'all') {
      query += ' AND j.technician_id = ?';
      params.push(parseInt(technician_id, 10));
    }

    if (status && status !== 'all') {
      if (status === 'overdue') {
        const today = client_date || new Date().toISOString().slice(0, 10);
        query += " AND j.status IN ('pendiente', 'en_progreso') AND j.scheduled_date < ?";
        params.push(today);
      } else if (status === 'today') {
        const today = client_date || new Date().toISOString().slice(0, 10);
        query += " AND j.status IN ('pendiente', 'en_progreso') AND j.scheduled_date = ?";
        params.push(today);
      } else {
        query += ' AND j.status = ?';
        params.push(status);
      }
    }

    if (priority && priority !== 'all') {
      query += ' AND j.priority = ?';
      params.push(priority);
    }

    if (client_id) {
      query += ' AND j.client_id = ?';
      params.push(parseInt(client_id, 10));
    }

    if (date) {
      query += ' AND j.scheduled_date = ?';
      params.push(date);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (
        j.job_code LIKE ? OR 
        j.title LIKE ? OR 
        j.client_name LIKE ? OR 
        c.name LIKE ? OR
        u.name LIKE ? OR
        j.description LIKE ?
      )`;
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY CASE WHEN j.status = "pendiente" THEN 0 WHEN j.status = "en_progreso" THEN 1 ELSE 2 END, j.scheduled_date ASC, j.scheduled_time ASC';

    const jobs = db.prepare(query).all(...params);
    const enriched = jobs.map(j => enrichJob(j, client_date));

    res.json({ jobs: enriched });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: 'Error al consultar trabajos programados: ' + err.message });
  }
});

/**
 * GET /api/jobs/technicians - List users eligible to perform technical jobs
 */
router.get('/technicians', authenticateToken, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, name, username, email, role 
      FROM users 
      WHERE active = 1 AND LOWER(role) IN ('tecnico', 'ingeniero')
      ORDER BY CASE WHEN LOWER(role) = 'ingeniero' THEN 0 ELSE 1 END, name ASC
    `).all();
    res.json({ technicians: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/jobs/stats - Statistics & overdue alerts
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const { client_date } = req.query;
    const today = client_date || new Date().toISOString().slice(0, 10);

    let baseQuery = 'SELECT * FROM technical_jobs';
    let params = [];
    if (req.user?.role === 'tecnico') {
      baseQuery += ' WHERE (technician_id = ? OR technician_id IS NULL)';
      params.push(req.user.id);
    }

    const allJobs = db.prepare(baseQuery).all(...params);

    let total = allJobs.length;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    let todayCount = 0;
    let urgent = 0;

    allJobs.forEach(job => {
      const enriched = enrichJob(job, today);
      if (job.status === 'completado') completed++;
      else if (job.status === 'en_progreso') inProgress++;
      else if (job.status === 'pendiente') pending++;

      if (enriched.is_overdue) overdue++;
      if (enriched.is_today) todayCount++;
      if (['urgente', 'alta'].includes(job.priority) && job.status !== 'completado') {
        urgent++;
      }
    });

    res.json({
      total,
      pending,
      in_progress: inProgress,
      completed,
      overdue_count: overdue,
      today_count: todayCount,
      urgent_count: urgent
    });
  } catch (err) {
    console.error('Error in GET /api/jobs/stats:', err);
    res.status(500).json({ error: 'Error al consultar estadísticas de trabajos: ' + err.message });
  }
});

/**
 * GET /api/jobs/:id - Single job detail
 */
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const job = db.prepare(`
      SELECT j.*,
             u.name as technician_full_name, u.email as technician_email,
             c.name as real_client_name, c.phone as real_client_phone, c.address as real_client_address, c.city as real_client_city,
             ctr.contract_code
      FROM technical_jobs j
      LEFT JOIN users u ON j.technician_id = u.id
      LEFT JOIN clients c ON j.client_id = c.id
      LEFT JOIN contracts ctr ON j.contract_id = ctr.id
      WHERE j.id = ?
    `).get(id);

    if (!job) {
      return res.status(404).json({ error: 'Trabajo programado no encontrado.' });
    }

    res.json({ job: enrichJob(job, req.query.client_date) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/jobs - Schedule new technical job
 */
router.post('/', authenticateToken, requirePermission('jobs'), (req, res) => {
  try {
    const {
      title,
      job_type = 'instalacion',
      client_id,
      client_name,
      client_phone,
      client_address,
      city,
      contract_id,
      technician_id,
      scheduled_date,
      scheduled_time = '08:00 AM',
      priority = 'media',
      description = '',
      materials_needed = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'El título del trabajo es obligatorio.' });
    }
    if (!scheduled_date) {
      return res.status(400).json({ error: 'Debes especificar la fecha programada para el trabajo.' });
    }

    let finalClientId = client_id ? parseInt(client_id, 10) : null;
    let finalClientName = client_name || '';
    let finalPhone = client_phone || '';
    let finalAddress = client_address || '';
    let finalCity = city || '';

    if (finalClientId) {
      const cRow = db.prepare('SELECT id, name, phone, address, city FROM clients WHERE id = ?').get(finalClientId);
      if (cRow) {
        if (!finalClientName) finalClientName = cRow.name;
        if (!finalPhone) finalPhone = cRow.phone || '';
        if (!finalAddress) finalAddress = cRow.address || '';
        if (!finalCity) finalCity = cRow.city || '';
      }
    }

    let techName = '';
    let finalTechId = technician_id ? parseInt(technician_id, 10) : null;
    if (finalTechId) {
      const uRow = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(finalTechId);
      if (!uRow) {
        return res.status(400).json({ error: 'El técnico seleccionado no existe.' });
      }
      if (!['tecnico', 'ingeniero'].includes((uRow.role || '').toLowerCase())) {
        return res.status(400).json({ error: 'Solamente se le pueden asignar trabajos a los roles de Técnico y de Ingeniero.' });
      }
      techName = uRow.name;
    }

    const jobCode = generateNextJobCode();

    const insertResult = db.prepare(`
      INSERT INTO technical_jobs (
        job_code, title, job_type, client_id, client_name, client_phone, client_address,
        city, contract_id, technician_id, technician_name, scheduled_date, scheduled_time,
        priority, status, description, materials_needed, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `).run(
      jobCode,
      title.trim(),
      job_type || 'instalacion',
      finalClientId,
      finalClientName,
      finalPhone,
      finalAddress,
      finalCity,
      contract_id ? parseInt(contract_id, 10) : null,
      finalTechId,
      techName,
      scheduled_date,
      scheduled_time || '08:00 AM',
      priority || 'media',
      description || '',
      materials_needed || '',
      req.user.id
    );

    recordAuditLog({
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      action: 'CREAR_TRABAJO',
      module: 'trabajos',
      entityType: 'technical_jobs',
      entityId: jobCode,
      description: `Trabajo ${jobCode} "${title}" programado para el técnico ${techName || 'Sin Asignar'} el ${scheduled_date} con prioridad ${priority}.`
    });

    const createdJob = db.prepare('SELECT * FROM technical_jobs WHERE id = ?').get(insertResult.lastInsertRowid);
    res.status(201).json({
      message: `Trabajo ${jobCode} programado exitosamente.`,
      job: enrichJob(createdJob)
    });
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Error al programar el trabajo: ' + err.message });
  }
});

/**
 * PUT /api/jobs/:id - Update technical job
 */
router.put('/:id', authenticateToken, requirePermission('jobs'), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM technical_jobs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Trabajo no encontrado.' });
    }

    const {
      title,
      job_type,
      client_id,
      client_name,
      client_phone,
      client_address,
      city,
      contract_id,
      technician_id,
      scheduled_date,
      scheduled_time,
      priority,
      status,
      description,
      materials_needed,
      technician_notes
    } = req.body;

    let techName = existing.technician_name;
    const finalTechId = technician_id !== undefined ? (technician_id ? parseInt(technician_id, 10) : null) : existing.technician_id;
    if (finalTechId && finalTechId !== existing.technician_id) {
      const uRow = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(finalTechId);
      if (!uRow) {
        return res.status(400).json({ error: 'El técnico seleccionado no existe.' });
      }
      if (!['tecnico', 'ingeniero'].includes((uRow.role || '').toLowerCase())) {
        return res.status(400).json({ error: 'Solamente se le pueden asignar trabajos a los roles de Técnico y de Ingeniero.' });
      }
      techName = uRow ? uRow.name : '';
    } else if (finalTechId === null) {
      techName = '';
    }

    let completedAt = existing.completed_at;
    const newStatus = status || existing.status;
    if (newStatus === 'completado' && existing.status !== 'completado') {
      completedAt = new Date().toISOString();
    } else if (newStatus !== 'completado') {
      completedAt = null;
    }

    db.prepare(`
      UPDATE technical_jobs SET
        title = ?,
        job_type = ?,
        client_id = ?,
        client_name = ?,
        client_phone = ?,
        client_address = ?,
        city = ?,
        contract_id = ?,
        technician_id = ?,
        technician_name = ?,
        scheduled_date = ?,
        scheduled_time = ?,
        priority = ?,
        status = ?,
        description = ?,
        materials_needed = ?,
        technician_notes = ?,
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title.trim() : existing.title,
      job_type !== undefined ? job_type : existing.job_type,
      client_id !== undefined ? (client_id ? parseInt(client_id, 10) : null) : existing.client_id,
      client_name !== undefined ? client_name : existing.client_name,
      client_phone !== undefined ? client_phone : existing.client_phone,
      client_address !== undefined ? client_address : existing.client_address,
      city !== undefined ? city : existing.city,
      contract_id !== undefined ? (contract_id ? parseInt(contract_id, 10) : null) : existing.contract_id,
      finalTechId,
      techName,
      scheduled_date !== undefined ? scheduled_date : existing.scheduled_date,
      scheduled_time !== undefined ? scheduled_time : existing.scheduled_time,
      priority !== undefined ? priority : existing.priority,
      newStatus,
      description !== undefined ? description : existing.description,
      materials_needed !== undefined ? materials_needed : existing.materials_needed,
      technician_notes !== undefined ? technician_notes : existing.technician_notes,
      completedAt,
      id
    );

    recordAuditLog({
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      action: 'ACTUALIZAR_TRABAJO',
      module: 'trabajos',
      entityType: 'technical_jobs',
      entityId: existing.job_code,
      description: `Trabajo ${existing.job_code} modificado (Técnico: ${techName || 'N/A'}, Fecha: ${scheduled_date || existing.scheduled_date}, Estado: ${newStatus}).`
    });

    const updated = db.prepare('SELECT * FROM technical_jobs WHERE id = ?').get(id);
    res.json({
      message: 'Trabajo actualizado exitosamente.',
      job: enrichJob(updated)
    });
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).json({ error: 'Error al actualizar el trabajo: ' + err.message });
  }
});

/**
 * PATCH /api/jobs/:id/status - Quick status update (e.g. Iniciar, Completar)
 */
router.patch('/:id/status', authenticateToken, requirePermission('jobs'), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, technician_notes } = req.body;

    if (!status || !['pendiente', 'en_progreso', 'completado', 'cancelado'].includes(status)) {
      return res.status(400).json({ error: 'Estado de trabajo inválido.' });
    }

    const existing = db.prepare('SELECT * FROM technical_jobs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Trabajo no encontrado.' });
    }

    let completedAt = existing.completed_at;
    if (status === 'completado' && existing.status !== 'completado') {
      completedAt = new Date().toISOString();
    } else if (status !== 'completado') {
      completedAt = null;
    }

    let notes = existing.technician_notes || '';
    if (technician_notes && technician_notes.trim()) {
      const stamp = `[${new Date().toLocaleDateString('es-CO')} ${req.user.name || req.user.username}]: ${technician_notes.trim()}`;
      notes = notes ? `${notes}\n${stamp}` : stamp;
    }

    db.prepare(`
      UPDATE technical_jobs SET
        status = ?,
        technician_notes = ?,
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, notes, completedAt, id);

    recordAuditLog({
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      action: 'ESTADO_TRABAJO',
      module: 'trabajos',
      entityType: 'technical_jobs',
      entityId: existing.job_code,
      description: `Cambio de estado de trabajo ${existing.job_code} a "${status}".`
    });

    const updated = db.prepare('SELECT * FROM technical_jobs WHERE id = ?').get(id);
    res.json({
      message: `Estado actualizado a "${status}".`,
      job: enrichJob(updated)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/jobs/:id - Delete job (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM technical_jobs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Trabajo no encontrado.' });
    }

    db.prepare('DELETE FROM technical_jobs WHERE id = ?').run(id);

    recordAuditLog({
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      action: 'ELIMINAR_TRABAJO',
      module: 'trabajos',
      entityType: 'technical_jobs',
      entityId: existing.job_code,
      description: `Trabajo ${existing.job_code} eliminado.`
    });

    res.json({ message: `Trabajo ${existing.job_code} eliminado exitosamente.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

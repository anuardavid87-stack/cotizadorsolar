import express from 'express';
import { db, recordAuditLog } from '../db.js';
import { authenticateToken, requirePermission, requireAdmin } from './auth.js';

const router = express.Router();

export function generateNextVisitCode() {
  const currentYear = new Date().getFullYear();
  const prefix = `VIS-${currentYear}-`;
  const rows = db.prepare('SELECT visit_code FROM technical_visits WHERE visit_code LIKE ?').all(`${prefix}%`);
  let maxSeq = 0;
  for (const r of rows) {
    if (r.visit_code) {
      const parts = r.visit_code.split('-');
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (db.prepare('SELECT id FROM technical_visits WHERE visit_code = ?').get(candidate)) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

// Get visits list with filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT v.*, 
             c.name as client_name, c.phone as client_phone, c.city as client_city, 
             c.address as client_address, c.client_type,
             u.name as technician_name,
             q.quote_code, q.total_price as quote_total
      FROM technical_visits v
      JOIN clients c ON v.client_id = c.id
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN quotes q ON v.quote_id = q.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      if (status === 'realizadas' || status === 'completed') {
        query += " AND (v.status = 'realizada_pendiente_cotizar' OR v.status = 'cotizada')";
      } else {
        query += ' AND v.status = ?';
        params.push(status);
      }
    }

    if (search && search.trim() !== '') {
      query += ' AND (v.visit_code LIKE ? OR c.name LIKE ? OR c.city LIKE ? OR c.phone LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY v.scheduled_date DESC, v.id DESC';

    const visits = db.prepare(query).all(...params);

    // Summary counts for tabs and alerts
    const statsQuery = `
      SELECT
        COUNT(CASE WHEN status = 'agendada' THEN 1 END) as scheduled_count,
        COUNT(CASE WHEN status IN ('realizada_pendiente_cotizar', 'cotizada') THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'realizada_pendiente_cotizar' THEN 1 END) as pending_quote_count,
        COUNT(CASE WHEN status = 'cancelada' THEN 1 END) as cancelled_count,
        COUNT(*) as total_count
      FROM technical_visits
    `;
    const stats = db.prepare(statsQuery).get();

    res.json({ visits, stats });
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single visit by id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const visit = db.prepare(`
      SELECT v.*, 
             c.name as client_name, c.phone as client_phone, c.email as client_email,
             c.doc_type as client_doc_type, c.doc_number as client_doc_number,
             c.city as client_city, c.address as client_address, c.operator as client_operator,
             u.name as technician_name,
             q.quote_code, q.total_price as quote_total
      FROM technical_visits v
      JOIN clients c ON v.client_id = c.id
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN quotes q ON v.quote_id = q.id
      WHERE v.id = ?
    `).get(visitId);

    if (!visit) return res.status(404).json({ error: 'Visita técnica no encontrada' });
    
    // Parse roof sections JSON
    try {
      visit.roof_sections = JSON.parse(visit.roof_sections_json || '[]');
    } catch (e) {
      visit.roof_sections = [];
    }
    if (!Array.isArray(visit.roof_sections) || visit.roof_sections.length === 0) {
      const area = visit.available_area_m2 || 50;
      visit.roof_sections = [{
        id: 1,
        name: 'Cubierta 1',
        largo: 10,
        ancho: Math.round((area / 10) * 10) / 10,
        area: area,
        estimated_panels: Math.round(area / 2.6)
      }];
    }

    res.json({ visit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule a new visit (Agendamiento)
router.post('/', authenticateToken, requirePermission('visits'), (req, res) => {
  try {
    const {
      client_id, user_id, scheduled_date, scheduled_time,
      operator, voltage_level, client_consumption_kwh,
      technician_notes
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'Debes seleccionar un cliente.' });
    }

    const parsedClientId = parseInt(client_id, 10);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(parsedClientId);
    if (!client) {
      return res.status(404).json({ error: 'El cliente seleccionado no existe.' });
    }

    if (!scheduled_date) {
      return res.status(400).json({ error: 'La fecha de la visita es obligatoria.' });
    }

    const visitCode = generateNextVisitCode();
    
    // Safely resolve foreign key for user_id
    let assignedUserId = null;
    const parsedUserId = user_id && !isNaN(parseInt(user_id, 10)) ? parseInt(user_id, 10) : null;
    if (parsedUserId && db.prepare('SELECT id FROM users WHERE id = ?').get(parsedUserId)) {
      assignedUserId = parsedUserId;
    } else if (req.user?.id && db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id)) {
      assignedUserId = req.user.id;
    }

    const result = db.prepare(`
      INSERT INTO technical_visits (
        visit_code, client_id, user_id, scheduled_date, scheduled_time, status,
        operator, voltage_level, client_consumption_kwh, technician_notes
      ) VALUES (?, ?, ?, ?, ?, 'agendada', ?, ?, ?, ?)
    `).run(
      visitCode,
      client.id,
      assignedUserId,
      scheduled_date,
      scheduled_time || '09:00 AM',
      operator || client?.operator || 'Afinia',
      voltage_level || client?.voltage_level || 'Bifásica 120/240V',
      parseFloat(client_consumption_kwh) || 0,
      technician_notes || ''
    );

    res.status(201).json({
      message: 'Visita técnica agendada exitosamente',
      id: result.lastInsertRowid,
      visit_code: visitCode
    });
  } catch (error) {
    console.error('Error scheduling visit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fill / Update technical visit data (Diligenciamiento de Levantamiento Técnico)
router.put('/:id', authenticateToken, requirePermission('visits'), (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const {
      scheduled_date, scheduled_time, user_id,
      operator, voltage_level, totalizer_breaker_amps,
      transformer_type, transformer_kva, main_board_location,
      grounding_system_status, distance_roof_to_board_m, distance_inverter_to_board_m, client_consumption_kwh,
      roof_type, roof_condition, beams_condition, roof_slope_deg, roof_orientation,
      available_area_m2, roof_sections, roof_sections_json, estimated_panels_total,
      structure_condition, structure_material, shading_level,
      inverter_location, battery_location, has_internet_wifi, wifi_signal_strength,
      recommended_system_type, recommended_structure_type, technician_notes,
      photo_meter_ok, photo_transformer_ok, energy_bill_ok,
      markAsCompleted // if true, sets status to 'realizada_pendiente_cotizar'
    } = req.body;

    const currentVisit = db.prepare('SELECT * FROM technical_visits WHERE id = ?').get(visitId);
    if (!currentVisit) return res.status(404).json({ error: 'Visita no encontrada' });

    let newStatus = currentVisit.status;
    if (markAsCompleted || currentVisit.status === 'agendada') {
      newStatus = 'realizada_pendiente_cotizar'; // Active and pending quotation!
    }

    // Safely sanitize user_id for foreign key constraints
    let assignedUserId = currentVisit.user_id;
    if (user_id !== undefined) {
      const parsedUserId = user_id && !isNaN(parseInt(user_id, 10)) ? parseInt(user_id, 10) : null;
      if (parsedUserId && db.prepare('SELECT id FROM users WHERE id = ?').get(parsedUserId)) {
        assignedUserId = parsedUserId;
      }
    }

    // Handle roof sections calculation and totals
    let finalRoofSectionsJson = currentVisit.roof_sections_json || '[]';
    let finalAvailableArea = currentVisit.available_area_m2 || 50;
    let finalEstimatedPanels = currentVisit.estimated_panels_total || 0;

    if (roof_sections && Array.isArray(roof_sections)) {
      finalRoofSectionsJson = JSON.stringify(roof_sections);
      let sumArea = 0;
      let sumPanels = 0;
      for (const sec of roof_sections) {
        const l = parseFloat(sec.largo) || 0;
        const w = parseFloat(sec.ancho) || 0;
        const a = parseFloat(sec.area) || (l * w);
        sumArea += a;
        sumPanels += (parseInt(sec.estimated_panels, 10) || 0);
      }
      finalAvailableArea = Math.round(sumArea * 100) / 100;
      finalEstimatedPanels = sumPanels;
    } else if (roof_sections_json !== undefined) {
      finalRoofSectionsJson = roof_sections_json;
      try {
        const parsed = JSON.parse(roof_sections_json);
        if (Array.isArray(parsed)) {
          let sumArea = 0;
          let sumPanels = 0;
          for (const sec of parsed) {
            const l = parseFloat(sec.largo) || 0;
            const w = parseFloat(sec.ancho) || 0;
            const a = parseFloat(sec.area) || (l * w);
            sumArea += a;
            sumPanels += (parseInt(sec.estimated_panels, 10) || 0);
          }
          finalAvailableArea = Math.round(sumArea * 100) / 100;
          finalEstimatedPanels = sumPanels;
        }
      } catch (e) {}
    } else if (available_area_m2 !== undefined) {
      finalAvailableArea = parseFloat(available_area_m2) || 0;
    }

    if (estimated_panels_total !== undefined && (!roof_sections || roof_sections.length === 0)) {
      finalEstimatedPanels = parseInt(estimated_panels_total, 10) || 0;
    }

    db.prepare(`
      UPDATE technical_visits SET
        scheduled_date = ?, scheduled_time = ?, user_id = ?,
        operator = ?, voltage_level = ?, totalizer_breaker_amps = ?,
        transformer_type = ?, transformer_kva = ?, main_board_location = ?,
        grounding_system_status = ?, distance_roof_to_board_m = ?, distance_inverter_to_board_m = ?, client_consumption_kwh = ?,
        roof_type = ?, roof_condition = ?, beams_condition = ?, roof_slope_deg = ?, roof_orientation = ?,
        available_area_m2 = ?, roof_sections_json = ?, estimated_panels_total = ?,
        structure_condition = ?, structure_material = ?, shading_level = ?,
        inverter_location = ?, battery_location = ?, has_internet_wifi = ?, wifi_signal_strength = ?,
        recommended_system_type = ?, recommended_structure_type = ?,
        photo_meter_ok = ?, photo_transformer_ok = ?, energy_bill_ok = ?,
        technician_notes = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      scheduled_date !== undefined ? scheduled_date : currentVisit.scheduled_date,
      scheduled_time !== undefined ? scheduled_time : currentVisit.scheduled_time,
      assignedUserId,
      operator !== undefined ? operator : currentVisit.operator,
      voltage_level !== undefined ? voltage_level : currentVisit.voltage_level,
      totalizer_breaker_amps !== undefined ? (parseInt(totalizer_breaker_amps) || 50) : currentVisit.totalizer_breaker_amps,
      transformer_type !== undefined ? transformer_type : currentVisit.transformer_type,
      transformer_kva !== undefined ? (parseFloat(transformer_kva) || 25) : currentVisit.transformer_kva,
      main_board_location !== undefined ? main_board_location : (currentVisit.main_board_location || ''),
      grounding_system_status !== undefined ? grounding_system_status : (currentVisit.grounding_system_status || 'bueno'),
      distance_roof_to_board_m !== undefined ? (parseFloat(distance_roof_to_board_m) || 15) : (currentVisit.distance_roof_to_board_m || 15),
      distance_inverter_to_board_m !== undefined ? (parseFloat(distance_inverter_to_board_m) || 15) : (currentVisit.distance_inverter_to_board_m || 15),
      client_consumption_kwh !== undefined ? (parseFloat(client_consumption_kwh) || 0) : currentVisit.client_consumption_kwh,
      roof_type !== undefined ? roof_type : (currentVisit.roof_type || 'teja_colonial_barro'),
      roof_condition !== undefined ? roof_condition : (currentVisit.roof_condition || 'buena'),
      beams_condition !== undefined ? beams_condition : (currentVisit.beams_condition || 'buena'),
      roof_slope_deg !== undefined ? (parseFloat(roof_slope_deg) || 15) : currentVisit.roof_slope_deg,
      roof_orientation !== undefined ? roof_orientation : (currentVisit.roof_orientation || 'Sur'),
      finalAvailableArea,
      finalRoofSectionsJson,
      finalEstimatedPanels,
      structure_condition !== undefined ? structure_condition : (currentVisit.structure_condition || 'bueno'),
      structure_material !== undefined ? structure_material : (currentVisit.structure_material || 'metalica'),
      shading_level !== undefined ? shading_level : (currentVisit.shading_level || 'ninguno'),
      inverter_location !== undefined ? inverter_location : (currentVisit.inverter_location || ''),
      battery_location !== undefined ? battery_location : (currentVisit.battery_location || ''),
      has_internet_wifi !== undefined ? (has_internet_wifi ? 1 : 0) : currentVisit.has_internet_wifi,
      wifi_signal_strength !== undefined ? wifi_signal_strength : (currentVisit.wifi_signal_strength || 'Buena'),
      recommended_system_type !== undefined ? recommended_system_type : (currentVisit.recommended_system_type || 'ongrid'),
      recommended_structure_type !== undefined ? recommended_structure_type : (currentVisit.recommended_structure_type || 'Coplanar / Teja'),
      photo_meter_ok !== undefined ? (photo_meter_ok ? 1 : 0) : (currentVisit.photo_meter_ok || 0),
      photo_transformer_ok !== undefined ? (photo_transformer_ok ? 1 : 0) : (currentVisit.photo_transformer_ok || 0),
      energy_bill_ok !== undefined ? (energy_bill_ok ? 1 : 0) : (currentVisit.energy_bill_ok || 0),
      technician_notes !== undefined ? technician_notes : (currentVisit.technician_notes || ''),
      newStatus,
      visitId
    );

    res.json({
      message: 'Formato de visita técnica guardado exitosamente. Estado: ' + newStatus,
      status: newStatus,
      available_area_m2: finalAvailableArea,
      estimated_panels_total: finalEstimatedPanels
    });
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change status (e.g. cancel)
router.patch('/:id/status', authenticateToken, requirePermission('visits'), (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const { status } = req.body;
    db.prepare('UPDATE technical_visits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, visitId);
    res.json({ message: 'Estado de la visita actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete visit (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const visitBefore = db.prepare('SELECT id, visit_code FROM technical_visits WHERE id = ?').get(visitId);
    if (!visitBefore) {
      return res.status(404).json({ error: 'Visita técnica no encontrada' });
    }

    // 1. Unlink any quotes referencing this visit
    db.prepare('UPDATE quotes SET visit_id = NULL WHERE visit_id = ?').run(visitId);

    // 2. Delete the technical visit
    db.prepare('DELETE FROM technical_visits WHERE id = ?').run(visitId);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR',
      module: 'visitas',
      entityType: 'Visita Técnica',
      entityId: visitBefore.visit_code,
      description: `Visita técnica ${visitBefore.visit_code} eliminada del sistema`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({ message: `Visita técnica ${visitBefore.visit_code} eliminada exitosamente` });
  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

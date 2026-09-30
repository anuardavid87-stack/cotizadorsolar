import express from 'express';
import { db, syncToSupabase, recordAuditLog } from '../db.js';
import { authenticateToken } from './auth.js';
import { generateNextVisitCode } from './visits.js';

const router = express.Router();

// Get all clients with search and stats
router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, type } = req.query;
    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM quotes WHERE client_id = c.id) as quote_count,
        (SELECT MAX(created_at) FROM followups WHERE client_id = c.id) as last_interaction_date,
        (SELECT interest_score FROM quotes WHERE client_id = c.id ORDER BY id DESC LIMIT 1) as latest_interest_score,
        (SELECT followup_date FROM quotes WHERE client_id = c.id ORDER BY id DESC LIMIT 1) as next_followup_date,
        (SELECT installed_power_kwp FROM quotes WHERE client_id = c.id ORDER BY id DESC LIMIT 1) as latest_installed_power_kwp
      FROM clients c
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      query += ` AND (c.name LIKE ? OR c.doc_number LIKE ? OR c.phone LIKE ? OR c.city LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (type && type !== 'all') {
      query += ` AND c.client_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY c.id DESC`;

    const clients = db.prepare(query).all(...params);
    res.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single client by id with all quotes and followups
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const quotes = db.prepare(`
      SELECT q.*, u.name as user_name 
      FROM quotes q 
      LEFT JOIN users u ON q.user_id = u.id 
      WHERE q.client_id = ? 
      ORDER BY q.id DESC
    `).all(clientId);

    const visits = db.prepare(`
      SELECT v.*, u.name as user_name
      FROM technical_visits v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.client_id = ?
      ORDER BY v.id DESC
    `).all(clientId);

    const followups = db.prepare(`
      SELECT f.*, u.name as user_name
      FROM followups f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.client_id = ?
      ORDER BY f.id DESC
    `).all(clientId);

    res.json({ client, quotes, followups, visits });
  } catch (error) {
    console.error('Error fetching client by id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create client
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      name, doc_type, doc_number, phone, email, address,
      city, department, operator, client_type, voltage_level, stratum, notes
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre o razón social es obligatorio.' });
    }

    const trimmedName = name.trim();
    const cleanDoc = (doc_number || '').trim().replace(/[^a-zA-Z0-9]/g, '');

    // 1. Document Uniqueness Check
    if (cleanDoc.length >= 4) {
      const existingByDoc = db.prepare(`
        SELECT id, name, doc_type, doc_number FROM clients 
        WHERE REPLACE(REPLACE(REPLACE(TRIM(doc_number), '.', ''), '-', ''), ' ', '') = ?
      `).get(cleanDoc);
      if (existingByDoc) {
        return res.status(400).json({ 
          error: `Ya existe un cliente registrado con el número de documento ${existingByDoc.doc_type || 'CC'} ${existingByDoc.doc_number} ("${existingByDoc.name}"). Para evitar duplicados, consulta o actualiza su ficha.`
        });
      }
    }

    // 2. Anti-double-click debounce: check if client with exact same name was created within the last 15 seconds
    const recentDuplicate = db.prepare(`
      SELECT id, name, created_at FROM clients 
      WHERE LOWER(TRIM(name)) = LOWER(?) 
        AND (strftime('%s', 'now') - strftime('%s', created_at)) < 15
    `).get(trimmedName);

    if (recentDuplicate) {
      return res.status(409).json({ 
        error: `Se detectó una solicitud duplicada enviada hace instantes. El cliente "${recentDuplicate.name}" ya fue registrado exitosamente.`
      });
    }

    const result = db.prepare(`
      INSERT INTO clients (
        name, doc_type, doc_number, phone, email, address,
        city, department, operator, client_type, voltage_level, stratum, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trimmedName, doc_type || 'CC', doc_number || '', phone || '', email || '',
      address || '', city || '', department || '', operator || 'Enel',
      client_type || 'Residencial', voltage_level || 'Monofásico 120/240V', stratum || '4', notes || ''
    );

    const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);

    let scheduledVisit = null;
    if (req.body.schedule_visit && req.body.visit_date) {
      const visitCode = generateNextVisitCode();
      
      let assignedUserId = null;
      const parsedUserId = req.body.visit_user_id && !isNaN(parseInt(req.body.visit_user_id, 10)) ? parseInt(req.body.visit_user_id, 10) : null;
      if (parsedUserId && db.prepare('SELECT id FROM users WHERE id = ?').get(parsedUserId)) {
        assignedUserId = parsedUserId;
      } else if (req.user?.id && db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id)) {
        assignedUserId = req.user.id;
      }

      const visitResult = db.prepare(`
        INSERT INTO technical_visits (
          visit_code, client_id, user_id, scheduled_date, scheduled_time, status,
          operator, voltage_level, client_consumption_kwh, technician_notes
        ) VALUES (?, ?, ?, ?, ?, 'agendada', ?, ?, ?, ?)
      `).run(
        visitCode,
        newClient.id,
        assignedUserId,
        req.body.visit_date,
        req.body.visit_time || '09:00 AM',
        operator || 'Enel',
        voltage_level || 'Monofásico 120/240V',
        parseFloat(req.body.client_consumption_kwh) || 0,
        req.body.visit_notes || 'Visita técnica inicial programada al registrar cliente'
      );

      scheduledVisit = db.prepare('SELECT * FROM technical_visits WHERE id = ?').get(visitResult.lastInsertRowid);
    }

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CREAR',
      module: 'clientes',
      entityType: 'Cliente',
      entityId: newClient.name,
      description: `Cliente "${newClient.name}" registrado (${newClient.city || 'Sin ciudad'})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.status(201).json({
      message: scheduledVisit 
        ? `Cliente registrado y Visita Técnica ${scheduledVisit.visit_code} programada exitosamente`
        : 'Cliente registrado exitosamente',
      client: newClient,
      visit: scheduledVisit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update client
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const {
      name, doc_type, doc_number, phone, email, address,
      city, department, operator, client_type, voltage_level, stratum, notes
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    db.prepare(`
      UPDATE clients SET
        name = ?, doc_type = ?, doc_number = ?, phone = ?, email = ?,
        address = ?, city = ?, department = ?, operator = ?,
        client_type = ?, voltage_level = ?, stratum = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name.trim(), doc_type || 'CC', doc_number || '', phone || '', email || '',
      address || '', city || '', department || '', operator || 'Enel',
      client_type || 'Residencial', voltage_level || 'Monofásico 120/240V', stratum || '4', notes || '',
      clientId
    );

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ACTUALIZAR',
      module: 'clientes',
      entityType: 'Cliente',
      entityId: updated.name,
      description: `Datos de contacto y ubicación del cliente "${updated.name}" actualizados`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.json({ message: 'Cliente actualizado exitosamente', client: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client (Admin only + protected against accidental cascade loss)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo los usuarios con rol de Administrador pueden eliminar clientes del sistema.' });
    }

    const clientId = parseInt(req.params.id);
    const clientBefore = db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId);
    if (!clientBefore) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const quotes = db.prepare('SELECT id, quote_code FROM quotes WHERE client_id = ?').all(clientId);
    const contracts = db.prepare('SELECT id, contract_code FROM contracts WHERE client_id = ?').all(clientId);

    if ((quotes.length > 0 || contracts.length > 0) && req.query.force !== 'true') {
      return res.status(400).json({
        error: `El cliente "${clientBefore.name}" tiene ${quotes.length} cotización(es) y ${contracts.length} contrato(s) asociado(s). Para prevenir pérdidas accidentales de datos, confirme explícitamente la eliminación.`,
        requiresForce: true,
        quotesCount: quotes.length,
        contractsCount: contracts.length
      });
    }

    // 1. Unlink technical visits pointing to quotes of this client
    for (const q of quotes) {
      db.prepare('UPDATE technical_visits SET quote_id = NULL WHERE quote_id = ?').run(q.id);
      db.prepare('DELETE FROM followups WHERE quote_id = ?').run(q.id);
      db.prepare('DELETE FROM contracts WHERE quote_id = ?').run(q.id);
    }

    // 2. Unlink any quotes that point to technical visits of this client
    const visits = db.prepare('SELECT id FROM technical_visits WHERE client_id = ?').all(clientId);
    for (const v of visits) {
      db.prepare('UPDATE quotes SET visit_id = NULL WHERE visit_id = ?').run(v.id);
    }

    // 3. Delete quotes of this client
    db.prepare('DELETE FROM quotes WHERE client_id = ?').run(clientId);

    // 4. Delete contracts directly of this client
    db.prepare('DELETE FROM contracts WHERE client_id = ?').run(clientId);

    // 5. Delete followups directly of this client
    db.prepare('DELETE FROM followups WHERE client_id = ?').run(clientId);

    // 6. Delete technical visits of this client
    db.prepare('DELETE FROM technical_visits WHERE client_id = ?').run(clientId);

    // 7. Finally delete the client
    db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR',
      module: 'clientes',
      entityType: 'Cliente',
      entityId: clientBefore.name || String(clientId),
      description: `Cliente "${clientBefore.name}" y todos sus registros asociados fueron eliminados del sistema`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Auto persist to Supabase Storage
    syncToSupabase().catch(e => console.warn('[Storage Sync]:', e.message));

    res.json({ message: `Cliente "${clientBefore.name}" eliminado exitosamente` });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

import express from 'express';
import { db, syncToSupabase, recordAuditLog } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

// System available modules and permissions definition
export const AVAILABLE_PERMISSIONS = [
  {
    id: 'dashboard',
    name: 'Panel General & Métricas',
    category: 'General',
    description: 'Acceso a la vista de inicio, métricas generales de cotizaciones y accesos rápidos.'
  },
  {
    id: 'visits',
    name: 'Visitas Técnicas',
    category: 'Operaciones',
    description: 'Programar nuevas visitas, diligenciar actas y levantamientos técnicos en sitio.'
  },
  {
    id: 'jobs',
    name: 'Programación de Trabajos Técnicos',
    category: 'Operaciones',
    description: 'Programar cuadrillas, fechas y horas de órdenes de trabajo, auditar cumplimiento y alertas de retraso.'
  },
  {
    id: 'quotes',
    name: 'Cotizaciones & Cotizador Solar',
    category: 'Comercial',
    description: 'Diseñar y generar cotizaciones solares, descargar propuestas en PDF y cambiar estados.'
  },
  {
    id: 'clients',
    name: 'Gestión de Clientes',
    category: 'Comercial',
    description: 'Directorio de clientes, registro de prospectos y consulta de fichas 360°.'
  },
  {
    id: 'crm',
    name: 'Seguimiento Comercial (CRM)',
    category: 'Comercial',
    description: 'Historial de llamadas, reuniones y gestión de embudo de ventas.'
  },
  {
    id: 'contracts',
    name: 'Contratos de Obra',
    category: 'Comercial',
    description: 'Elaboración, firma y control de contratos formales de instalación solar.'
  },
  {
    id: 'legalizations',
    name: 'Legalizaciones ante Operador de Red',
    category: 'Técnico / Regulatorio',
    description: 'Expedientes de 8 pasos, seguimiento ante Enel/Celsia/EPM, RETIE y emisión de Carta AGPE.'
  },
  {
    id: 'products',
    name: 'Productos y Precios',
    category: 'Catálogo',
    description: 'Consulta de paneles, inversores, baterías y componentes del sistema.'
  },
  {
    id: 'users',
    name: 'Gestión de Usuarios',
    category: 'Seguridad',
    description: 'Crear nuevos empleados y consultar el listado de usuarios del sistema.'
  },
  {
    id: 'company_settings',
    name: 'Ajustes de Empresa & Parámetros',
    category: 'Administración',
    description: 'Configurar datos fiscales, cuentas bancarias, garantías y fórmulas de cálculo.'
  },
  {
    id: 'logs',
    name: 'Logs & Auditoría del Sistema',
    category: 'Seguridad',
    description: 'Registro de auditoría forense, IPs de conexión e historial de cambios.'
  }
];

// GET /api/roles/available-permissions - Metadata for checkboxes
router.get('/available-permissions', authenticateToken, (req, res) => {
  res.json({ permissions: AVAILABLE_PERMISSIONS });
});

// GET /api/roles - List all roles with users count
router.get('/', authenticateToken, (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, id ASC').all();
    const userCounts = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();
    const countMap = {};
    userCounts.forEach(u => {
      countMap[u.role] = u.count;
    });

    const enriched = roles.map(r => {
      let perms = [];
      try {
        perms = JSON.parse(r.permissions_json || '[]');
      } catch (e) {}

      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        permissions: perms,
        is_system: Boolean(r.is_system),
        user_count: countMap[r.slug] || 0,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });

    res.json({ roles: enriched });
  } catch (error) {
    console.error('Error in GET /api/roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/roles - Create new role (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, permissions } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del rol es obligatorio.' });
    }

    // Sanitize slug
    let cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!cleanSlug || cleanSlug.length < 2) {
      return res.status(400).json({ error: 'El identificador (slug) del rol no es válido.' });
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM roles WHERE slug = ?').get(cleanSlug);
    if (existing) {
      return res.status(400).json({ error: `Ya existe un rol con el identificador "${cleanSlug}".` });
    }

    const permsArray = Array.isArray(permissions) ? permissions : [];

    const result = db.prepare(`
      INSERT INTO roles (slug, name, description, permissions_json, is_system)
      VALUES (?, ?, ?, ?, 0)
    `).run(
      cleanSlug,
      name.trim(),
      description || '',
      JSON.stringify(permsArray)
    );

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CREAR_ROL',
      module: 'usuarios',
      entityType: 'Rol',
      entityId: cleanSlug,
      description: `Creación del nuevo rol "${name}" con ${permsArray.length} permisos asignados`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Persist to Cloud Storage
    await syncToSupabase();

    res.status(201).json({
      message: `Rol "${name}" creado exitosamente.`,
      role: {
        id: result.lastInsertRowid,
        slug: cleanSlug,
        name: name.trim(),
        description: description || '',
        permissions: permsArray,
        is_system: false,
        user_count: 0
      }
    });
  } catch (error) {
    console.error('Error in POST /api/roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/roles/:id - Update role permissions and details (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
    if (!existing) {
      return res.status(404).json({ error: 'Rol no encontrado.' });
    }

    const { name, description, permissions } = req.body;

    let permsArray = Array.isArray(permissions) ? permissions : [];

    // Safety: Admin role must always retain core permissions to prevent lockout
    if (existing.slug === 'admin') {
      const mandatoryAdminPerms = ['dashboard', 'users', 'company_settings', 'logs'];
      for (const p of mandatoryAdminPerms) {
        if (!permsArray.includes(p)) permsArray.push(p);
      }
    }

    db.prepare(`
      UPDATE roles SET
        name = ?, description = ?, permissions_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name && name.trim() ? name.trim() : existing.name,
      description !== undefined ? description : existing.description,
      JSON.stringify(permsArray),
      roleId
    );

    const finalName = name && name.trim() ? name.trim() : existing.name;

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'MODIFICAR_ROL',
      module: 'usuarios',
      entityType: 'Rol',
      entityId: existing.slug,
      description: `Modificación del rol "${existing.name}" (Nombre: "${finalName}", ${permsArray.length} permisos activos)`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    // Persist to Cloud Storage
    await syncToSupabase();

    res.json({
      message: `Rol "${finalName}" actualizado exitosamente.`,
      role: {
        id: roleId,
        slug: existing.slug,
        name: finalName,
        description: description !== undefined ? description : existing.description,
        permissions: permsArray,
        is_system: Boolean(existing.is_system)
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/roles/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/roles/:id - Delete role (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
    if (!existing) {
      return res.status(404).json({ error: 'Rol no encontrado.' });
    }

    if (existing.slug === 'admin') {
      return res.status(403).json({ error: 'El rol Administrador General es el rol principal del sistema y no puede ser eliminado.' });
    }

    // Target role to reassign existing users to (default: comercial, or asesor)
    const reassignTo = req.query.reassignTo || req.body?.reassignTo || 'comercial';
    let targetRole = db.prepare('SELECT slug FROM roles WHERE slug = ?').get(reassignTo);
    if (!targetRole) {
      targetRole = db.prepare("SELECT slug FROM roles WHERE slug IN ('comercial', 'asesor') LIMIT 1").get() || { slug: 'asesor' };
    }

    // Reassign any users who had this role
    const updatedUsers = db.prepare('UPDATE users SET role = ? WHERE role = ?').run(targetRole.slug, existing.slug);

    db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);

    // Persist to Cloud Storage
    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR_ROL',
      module: 'usuarios',
      entityType: 'Rol',
      entityId: existing.slug,
      description: `Eliminación del rol "${existing.name}". ${updatedUsers.changes} usuario(s) reasignado(s) al rol "${targetRole.slug}".`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      message: `Rol "${existing.name}" eliminado exitosamente.${updatedUsers.changes > 0 ? ` Se reasignaron ${updatedUsers.changes} usuario(s) al rol "${targetRole.slug}".` : ''}`
    });
  } catch (error) {
    console.error('Error in DELETE /api/roles/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, syncToSupabase, recordAuditLog } from '../db.js';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogin,
  validatePasswordSecurity,
  sanitizeUsername,
  sanitizeRole,
  clearAllLockouts
} from '../middleware/security.js';
import {
  createSupabaseUser,
  updateSupabaseUser,
  deleteSupabaseUser,
  syncUsersWithSQLite,
  getSupabaseUsers,
  findSupabaseUser,
  getSupabaseUserById,
  checkSupabaseUserConflict
} from '../supabase.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'solarquote_pro_secret_key_2026_jwt';

// Middleware to verify JWT token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token no proporcionado.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido o expirado. Por favor ingresa de nuevo.' });
    }
    try {
      let dbUser = db.prepare('SELECT id, name, username, email, role FROM users WHERE id = ? AND active = 1').get(decodedUser.id);

      // If user not in local SQLite cache (e.g. fresh lambda), fetch from Supabase Cloud
      if (!dbUser) {
        try {
          const sbUser = await getSupabaseUserById(decodedUser.id);
          if (sbUser && (sbUser.active === 1 || sbUser.active === true)) {
            try {
              db.prepare(`
                INSERT INTO users (id, name, username, email, password, role, active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  username = excluded.username,
                  email = excluded.email,
                  role = excluded.role,
                  active = excluded.active
              `).run(sbUser.id, sbUser.name, sbUser.username, sbUser.email, sbUser.password, sbUser.role);
            } catch (cacheErr) {}
            dbUser = {
              id: sbUser.id,
              name: sbUser.name,
              username: sbUser.username,
              email: sbUser.email,
              role: sbUser.role
            };
          }
        } catch (sbErr) {
          console.warn('[Supabase Token Auth Check]:', sbErr.message);
        }
      }

      if (!dbUser) {
        return res.status(401).json({ error: 'Sesión caducada o usuario inactivo. Por favor inicia sesión de nuevo.' });
      }
      req.user = dbUser;
      next();
    } catch (e) {
      req.user = decodedUser;
      next();
    }
  });
}

// Middleware to restrict access to Admins only
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Administrador' });
  }
  next();
}

// Middleware to verify specific module permission or Admin
export function requirePermission(permissionName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    const perms = getUserPermissions(req.user.role);
    if (perms.includes(permissionName)) {
      return next();
    }
    return res.status(403).json({ error: `Acceso denegado: No tienes permisos para el módulo "${permissionName}".` });
  };
}

// Admin-only endpoint to clear failed login lockouts
router.post('/clear-lockouts', authenticateToken, requireAdmin, (req, res) => {
  clearAllLockouts();
  res.json({ message: 'Todos los bloqueos por intentos fallidos han sido eliminados con éxito.' });
});

// Login with username or email + Supabase Realtime Fallback & Brute Force Protection
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = (username || email || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
    }

    // Cybersecurity Check: Rate Limiting / Brute Force Lockout
    const rateLimitError = checkLoginRateLimit(req, identifier);
    if (rateLimitError) {
      return res.status(429).json({ error: rateLimitError });
    }

    const clean = identifier.toLowerCase();
    let user = db.prepare(`
      SELECT * FROM users
      WHERE (LOWER(TRIM(username)) = ? OR LOWER(TRIM(email)) = ?)
        AND active = 1
    `).get(clean, clean);

    // Fallback: If identifier starts with anuar or anuardavid
    if (!user && (clean === 'anuar' || clean === 'anuardavid')) {
      user = db.prepare(`
        SELECT * FROM users
        WHERE (LOWER(TRIM(username)) LIKE 'anuar%' OR LOWER(TRIM(email)) LIKE 'anuar%')
          AND active = 1
      `).get();
    }

    let validPassword = false;
    if (user) {
      validPassword = bcrypt.compareSync(password, user.password);
    }

    // If not found in SQLite or local password failed: Check Supabase PostgreSQL in real time!
    if (!validPassword) {
      try {
        const sbUser = await findSupabaseUser(identifier);
        if (sbUser && (sbUser.active === 1 || sbUser.active === true)) {
          if (bcrypt.compareSync(password, sbUser.password)) {
            validPassword = true;
            user = {
              id: sbUser.id,
              name: sbUser.name,
              username: sbUser.username,
              email: sbUser.email,
              password: sbUser.password,
              role: sbUser.role,
              active: 1
            };
            // Cache user in local SQLite
            try {
              db.prepare(`
                INSERT INTO users (id, name, username, email, password, role, active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  username = excluded.username,
                  email = excluded.email,
                  password = excluded.password,
                  role = excluded.role,
                  active = excluded.active
              `).run(sbUser.id, sbUser.name, sbUser.username, sbUser.email, sbUser.password, sbUser.role);
            } catch (cErr) {}
          }
        }
      } catch (sbErr) {
        console.warn('[Supabase Login Check Notice]:', sbErr.message);
      }
    }

    if (!user || !validPassword) {
      recordFailedLogin(req, identifier);
      recordAuditLog({
        userName: identifier,
        action: 'LOGIN_FALLIDO',
        module: 'seguridad',
        entityType: 'Seguridad',
        entityId: identifier,
        description: `Intento de inicio de sesión fallido para "${identifier}"`,
        ip: req.ip || req.headers['x-forwarded-for']
      });
      return res.status(401).json({ error: 'Credenciales incorrectas o cuenta inactiva.' });
    }

    // Authentication succeeded: Reset failed attempts immediately
    resetFailedLogin(req, identifier);

    recordAuditLog({
      userId: user.id,
      userName: user.name || user.username,
      action: 'LOGIN_EXITOSO',
      module: 'seguridad',
      entityType: 'Usuario',
      entityId: user.username,
      description: `Inicio de sesión exitoso para @${user.username} (${user.role})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    const token = jwt.sign(
      { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const permissions = getUserPermissions(user.role);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
  }
});

// Helper: load permissions from roles table
export function getUserPermissions(roleSlug) {
  const cleanSlug = (roleSlug || '').toString().toLowerCase().trim();
  if (cleanSlug === 'admin') {
    return ['dashboard', 'visits', 'quotes', 'clients', 'crm', 'contracts', 'legalizations', 'products', 'users', 'company_settings', 'logs', 'jobs'];
  }
  try {
    const roleRow = db.prepare('SELECT permissions_json FROM roles WHERE LOWER(TRIM(slug)) = ?').get(cleanSlug);
    if (roleRow && roleRow.permissions_json) {
      const parsed = JSON.parse(roleRow.permissions_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  if (cleanSlug === 'asesor') {
    return ['dashboard', 'visits', 'quotes', 'clients', 'crm', 'contracts', 'products', 'users', 'jobs'];
  }
  if (cleanSlug === 'comercial' || cleanSlug === 'venta') {
    return ['clients', 'jobs'];
  }
  if (cleanSlug === 'tecnico') {
    return ['visits', 'clients', 'legalizations', 'jobs'];
  }
  if (cleanSlug === 'ingeniero') {
    return ['dashboard', 'visits', 'quotes', 'clients', 'legalizations', 'jobs'];
  }
  return ['clients'];
}

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, name, username, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const permissions = getUserPermissions(user.role);
  res.json({ user: { ...user, permissions } });
});

// List all users directly from Supabase PostgreSQL (Master) with SQLite fallback
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const sbUsers = await getSupabaseUsers();
    if (sbUsers && Array.isArray(sbUsers) && sbUsers.length > 0) {
      // Reconcile in local SQLite
      syncUsersWithSQLite(db).catch(err => console.warn('[Supabase Sync Reconcile Warning]:', err.message));

      const safeUsers = sbUsers.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username || (u.email ? u.email.split('@')[0] : `user_${u.id}`),
        email: u.email,
        role: u.role,
        active: u.active !== undefined ? u.active : 1,
        created_at: u.created_at
      }));

      return res.json({
        users: safeUsers,
        cloudSync: 'Supabase Cloud (PostgreSQL) - Sincronizado en tiempo real'
      });
    }
  } catch (err) {
    console.warn('[Supabase Fetch Users Fallback]:', err.message);
  }

  // Fallback: Local SQLite
  const users = db.prepare('SELECT id, name, username, email, role, active, created_at FROM users ORDER BY id ASC').all();
  res.json({
    users,
    cloudSync: 'Local Cache (SQLite)'
  });
});

// Force sync with Supabase PostgreSQL (Admin only)
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden forzar la sincronización.' });
    }
    await syncUsersWithSQLite(db);
    const sbUsers = await getSupabaseUsers();
    const users = (sbUsers && sbUsers.length > 0) ? sbUsers : db.prepare('SELECT id, name, username, email, role, active, created_at FROM users ORDER BY id ASC').all();
    res.json({ message: 'Usuarios sincronizados exitosamente con Supabase Cloud', users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new user (Admin & Asesor Comercial) - Persists directly to Supabase PostgreSQL & SQLite
router.post('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'asesor') {
      return res.status(403).json({ error: 'No tienes permisos para crear usuarios.' });
    }

    const { name, username, email, password, role } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre completo es obligatorio.' });
    }

    // Sanitize and validate username
    const cleanUsername = sanitizeUsername(username || name);
    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener mínimo 3 caracteres alfanuméricos.' });
    }

    // Cybersecurity: Enforce strong password policy
    const pwdCheck = validatePasswordSecurity(password, cleanUsername);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.error });
    }

    // Check unique username in SQLite
    const existingUsername = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(username)) = ?').get(cleanUsername);
    if (existingUsername) {
      return res.status(400).json({ error: `El nombre de usuario "${cleanUsername}" ya existe. Por favor elige otro.` });
    }

    // Clean and validate email
    const cleanEmail = email && typeof email === 'string' && email.trim().length > 0
      ? email.trim().toLowerCase()
      : `${cleanUsername}@solar.com`;

    const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?').get(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: `El correo "${cleanEmail}" ya se encuentra registrado. Por favor usa un correo diferente.` });
    }

    const validRole = sanitizeRole(role);
    if (req.user.role === 'asesor' && validRole === 'admin') {
      return res.status(403).json({ error: 'Solo un administrador general puede registrar usuarios con rol Administrador.' });
    }
    const hashedPassword = bcrypt.hashSync(password.trim(), 10);

    let createdId = null;

    // 1. Persist directly to Supabase PostgreSQL
    try {
      const supabaseUser = await createSupabaseUser({
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        role: validRole,
        active: 1
      });
      if (supabaseUser && supabaseUser.id) {
        createdId = supabaseUser.id;
      }
    } catch (sbErr) {
      console.warn('[Supabase Cloud Notice] Direct insert returned:', sbErr.message);
    }

    // 2. Persist to local SQLite
    if (createdId) {
      db.prepare(`
        INSERT INTO users (id, name, username, email, password, role, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          username = excluded.username,
          email = excluded.email,
          password = excluded.password,
          role = excluded.role,
          active = excluded.active
      `).run(createdId, name.trim(), cleanUsername, cleanEmail, hashedPassword, validRole);
    } else {
      const result = db.prepare(`
        INSERT INTO users (name, username, email, password, role, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(name.trim(), cleanUsername, cleanEmail, hashedPassword, validRole);
      createdId = result.lastInsertRowid;
    }

    // Persist storage backup
    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CREAR',
      module: 'usuarios',
      entityType: 'Usuario',
      entityId: cleanUsername,
      description: `Usuario "${name.trim()}" (@${cleanUsername}) registrado con rol "${validRole}"`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.status(201).json({
      message: 'Usuario creado exitosamente y asegurado en Supabase Cloud',
      user: {
        id: createdId,
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        role: validRole,
        active: 1
      }
    });
  } catch (error) {
    console.error('Error in POST /api/auth/users:', error);
    res.status(500).json({ error: error.message || 'Error al crear usuario' });
  }
});

// Update user - Persists directly to Supabase PostgreSQL & SQLite
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'ID de usuario no válido.' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'asesor' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este usuario.' });
    }

    const { name, username, email, password, role, active } = req.body;
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);

    // If not found in SQLite, check Supabase
    if (!user) {
      const sbUser = await getSupabaseUserById(targetId);
      if (sbUser) {
        user = sbUser;
      }
    }

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Asesor cannot modify an administrator
    if (req.user.role === 'asesor' && user.role === 'admin' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'No tienes permisos para modificar a un Administrador.' });
    }

    // Asesor cannot promote anyone to administrator
    if (req.user.role === 'asesor' && role === 'admin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para asignar el rol Administrador.' });
    }

    // Validate username uniqueness if changed
    const cleanUsername = username ? sanitizeUsername(username) : (user.username || sanitizeUsername(user.name));
    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener mínimo 3 caracteres.' });
    }

    if (cleanUsername !== (user.username || '').toLowerCase()) {
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(username)) = ? AND id != ?').get(cleanUsername, targetId);
      if (existingUser) {
        return res.status(400).json({ error: `El nombre de usuario "${cleanUsername}" ya pertenece a otro usuario.` });
      }
    }

    // Validate email uniqueness if changing email
    let cleanEmail = user.email;
    if (email !== undefined && email !== null) {
      const trimmedEmail = email.trim().toLowerCase();
      cleanEmail = trimmedEmail.length > 0 ? trimmedEmail : user.email;
    }

    if (cleanEmail !== (user.email || '').toLowerCase()) {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND id != ?').get(cleanEmail, targetId);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe otro usuario registrado con este correo electrónico.' });
      }
    }

    let newPassword = user.password;
    let passwordChanged = false;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      // Cybersecurity: Enforce password policy (min 6 chars)
      const pwdCheck = validatePasswordSecurity(password, cleanUsername);
      if (!pwdCheck.valid) {
        return res.status(400).json({ error: pwdCheck.error });
      }
      newPassword = bcrypt.hashSync(password.trim(), 10);
      passwordChanged = true;
    }

    const newRole = req.user.role === 'admin' ? sanitizeRole(role || user.role) : user.role;
    const newActive = req.user.role === 'admin' && active !== undefined ? parseInt(active, 10) : (user.active !== undefined ? user.active : 1);
    const newName = (name && typeof name === 'string' && name.trim().length > 0) ? name.trim() : user.name;

    // 1. Update in Supabase PostgreSQL
    try {
      const supabaseUpdates = {
        name: newName,
        username: cleanUsername,
        email: cleanEmail,
        role: newRole,
        active: newActive
      };
      if (passwordChanged) {
        supabaseUpdates.password = newPassword;
      }
      await updateSupabaseUser(targetId, supabaseUpdates);
    } catch (sbErr) {
      console.warn('[Supabase Cloud Notice] Direct update returned:', sbErr.message);
    }

    // 2. Update in SQLite
    db.prepare(`
      INSERT INTO users (id, name, username, email, password, role, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        username = excluded.username,
        email = excluded.email,
        password = excluded.password,
        role = excluded.role,
        active = excluded.active
    `).run(targetId, newName, cleanUsername, cleanEmail, newPassword, newRole, newActive);

    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ACTUALIZAR',
      module: 'usuarios',
      entityType: 'Usuario',
      entityId: cleanUsername,
      description: `Usuario "${newName}" (@${cleanUsername}) actualizado (Rol: ${newRole}, Estado: ${newActive ? 'Activo' : 'Inactivo'}${passwordChanged ? ', Contraseña modificada' : ''})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      message: passwordChanged
        ? 'Usuario y contraseña actualizados y asegurados en Supabase Cloud'
        : 'Usuario actualizado con éxito en Supabase Cloud',
      user: {
        id: targetId,
        name: newName,
        username: cleanUsername,
        email: cleanEmail,
        role: newRole,
        active: newActive
      },
      passwordChanged
    });
  } catch (error) {
    console.error('Error in PUT /api/auth/users/:id:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar usuario' });
  }
});

// Delete user (Admin only) - Removes from Supabase PostgreSQL & SQLite
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden eliminar usuarios.' });
    }

    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'ID de usuario no válido.' });
    }

    // Protection 1: Cannot delete self
    if (req.user.id === targetId) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador mientras tienes la sesión activa.' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Protection 2: Cannot delete last active admin
    if (targetUser.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND id != ? AND active = 1").get(targetId)?.count || 0;
      if (adminCount === 0) {
        return res.status(400).json({ error: 'No se puede eliminar este usuario porque es el único administrador activo del sistema.' });
      }
    }

    // Count associated records
    const quotesCount = db.prepare('SELECT COUNT(*) as count FROM quotes WHERE user_id = ?').get(targetId)?.count || 0;
    const visitsCount = db.prepare('SELECT COUNT(*) as count FROM technical_visits WHERE user_id = ?').get(targetId)?.count || 0;
    const contractsCount = db.prepare('SELECT COUNT(*) as count FROM contracts WHERE user_id = ?').get(targetId)?.count || 0;
    const followupsCount = db.prepare('SELECT COUNT(*) as count FROM followups WHERE user_id = ?').get(targetId)?.count || 0;
    const totalLinked = quotesCount + visitsCount + contractsCount + followupsCount;

    const { reassign_to_id } = req.query;
    let newAssignedId = null;
    if (reassign_to_id) {
      const parsedReassign = parseInt(reassign_to_id, 10);
      if (!isNaN(parsedReassign)) {
        const reassignUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(parsedReassign);
        if (reassignUser) {
          newAssignedId = reassignUser.id;
        }
      }
    }

    // Safely update foreign keys before deleting user to preserve data integrity
    db.prepare('UPDATE quotes SET user_id = ? WHERE user_id = ?').run(newAssignedId, targetId);
    db.prepare('UPDATE technical_visits SET user_id = ? WHERE user_id = ?').run(newAssignedId, targetId);
    db.prepare('UPDATE contracts SET user_id = ? WHERE user_id = ?').run(newAssignedId, targetId);
    db.prepare('UPDATE followups SET user_id = ? WHERE user_id = ?').run(newAssignedId, targetId);
    db.prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?').run(targetId);

    // 1. Delete from Supabase PostgreSQL
    try {
      await deleteSupabaseUser(targetId);
    } catch (sbErr) {
      console.warn('[Supabase Cloud Notice] Direct delete returned:', sbErr.message);
    }

    // 2. Delete from SQLite
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

    // 3. Persist to Cloud Storage
    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'ELIMINAR',
      module: 'usuarios',
      entityType: 'Usuario',
      entityId: targetUser.username || String(targetId),
      description: `Usuario "${targetUser.name}" (@${targetUser.username || targetId}) eliminado del sistema`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    let message = `Usuario "${targetUser.name}" eliminado exitosamente de Supabase Cloud.`;
    if (totalLinked > 0) {
      message += newAssignedId
        ? ` Se reasignaron ${totalLinked} registro(s) comerciales y técnicos.`
        : ` Se desvincularon ${totalLinked} registro(s) históricos preservando los datos.`;
    }

    res.json({
      message,
      deletedId: targetId,
      totalLinked
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to change any user's password directly
router.put('/users/:id/password', authenticateToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'ID de usuario no válido.' });

    // Only Admin can change another user's password; user can change own password
    if (req.user.role !== 'admin' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Solo un Administrador puede cambiar la contraseña de otro usuario.' });
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres por seguridad.' });
    }

    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!user) {
      const sbUser = await getSupabaseUserById(targetId);
      if (sbUser) user = sbUser;
    }
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const hashedPassword = bcrypt.hashSync(password.trim(), 10);

    // 1. Update in Supabase PostgreSQL
    try {
      await updateSupabaseUser(targetId, { password: hashedPassword });
    } catch (e) {
      console.warn('[Supabase Cloud Notice] Direct password update returned:', e.message);
    }

    // 2. Update in SQLite
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, targetId);

    // 3. Persist to Cloud Storage
    await syncToSupabase();

    recordAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username,
      action: 'CAMBIO_CONTRASENA',
      module: 'usuarios',
      entityType: 'Usuario',
      entityId: user.username || String(user.id),
      description: `El usuario ${req.user?.name || req.user?.username} cambió la contraseña de "${user.name}" (@${user.username || user.id})`,
      ip: req.ip || req.headers['x-forwarded-for']
    });

    res.json({
      success: true,
      message: `Contraseña de "${user.name}" actualizada exitosamente y asegurada en Supabase Cloud.`
    });
  } catch (error) {
    console.error('Error in PUT /api/auth/users/:id/password:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar contraseña' });
  }
});

export default router;

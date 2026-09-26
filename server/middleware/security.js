// Cybersecurity Middleware & Hardening Module
// Includes Rate Limiting, Brute Force Protection, Password Policies, and Security Headers

// In-memory store for failed login attempts
// Map key: IP + '::' + identifier
const failedLoginAttempts = new Map();

// Configuration
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes lockout
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedLoginAttempts.entries()) {
    if (now - record.lastAttempt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      failedLoginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

function getAttemptKeys(req, identifier) {
  const ip = getClientIp(req);
  const cleanId = (identifier || '').trim().toLowerCase();
  return {
    // Lockout applies specifically to this IP + user combination to avoid DoS on other users
    pairKey: cleanId ? `${ip}::${cleanId}` : null,
    ipKey: `ip::${ip}`
  };
}

/**
 * Clear all current failed login lockouts
 */
export function clearAllLockouts() {
  failedLoginAttempts.clear();
  console.log('[Cybersecurity] All login lockouts cleared.');
}

/**
 * Check if current IP or client pair is temporarily locked out due to brute-force attempts
 */
export function checkLoginRateLimit(req, identifier) {
  const now = Date.now();
  const { pairKey, ipKey } = getAttemptKeys(req, identifier);

  for (const key of [pairKey, ipKey].filter(Boolean)) {
    const record = failedLoginAttempts.get(key);
    if (record && record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
      return `Demasiados intentos fallidos. Por seguridad, el acceso desde este dispositivo está bloqueado temporalmente. Intenta nuevamente en ${remainingMinutes} minuto(s).`;
    }
  }
  return null;
}

/**
 * Record a failed login attempt for IP and client pair
 */
export function recordFailedLogin(req, identifier) {
  const now = Date.now();
  const { pairKey, ipKey } = getAttemptKeys(req, identifier);

  for (const key of [pairKey, ipKey].filter(Boolean)) {
    const record = failedLoginAttempts.get(key) || { count: 0, firstAttempt: now, lastAttempt: now, lockedUntil: null };

    // Reset count if window expired
    if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
      record.count = 0;
      record.firstAttempt = now;
    }

    record.count += 1;
    record.lastAttempt = now;

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      console.warn(`[Cybersecurity Alert] Rate limit triggered for: ${key}. Locked for 2 minutes.`);
    }

    failedLoginAttempts.set(key, record);
  }
}

/**
 * Reset failed attempts upon successful authentication
 */
export function resetFailedLogin(req, identifier) {
  const { pairKey, ipKey } = getAttemptKeys(req, identifier);
  if (pairKey) failedLoginAttempts.delete(pairKey);
  if (ipKey) failedLoginAttempts.delete(ipKey);
}

/**
 * Password Security Policy Enforcement:
 * - Minimum 6 characters
 * - Cannot equal username
 */
export function validatePasswordSecurity(password, username = '') {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'La contraseña es requerida.' };
  }

  const trimmed = password.trim();
  if (trimmed.length < 6) {
    return { valid: false, error: 'La contraseña debe tener mínimo 6 caracteres por seguridad.' };
  }

  if (username && trimmed.toLowerCase() === username.trim().toLowerCase()) {
    return { valid: false, error: 'La contraseña no puede ser idéntica al nombre de usuario.' };
  }

  return { valid: true };
}

/**
 * Sanitize and validate username
 */
export function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return '';
  // Only allow letters, numbers, underscores, hyphens and dots
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return clean;
}

/**
 * Whitelist allowed system roles
 */
import { db } from '../db.js';

export const ALLOWED_ROLES = ['admin', 'asesor', 'tecnico', 'ingeniero', 'comercial'];

export function sanitizeRole(role) {
  if (!role || typeof role !== 'string') {
    return 'asesor';
  }
  const clean = role.toLowerCase().trim();
  if (ALLOWED_ROLES.includes(clean)) {
    return clean;
  }
  try {
    const dbRole = db.prepare('SELECT slug FROM roles WHERE slug = ?').get(clean);
    if (dbRole) return clean;
  } catch (e) {}
  return 'asesor';
}

/**
 * HTTP Security Headers Middleware
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

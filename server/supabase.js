// Supabase PostgreSQL direct integration for Users and Data Synchronization
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xyrahrsqyanrebqmvvad.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cmFocnNxeWFucmVicW12dmFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUxMDEwNywiZXhwIjoyMTA1MDg2MTA3fQ.sS2kSj9wQ_faxFzMcwsutc5-Dt6hGBfBf834ib3lRis';

const supabaseHeaders = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

/**
 * Fetch all users directly from Supabase PostgreSQL
 */
export async function getSupabaseUsers() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=id.asc`, {
      headers: supabaseHeaders
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase get users error (${res.status}): ${err}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Supabase Users] Error fetching users:', err.message);
    return null;
  }
}

/**
 * Check if a username or email exists in Supabase (excluding targetId if provided)
 */
export async function checkSupabaseUserConflict(username, email, targetId = null) {
  try {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    let url = `${SUPABASE_URL}/rest/v1/users?select=id,username,email&or=(username.ilike.${cleanUsername},email.ilike.${cleanEmail})`;
    if (targetId) {
      url += `&id=neq.${targetId}`;
    }

    const res = await fetch(url, { headers: supabaseHeaders });
    if (res.ok) {
      const matches = await res.json();
      if (matches && matches.length > 0) {
        for (const m of matches) {
          if (m.username && m.username.toLowerCase() === cleanUsername) {
            return { conflict: 'username', message: `El nombre de usuario "${cleanUsername}" ya está registrado en Supabase.` };
          }
          if (m.email && m.email.toLowerCase() === cleanEmail) {
            return { conflict: 'email', message: `El correo electrónico "${cleanEmail}" ya está registrado en Supabase.` };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Supabase Users] Conflict check warning:', err.message);
  }
  return null;
}

/**
 * Create a user directly in Supabase PostgreSQL
 */
export async function createSupabaseUser(userData) {
  try {
    const payload = {
      name: userData.name,
      username: userData.username,
      email: userData.email,
      password: userData.password,
      role: userData.role || 'asesor',
      active: userData.active !== undefined ? userData.active : 1
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase create user error (${res.status}): ${errText}`);
    }

    const created = await res.json();
    console.log(`[Supabase Users] Successfully registered user "${userData.username}" (ID: ${created[0]?.id}) in Supabase Cloud`);
    return created[0];
  } catch (err) {
    console.error('[Supabase Users] Failed to create user in Supabase:', err.message);
    throw err;
  }
}

/**
 * Update a user in Supabase PostgreSQL
 */
export async function updateSupabaseUser(id, updates) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase update user error (${res.status}): ${errText}`);
    }

    const updated = await res.json();
    console.log(`[Supabase Users] Successfully updated user ID ${id} in Supabase Cloud`);
    return updated[0] || null;
  } catch (err) {
    console.error(`[Supabase Users] Failed to update user ID ${id} in Supabase:`, err.message);
    throw err;
  }
}

/**
 * Unlink user references in Supabase Cloud tables before deletion
 */
export async function unlinkSupabaseUserRecords(userId, newUserId = null) {
  try {
    for (const table of ['quotes', 'technical_visits', 'contracts', 'followups']) {
      await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          ...supabaseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: newUserId })
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Supabase Users] unlinkSupabaseUserRecords warning:', err.message);
  }
}

/**
 * Delete a user in Supabase PostgreSQL
 */
export async function deleteSupabaseUser(id) {
  try {
    await unlinkSupabaseUserRecords(id, null);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
      method: 'DELETE',
      headers: supabaseHeaders
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase delete user error (${res.status}): ${errText}`);
    }

    console.log(`[Supabase Users] Successfully deleted user ID ${id} from Supabase Cloud`);
    return true;
  } catch (err) {
    console.error(`[Supabase Users] Failed to delete user ID ${id} in Supabase:`, err.message);
    throw err;
  }
}

/**
 * Find user directly in Supabase PostgreSQL by username or email
 */
export async function findSupabaseUser(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?or=(username.ilike.${encodeURIComponent(clean)},email.ilike.${encodeURIComponent(clean)})&limit=1`,
      { headers: supabaseHeaders }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.warn('[Supabase Users] findSupabaseUser notice:', err.message);
    return null;
  }
}

/**
 * Get user directly from Supabase PostgreSQL by ID
 */
export async function getSupabaseUserById(id) {
  if (!id) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${id}&limit=1`,
      { headers: supabaseHeaders }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.warn('[Supabase Users] getSupabaseUserById notice:', err.message);
    return null;
  }
}

/**
 * Synchronize all users between Supabase PostgreSQL and local SQLite
 */
export async function syncUsersWithSQLite(sqliteDb) {
  try {
    const supabaseUsers = await getSupabaseUsers();
    if (!supabaseUsers || !Array.isArray(supabaseUsers) || supabaseUsers.length === 0) {
      return;
    }

    let syncedCount = 0;
    for (const su of supabaseUsers) {
      try {
        sqliteDb.prepare(`
          INSERT INTO users (id, name, username, email, password, role, active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            username = excluded.username,
            email = excluded.email,
            password = excluded.password,
            role = excluded.role,
            active = excluded.active
        `).run(
          su.id,
          su.name || 'Usuario',
          su.username || `user_${su.id}`,
          su.email || `user_${su.id}@solar.com`,
          su.password,
          su.role || 'asesor',
          su.active !== undefined ? su.active : 1
        );
        syncedCount++;
      } catch (insertErr) {
        // Fallback update by email or username if constraint occurs
        try {
          sqliteDb.prepare(`
            UPDATE users SET name = ?, password = ?, role = ?, active = ? WHERE email = ? OR username = ?
          `).run(su.name, su.password, su.role, su.active !== undefined ? su.active : 1, su.email, su.username);
        } catch (e) {}
      }
    }

    console.log(`[Supabase Sync] Reconciled ${syncedCount} users with Supabase Cloud (Total Supabase: ${supabaseUsers.length})`);
  } catch (err) {
    console.warn('[Supabase Sync] Error during users synchronization:', err.message);
  }
}

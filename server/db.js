import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {}
}

const dbPath = path.join(dataDir, 'solarquote.db');
const bundledDbPath = path.join(__dirname, '..', 'data', 'solarquote.db');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xyrahrsqyanrebqmvvad.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cmFocnNxeWFucmVicW12dmFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUxMDEwNywiZXhwIjoyMTA1MDg2MTA3fQ.sS2kSj9wQ_faxFzMcwsutc5-Dt6hGBfBf834ib3lRis';

let currentETag = null;
let lastCloudCheckTime = 0;

export { dbPath, dataDir };

export async function syncFromSupabase(maxRetries = 3) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/cotizador-db/solarquote.db`, {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      if (res.ok) {
        currentETag = res.headers.get('etag');
        const buf = Buffer.from(await res.arrayBuffer());
        
        // Validate SQLite file signature ('SQLite format 3') and non-trivial size
        const isSqlite = buf.length > 50000 && buf.subarray(0, 15).toString() === 'SQLite format 3';
        if (isSqlite) {
          fs.writeFileSync(dbPath, buf);
          console.log(`[Supabase Storage] Successfully restored latest solarquote.db (${buf.length} bytes, ETag ${currentETag}) to ${dbPath} on attempt ${attempt}`);
          return true;
        } else {
          console.warn(`[Supabase Storage] Downloaded file invalid or too small (${buf.length} bytes), attempt ${attempt}`);
        }
      } else {
        console.warn(`[Supabase Storage] syncFromSupabase HTTP ${res.status}, attempt ${attempt}`);
      }
    } catch (e) {
      console.warn(`[Supabase Storage] syncFromSupabase network error (attempt ${attempt}/${maxRetries}):`, e.message);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
  return false;
}

export async function syncToSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
  if (!fs.existsSync(dbPath)) return false;
  
  try {
    // Safety check: ensure the local database has valid real client data before uploading
    if (innerDb) {
      try {
        const clientCount = innerDb.prepare('SELECT COUNT(*) as c FROM clients').get()?.c || 0;
        if (clientCount < 5) {
          console.error(`[Supabase Safety Lock] Aborted cloud sync! Local DB has only ${clientCount} clients (expected >= 5). Cloud DB protected from accidental overwrite.`);
          return false;
        }
      } catch (checkErr) {
        console.warn('[Supabase Safety Lock] Could not verify client count:', checkErr.message);
      }
    }

    const fileBuffer = fs.readFileSync(dbPath);
    if (fileBuffer.length < 50000) {
      console.error(`[Supabase Safety Lock] Aborted cloud sync! Local file size is suspiciously small (${fileBuffer.length} bytes).`);
      return false;
    }

    // 1. Upload primary production database
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/cotizador-db/solarquote.db`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/x-sqlite3',
        'x-upsert': 'true'
      },
      body: fileBuffer
    });

    if (res.ok) {
      lastCloudCheckTime = Date.now();
      currentETag = res.headers.get('etag') || null;
      console.log(`[Supabase Storage] Persisted solarquote.db (${fileBuffer.length} bytes) to cloud`);

      // 2. Redundant cloud backup snapshot (non-blocking)
      fetch(`${SUPABASE_URL}/storage/v1/object/cotizador-db/backups/solarquote_cloud_latest_backup.db`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/x-sqlite3',
          'x-upsert': 'true'
        },
        body: fileBuffer
      }).catch(bErr => console.warn('[Supabase Backup Notice]:', bErr.message));

      return true;
    }
  } catch (e) {
    console.warn('[Supabase Storage] syncToSupabase error:', e.message);
  }
  return false;
}

export async function ensureLatestDb() {
  if (!isVercel || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const now = Date.now();
  if (now - lastCloudCheckTime < 2500) return;
  lastCloudCheckTime = now;

  try {
    const headRes = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/cotizador-db/solarquote.db`, {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (headRes.ok) {
      const cloudETag = headRes.headers.get('etag');
      if (cloudETag && currentETag && cloudETag !== currentETag) {
        console.log(`[Supabase Storage] Detected updated DB in cloud (Local: ${currentETag}, Cloud: ${cloudETag}). Reloading...`);
        const downloaded = await syncFromSupabase();
        if (downloaded) {
          db._reopen();
        }
      } else if (cloudETag && !currentETag) {
        currentETag = cloudETag;
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }
}

// On Vercel, restore latest DB from Supabase Storage or fallback to bundled DB
if (isVercel) {
  let restored = false;
  try {
    restored = await syncFromSupabase(3);
  } catch (e) {}

  if (!restored && !fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
    try {
      fs.copyFileSync(bundledDbPath, dbPath);
      console.log('Restored bundled db as initial fallback.');
    } catch (e) {
      console.warn('Could not copy bundled db to /tmp:', e.message);
    }
  }
}

function createInnerDb(pathToFile) {
  const d = new DatabaseSync(pathToFile);
  try {
    d.exec('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.warn('Could not set PRAGMA:', err.message);
  }
  try {
    d.exec('ALTER TABLE contracts ADD COLUMN legalization_alert_dismissed INTEGER DEFAULT 0;');
  } catch (e) {}
  try {
    d.exec('ALTER TABLE company_settings ADD COLUMN is_default INTEGER DEFAULT 0;');
  } catch (e) {}
  try {
    d.exec('ALTER TABLE company_settings ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;');
  } catch (e) {}
  try {
    d.exec('UPDATE company_settings SET is_default = 1 WHERE id = 1 AND (SELECT COUNT(*) FROM company_settings WHERE is_default = 1) = 0;');
  } catch (e) {}
  return d;
}

let innerDb = createInnerDb(dbPath);

export const db = new Proxy({}, {
  get(target, prop) {
    if (prop === '_reopen') {
      return (newPath = dbPath) => {
        try {
          innerDb.close();
        } catch (e) {}
        innerDb = createInnerDb(newPath);
      };
    }
    const val = innerDb[prop];
    if (typeof val === 'function') {
      return val.bind(innerDb);
    }
    return val;
  }
});

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'asesor',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      doc_type TEXT DEFAULT 'CC',
      doc_number TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      department TEXT,
      operator TEXT DEFAULT 'Enel',
      client_type TEXT DEFAULT 'Residencial',
      voltage_level TEXT DEFAULT 'Monofásico 120/240V',
      stratum TEXT DEFAULT '4',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      power_w REAL DEFAULT 0,
      voltage TEXT,
      capacity_ah REAL DEFAULT 0,
      system_type TEXT DEFAULT 'all',
      unit_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      unit TEXT DEFAULT 'unidad',
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS retie_design_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_kw REAL NOT NULL,
      max_kw REAL NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_code TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      user_id INTEGER REFERENCES users(id),
      system_type TEXT NOT NULL DEFAULT 'ongrid',
      status TEXT DEFAULT 'pendiente',
      interest_score INTEGER DEFAULT 7,
      followup_date DATE NOT NULL,
      client_consumption_kwh REAL DEFAULT 0,
      radiation_coefficient REAL DEFAULT 10.1,
      required_power_kwp REAL DEFAULT 0,
      panel_model_id INTEGER REFERENCES products(id),
      panel_power_w REAL DEFAULT 720,
      panel_unit_price REAL DEFAULT 470000,
      suggested_panels INTEGER DEFAULT 0,
      installed_panels INTEGER NOT NULL DEFAULT 0,
      installed_power_kwp REAL NOT NULL DEFAULT 0,
      selected_inverters_json TEXT DEFAULT '[]',
      selected_batteries_json TEXT DEFAULT '[]',
      selected_pumps_json TEXT DEFAULT '[]',
      mdo_unit_price REAL DEFAULT 400000,
      mdo_total REAL DEFAULT 0,
      structure_type TEXT DEFAULT 'Coplanar / Teja',
      structure_unit_price REAL DEFAULT 280000,
      structure_total REAL DEFAULT 0,
      panels_total REAL DEFAULT 0,
      inverters_total REAL DEFAULT 0,
      batteries_total REAL DEFAULT 0,
      pumps_total REAL DEFAULT 0,
      legalization_included INTEGER DEFAULT 1,
      legalization_design_price REAL DEFAULT 0,
      legalization_tramite_price REAL DEFAULT 1400000,
      legalization_bidi_price REAL DEFAULT 1890000,
      legalization_retie_price REAL DEFAULT 3820000,
      caja_ac_price REAL DEFAULT 2000000,
      accessories_price REAL DEFAULT 5000000,
      legalization_total REAL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      financing_down_payment_percent REAL DEFAULT 0,
      financing_down_payment_amount REAL DEFAULT 0,
      financing_amount REAL DEFAULT 0,
      financing_term_months INTEGER DEFAULT 48,
      financing_monthly_fee REAL DEFAULT 0,
      financing_monthly_rate REAL DEFAULT 0.015,
      visit_id INTEGER REFERENCES technical_visits(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      interaction_type TEXT DEFAULT 'llamada',
      interest_score INTEGER NOT NULL DEFAULT 7,
      comments TEXT NOT NULL,
      action_taken TEXT DEFAULT 'seguimiento_rutinario',
      next_followup_date DATE,
      desist_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS technical_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_code TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      scheduled_date DATE NOT NULL,
      scheduled_time TEXT DEFAULT '09:00 AM',
      status TEXT DEFAULT 'agendada',
      quote_id INTEGER REFERENCES quotes(id),
      operator TEXT DEFAULT 'Afinia',
      voltage_level TEXT DEFAULT 'Bifásica 120/240V',
      totalizer_breaker_amps INTEGER DEFAULT 50,
      transformer_type TEXT DEFAULT 'compartido',
      transformer_kva REAL DEFAULT 25,
      main_board_location TEXT DEFAULT 'Garaje / Fachada',
      grounding_system_status TEXT DEFAULT 'bueno',
      distance_roof_to_board_m REAL DEFAULT 18,
      distance_inverter_to_board_m REAL DEFAULT 15,
      client_consumption_kwh REAL DEFAULT 0,
      roof_type TEXT DEFAULT 'teja_colonial_barro',
      roof_condition TEXT DEFAULT 'buena',
      beams_condition TEXT DEFAULT 'buena',
      roof_slope_deg REAL DEFAULT 15,
      roof_orientation TEXT DEFAULT 'Sur',
      available_area_m2 REAL DEFAULT 60,
      roof_sections_json TEXT DEFAULT '[]',
      estimated_panels_total INTEGER DEFAULT 0,
      structure_condition TEXT DEFAULT 'bueno',
      structure_material TEXT DEFAULT 'metalica',
      shading_level TEXT DEFAULT 'ninguno',
      inverter_location TEXT DEFAULT 'Pared exterior ventilada',
      battery_location TEXT DEFAULT 'Cuarto de máquinas',
      has_internet_wifi INTEGER DEFAULT 1,
      wifi_signal_strength TEXT DEFAULT 'Buena',
      recommended_system_type TEXT DEFAULT 'ongrid',
      recommended_structure_type TEXT DEFAULT 'Coplanar / Teja',
      photo_meter_ok INTEGER DEFAULT 0,
      photo_transformer_ok INTEGER DEFAULT 0,
      energy_bill_ok INTEGER DEFAULT 0,
      technician_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT 'SOLARTECH COL. S.A.S.',
      nit TEXT DEFAULT '901756614 - 5',
      phone TEXT DEFAULT '+57 300 187 7158',
      email TEXT DEFAULT 'gerenciarenovaenergysas1@gmail.com',
      address TEXT DEFAULT 'Calle 14 # 16A-49 Barrio San José',
      website TEXT DEFAULT 'WWW.RENOVAENERGY.COM',
      legal_rep_name TEXT DEFAULT 'NELLIS ELENA MANJARREZ RODRÍGUEZ',
      legal_rep_doc TEXT DEFAULT '1.052.952.061',
      bank_name TEXT DEFAULT 'Bancolombia',
      bank_account_type TEXT DEFAULT 'Cuenta de Ahorros',
      bank_account_number TEXT DEFAULT '48400003755',
      instagram TEXT DEFAULT 'renovasolarenergy',
      city TEXT DEFAULT 'Magangué',
      department TEXT DEFAULT 'Bolívar',
      default_radiation_coef REAL DEFAULT 10.1,
      default_mdo_rate REAL DEFAULT 400000,
      default_structure_rate REAL DEFAULT 280000,
      default_caja_ac REAL DEFAULT 2000000,
      default_accessories REAL DEFAULT 5000000,
      default_monthly_interest_rate REAL DEFAULT 0.02,
      warranty_panels_years INTEGER DEFAULT 25,
      warranty_inverter_years INTEGER DEFAULT 5,
      warranty_batteries_years INTEGER DEFAULT 10,
      warranty_installation_years INTEGER DEFAULT 2,
      terms_and_conditions TEXT DEFAULT '1. Cotización válida por 15 días calendario.\n2. Incluye trámites ante el operador de red y certificación RETIE.\n3. Formas de pago: 50% anticipo, 40% contra entrega de equipos en sitio, 10% a la conexión y legalización definitiva.\n4. Tiempos de entrega de equipos: 5 a 10 días hábiles.',
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_code TEXT UNIQUE NOT NULL,
      quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      contract_date DATE NOT NULL,
      status TEXT DEFAULT 'borrador',
      legalization_included INTEGER DEFAULT 1,
      total_contract_value REAL NOT NULL DEFAULT 0,
      down_payment_amount REAL NOT NULL DEFAULT 0,
      financed_amount REAL NOT NULL DEFAULT 0,
      has_interest INTEGER DEFAULT 0,
      monthly_interest_rate REAL DEFAULT 0,
      installments_count INTEGER DEFAULT 1,
      first_installment_date DATE,
      installments_schedule_json TEXT DEFAULT '[]',
      is_custom_schedule INTEGER DEFAULT 0,
      execution_time_days INTEGER DEFAULT 180,
      warranty_years_panels INTEGER DEFAULT 25,
      warranty_years_inverter INTEGER DEFAULT 5,
      warranty_years_installation INTEGER DEFAULT 2,
      equipment_summary_json TEXT DEFAULT '{}',
      contractor_rep_name TEXT DEFAULT 'NELLIS ELENA MANJARREZ RODRÍGUEZ',
      contractor_rep_doc TEXT DEFAULT '1.052.952.061',
      custom_clauses TEXT,
      notes TEXT,
      legalization_alert_dismissed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      description TEXT NOT NULL,
      details_json TEXT DEFAULT '{}',
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS network_legalizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expediente_code TEXT UNIQUE NOT NULL,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      operator TEXT DEFAULT 'Afinia',
      status TEXT DEFAULT 'en_tramite',
      nic_number TEXT DEFAULT '',
      radicado_number TEXT DEFAULT '',
      transformer_code TEXT DEFAULT '',
      installed_power_kwp REAL DEFAULT 0,
      system_type TEXT DEFAULT 'ongrid',
      step1_docs_ok INTEGER DEFAULT 0,
      step1_docs_comments TEXT DEFAULT '',
      step1_docs_date DATE,
      step_renova_ok INTEGER DEFAULT 0,
      step_renova_comments TEXT DEFAULT '',
      step_renova_date DATE,
      step2_designs_ok INTEGER DEFAULT 0,
      step2_designs_comments TEXT DEFAULT '',
      step2_designs_date DATE,
      step3_retie_ok INTEGER DEFAULT 0,
      step3_retie_comments TEXT DEFAULT '',
      step3_retie_date DATE,
      step4_radication_ok INTEGER DEFAULT 0,
      step4_radication_comments TEXT DEFAULT '',
      step4_radication_date DATE,
      step5_approval_ok INTEGER DEFAULT 0,
      step5_approval_comments TEXT DEFAULT '',
      step5_approval_date DATE,
      step6_visit_ok INTEGER DEFAULT 0,
      step6_visit_comments TEXT DEFAULT '',
      step6_visit_date DATE,
      step7_meter_ok INTEGER DEFAULT 0,
      step7_meter_comments TEXT DEFAULT '',
      step7_meter_date DATE,
      step8_agpe_ok INTEGER DEFAULT 0,
      step8_agpe_comments TEXT DEFAULT '',
      step8_agpe_date DATE,
      general_notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS technical_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      job_type TEXT DEFAULT 'instalacion',
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT,
      client_phone TEXT,
      client_address TEXT,
      city TEXT,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      technician_name TEXT,
      scheduled_date DATE NOT NULL,
      scheduled_time TEXT DEFAULT '08:00 AM',
      priority TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL DEFAULT 'pendiente',
      description TEXT,
      materials_needed TEXT,
      technician_notes TEXT,
      completed_at DATETIME,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      permissions_json TEXT NOT NULL DEFAULT '[]',
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default system roles exist
  const rolesToEnsure = [
    {
      slug: 'admin',
      name: 'Administrador General',
      description: 'Acceso total y sin restricciones a todos los módulos, ajustes de empresa, seguridad y logs.',
      permissions: ['dashboard', 'visits', 'quotes', 'clients', 'crm', 'contracts', 'legalizations', 'products', 'users', 'company_settings', 'logs', 'jobs'],
      is_system: 1
    },
    {
      slug: 'asesor',
      name: 'Asesor Comercial',
      description: 'Creación de usuarios, programación y registro de visitas, cotizaciones, seguimientos CRM y contratos.',
      permissions: ['dashboard', 'visits', 'quotes', 'clients', 'crm', 'contracts', 'products', 'users', 'jobs'],
      is_system: 0
    },
    {
      slug: 'comercial',
      name: 'Comercial',
      description: 'Gestión y creación de clientes.',
      permissions: ['clients'],
      is_system: 0
    },
    {
      slug: 'tecnico',
      name: 'Técnico de Campo',
      description: 'Levantamiento de visitas técnicas en sitio, ejecución de trabajos y órdenes técnicas asignadas.',
      permissions: ['visits', 'clients', 'legalizations', 'jobs'],
      is_system: 0
    },
    {
      slug: 'ingeniero',
      name: 'Ingeniero Solar',
      description: 'Levantamiento de visitas técnicas, gestión de legalizaciones ante operador de red y ejecución de trabajos técnicos.',
      permissions: ['dashboard', 'visits', 'clients', 'legalizations', 'jobs'],
      is_system: 0
    }
  ];

  const checkRoleStmt = db.prepare('SELECT id FROM roles WHERE slug = ?');
  const insertRoleStmt = db.prepare(`
    INSERT INTO roles (slug, name, description, permissions_json, is_system)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const r of rolesToEnsure) {
    if (!checkRoleStmt.get(r.slug)) {
      insertRoleStmt.run(r.slug, r.name, r.description, JSON.stringify(r.permissions), r.is_system);
    }
  }

  // Cleanup migrations: remove role vendedor and reassign any remaining users to comercial
  try {
    db.prepare("UPDATE users SET role = 'comercial' WHERE role = 'vendedor'").run();
  } catch (e) {}
  try {
    db.prepare("DELETE FROM roles WHERE slug = 'vendedor'").run();
  } catch (e) {}
  try {
    db.prepare("DELETE FROM users WHERE username = 'torres'").run();
  } catch (e) {}

  // Ensure comercial role strictly has clients permissions
  try {
    db.prepare(`UPDATE roles SET permissions_json = '["clients"]', name = 'Comercial' WHERE slug = 'comercial'`).run();
  } catch (e) {}

  // Safe migrations for company_settings
  const companyCols = [
    { col: 'legal_rep_name', type: 'TEXT DEFAULT \'NELLIS ELENA MANJARREZ RODRÍGUEZ\'' },
    { col: 'legal_rep_doc', type: 'TEXT DEFAULT \'1.052.952.061\'' },
    { col: 'bank_name', type: 'TEXT DEFAULT \'Bancolombia\'' },
    { col: 'bank_account_type', type: 'TEXT DEFAULT \'Cuenta de Ahorros\'' },
    { col: 'bank_account_number', type: 'TEXT DEFAULT \'48400003755\'' },
    { col: 'instagram', type: 'TEXT DEFAULT \'renovasolarenergy\'' },
    { col: 'city', type: 'TEXT DEFAULT \'Magangué\'' },
    { col: 'department', type: 'TEXT DEFAULT \'Bolívar\'' },
    { col: 'demo_data_seeded', type: 'INTEGER DEFAULT 0' }
  ];
  for (const c of companyCols) {
    try {
      db.exec(`ALTER TABLE company_settings ADD COLUMN ${c.col} ${c.type};`);
    } catch (e) {}
  }

  // Safe migrations for quotes table
  try {
    db.exec('ALTER TABLE quotes ADD COLUMN financing_monthly_rate REAL DEFAULT 0.015;');
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE quotes ADD COLUMN visit_id INTEGER REFERENCES technical_visits(id);');
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE contracts ADD COLUMN legalization_alert_dismissed INTEGER DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }

  // Safe migrations for technical_visits table
  const visitCols = [
    { col: 'distance_inverter_to_board_m', type: 'REAL DEFAULT 15' },
    { col: 'roof_condition', type: "TEXT DEFAULT 'buena'" },
    { col: 'beams_condition', type: "TEXT DEFAULT 'buena'" },
    { col: 'roof_sections_json', type: "TEXT DEFAULT '[]'" },
    { col: 'estimated_panels_total', type: 'INTEGER DEFAULT 0' },
    { col: 'photo_meter_ok', type: 'INTEGER DEFAULT 0' },
    { col: 'photo_transformer_ok', type: 'INTEGER DEFAULT 0' },
    { col: 'energy_bill_ok', type: 'INTEGER DEFAULT 0' }
  ];
  for (const c of visitCols) {
    try {
      db.exec(`ALTER TABLE technical_visits ADD COLUMN ${c.col} ${c.type};`);
    } catch (e) {}
  }

  // Safe migration for username in users table
  try {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT;');
  } catch (e) {
    // Column already exists
  }

  // Populate usernames if null or empty
  try {
    const usersWithoutUsername = db.prepare("SELECT id, name, email, role FROM users WHERE username IS NULL OR TRIM(username) = ''").all();
    for (const u of usersWithoutUsername) {
      let uname = '';
      const emailLower = (u.email || '').toLowerCase();
      if (emailLower.includes('anuar')) {
        uname = 'anuar';
      } else if (emailLower.includes('admin')) {
        uname = 'admin';
      } else if (emailLower.includes('ventas')) {
        uname = 'ventas';
      } else if (emailLower.includes('comercial')) {
        uname = 'comercial';
      } else if (emailLower.includes('tecnico')) {
        uname = 'tecnico';
      } else {
        uname = emailLower.split('@')[0].replace(/[^a-z0-9_]/g, '') || `usuario_${u.id}`;
      }

      // Check collision
      const collision = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(username)) = ? AND id != ?').get(uname, u.id);
      if (collision) {
        uname = `${uname}_${u.id}`;
      }

      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(uname, u.id);
    }
  } catch (err) {
    console.warn('Error during username migration:', err.message);
  }

  // Safe migration for network_legalizations to allow creating without contract
  try {
    const legCols = db.prepare('PRAGMA table_info(network_legalizations)').all();
    const contractCol = legCols.find(c => c.name === 'contract_id');
    if (contractCol && contractCol.notnull === 1) {
      db.exec(`
        CREATE TABLE network_legalizations_mig (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expediente_code TEXT UNIQUE NOT NULL,
          contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id),
          operator TEXT DEFAULT 'Enel',
          status TEXT DEFAULT 'en_tramite',
          nic_number TEXT DEFAULT '',
          radicado_number TEXT DEFAULT '',
          transformer_code TEXT DEFAULT '',
          installed_power_kwp REAL DEFAULT 0,
          system_type TEXT DEFAULT 'ongrid',
          step1_docs_ok INTEGER DEFAULT 0,
          step1_docs_comments TEXT DEFAULT '',
          step1_docs_date DATE,
          step2_designs_ok INTEGER DEFAULT 0,
          step2_designs_comments TEXT DEFAULT '',
          step2_designs_date DATE,
          step3_retie_ok INTEGER DEFAULT 0,
          step3_retie_comments TEXT DEFAULT '',
          step3_retie_date DATE,
          step4_radication_ok INTEGER DEFAULT 0,
          step4_radication_comments TEXT DEFAULT '',
          step4_radication_date DATE,
          step5_approval_ok INTEGER DEFAULT 0,
          step5_approval_comments TEXT DEFAULT '',
          step5_approval_date DATE,
          step6_visit_ok INTEGER DEFAULT 0,
          step6_visit_comments TEXT DEFAULT '',
          step6_visit_date DATE,
          step7_meter_ok INTEGER DEFAULT 0,
          step7_meter_comments TEXT DEFAULT '',
          step7_meter_date DATE,
          step8_agpe_ok INTEGER DEFAULT 0,
          step8_agpe_comments TEXT DEFAULT '',
          step8_agpe_date DATE,
          general_notes TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO network_legalizations_mig SELECT * FROM network_legalizations;
        DROP TABLE network_legalizations;
        ALTER TABLE network_legalizations_mig RENAME TO network_legalizations;
      `);
    }
  } catch (legMigErr) {
    // Already relaxed or fresh table
  }

  // Safe migration for step_renova columns in network_legalizations
  try {
    const legCols = db.prepare('PRAGMA table_info(network_legalizations)').all();
    const hasRenova = legCols.some(c => c.name === 'step_renova_ok');
    if (!hasRenova) {
      db.exec(`
        ALTER TABLE network_legalizations ADD COLUMN step_renova_ok INTEGER DEFAULT 0;
        ALTER TABLE network_legalizations ADD COLUMN step_renova_comments TEXT DEFAULT '';
        ALTER TABLE network_legalizations ADD COLUMN step_renova_date DATE;
      `);
      console.log('Migrated network_legalizations: added step_renova columns.');
    }
  } catch (renovaMigErr) {
    console.warn('Error checking/migrating step_renova columns:', renovaMigErr.message);
  }

  // Safe migration for contracts table legalization_included
  try {
    const contractCols = db.prepare('PRAGMA table_info(contracts)').all();
    if (!contractCols.some(c => c.name === 'legalization_included')) {
      db.exec('ALTER TABLE contracts ADD COLUMN legalization_included INTEGER DEFAULT 1;');
    }
  } catch (e) {}

  // Safe migration for clients table user_id column
  try {
    const clientCols = db.prepare('PRAGMA table_info(clients)').all();
    if (!clientCols.some(c => c.name === 'user_id')) {
      db.exec('ALTER TABLE clients ADD COLUMN user_id INTEGER;');
    }
  } catch (e) {}

  // Safe migration for clients table nic_number column
  try {
    const clientCols = db.prepare('PRAGMA table_info(clients)').all();
    if (!clientCols.some(c => c.name === 'nic_number')) {
      db.exec("ALTER TABLE clients ADD COLUMN nic_number TEXT DEFAULT '';");
      console.log('Migrated clients table: added nic_number column.');
    }
  } catch (e) {}

  // Ensure all existing roles have jobs permission
  try {
    const rolesList = db.prepare('SELECT id, slug, permissions_json FROM roles').all();
    for (const r of rolesList) {
      try {
        const perms = JSON.parse(r.permissions_json || '[]');
        if (Array.isArray(perms) && !perms.includes('jobs')) {
          perms.push('jobs');
          db.prepare('UPDATE roles SET permissions_json = ? WHERE id = ?').run(JSON.stringify(perms), r.id);
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Safe update of default monthly interest rate to 2% (0.02) if at 0.015 or null
  try {
    db.exec('UPDATE company_settings SET default_monthly_interest_rate = 0.02 WHERE default_monthly_interest_rate = 0.015 OR default_monthly_interest_rate IS NULL;');
  } catch (e) {}

  // Safe update of default Caja AC to $2.500.000 if at 2.000.000 or null
  try {
    db.exec('UPDATE company_settings SET default_caja_ac = 2500000 WHERE default_caja_ac = 2000000 OR default_caja_ac IS NULL;');
  } catch (e) {}

  // Seed product categories if empty
  try {
    const catCount = db.prepare('SELECT COUNT(*) as count FROM product_categories').get().count;
    if (catCount === 0) {
      const defaultCats = [
        { name: 'paneles', label: '☀️ Paneles Solares', icon: 'SunMedium' },
        { name: 'inversores', label: '⚡ Inversores', icon: 'Zap' },
        { name: 'baterias', label: '🔋 Baterías Litio/Gel', icon: 'BatteryCharging' },
        { name: 'bombas', label: '💧 Bombeo Solar', icon: 'Droplets' },
        { name: 'variadores', label: '🎛️ Variadores Solares', icon: 'Layers' },
        { name: 'estructuras', label: '🏗️ Estructuras', icon: 'Wrench' },
        { name: 'mdo', label: '👷 Mano de Obra', icon: 'Wrench' },
        { name: 'legalizacion', label: '📑 Legalización & RETIE', icon: 'ShieldCheck' },
        { name: 'accesorios', label: '🔌 Accesorios', icon: 'Package' }
      ];
      const insertCat = db.prepare('INSERT OR IGNORE INTO product_categories (name, label, icon) VALUES (?, ?, ?)');
      for (const c of defaultCats) {
        insertCat.run(c.name, c.label, c.icon);
      }
    }
  } catch (e) {}

  // Seed initial audit log entries if empty
  try {
    const existingLog = db.prepare('SELECT id FROM audit_logs LIMIT 1').get();
    if (!existingLog) {
      const initialLogs = [
        {
          user_name: 'Sistema',
          action: 'SISTEMA_INICIADO',
          module: 'seguridad',
          entity_type: 'Sistema',
          entity_id: 'v2.0',
          description: 'Inicialización de la base de datos y módulo de auditoría de seguridad.'
        },
        {
          user_name: 'anuardavid',
          action: 'LOGIN_EXITOSO',
          module: 'seguridad',
          entity_type: 'Usuario',
          entity_id: 'anuardavid',
          description: 'Inicio de sesión del administrador general verificado con éxito.'
        },
        {
          user_name: 'anuardavid',
          action: 'CREAR',
          module: 'usuarios',
          entity_type: 'Usuario',
          entity_id: 'ivan',
          description: 'Usuario asesor comercial ivan creado y asegurado en Supabase Cloud.'
        },
        {
          user_name: 'ventas',
          action: 'ACTUALIZAR',
          module: 'cotizaciones',
          entity_type: 'Cotización',
          entity_id: 'COT-2026-001',
          description: 'Actualización de propuesta técnica y cálculo de potencia instalada.'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO audit_logs (user_name, action, module, entity_type, entity_id, description, details_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, '{}', '127.0.0.1')
      `);
      for (const l of initialLogs) {
        stmt.run(l.user_name, l.action, l.module, l.entity_type, l.entity_id, l.description);
      }
    }
  } catch (err) {
    console.warn('Error seeding initial audit logs:', err.message);
  }

  console.log('Database initialized with technical_visits table, audit_logs and migrations.');
}

/**
 * Record an entry into the audit_logs table
 */
export function recordAuditLog({
  userId = null,
  userName = 'Sistema',
  action = 'ACTUALIZAR',
  module = 'general',
  entityType = '',
  entityId = '',
  description = '',
  details = {},
  ip = ''
}) {
  try {
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details || {});
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, module, entity_type, entity_id, description, details_json, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userName || 'Sistema', action, module, entityType, String(entityId || ''), description, detailsStr, ip || '');
  } catch (err) {
    console.warn('[Audit Log Warning]:', err.message);
  }
}

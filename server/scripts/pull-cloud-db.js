import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xyrahrsqyanrebqmvvad.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cmFocnNxeWFucmVicW12dmFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUxMDEwNywiZXhwIjoyMTA1MDg2MTA3fQ.sS2kSj9wQ_faxFzMcwsutc5-Dt6hGBfBf834ib3lRis';

const dataDir = path.join(__dirname, '..', '..', 'data');
const backupsDir = path.join(dataDir, 'backups');
const targetFile = path.join(dataDir, 'solarquote.db');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

async function main() {
  console.log('[Pull Cloud DB] Connecting to Supabase Storage...');
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/cotizador-db/solarquote.db`, {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });

    if (!res.ok) {
      console.warn(`[Pull Cloud DB] Warning: HTTP ${res.status} from Supabase. Keeping existing local database.`);
      return;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50000 || buf.subarray(0, 15).toString() !== 'SQLite format 3') {
      console.warn(`[Pull Cloud DB] Downloaded file does not appear to be a valid SQLite database (${buf.length} bytes). Keeping local database.`);
      return;
    }

    // Save timestamped local backup snapshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSnapshot = path.join(backupsDir, `solarquote_prebuild_${timestamp}.db`);
    fs.writeFileSync(backupSnapshot, buf);

    // Update active local database
    fs.writeFileSync(targetFile, buf);
    console.log(`[Pull Cloud DB] Successfully updated local DB (${buf.length} bytes) and created backup snapshot: ${path.basename(backupSnapshot)}`);
  } catch (err) {
    console.warn('[Pull Cloud DB] Network notice during cloud pull:', err.message, '- Continuing with local DB.');
  }
}

main();

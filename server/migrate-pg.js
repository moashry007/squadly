import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { db, initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TABLES = [
  { name: 'system_parameters', pk: 'key' },
  { name: 'hobbies', pk: 'id' },
  { name: 'venues', pk: 'id' },
  { name: 'users', pk: 'id' },
  { name: 'otp_requests', pk: 'mobile' },
  { name: 'verifications', pk: 'id' },
  { name: 'activities', pk: 'id' },
  { name: 'participations', pk: 'id' },
  { name: 'chat_messages', pk: 'id' },
  { name: 'ratings', pk: 'id' },
  { name: 'reports', pk: 'id' },
  { name: 'blocks', pk: 'id' },
  { name: 'sos_alerts', pk: 'id' },
  { name: 'safety_flags', pk: 'id' },
  { name: 'notifications', pk: 'id' },
  { name: 'subscriptions', pk: 'id' },
  { name: 'promo_codes', pk: 'code' },
  { name: 'hobby_suggestions', pk: 'id' },
  { name: 'admin_accounts', pk: 'id' },
  { name: 'audit_logs', pk: 'id' },
];

async function migrateAndSeedPostgres() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.');
    console.error('   Add your Supabase or Neon connection URI to f:\\Squadly\\.env:');
    console.error('   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"');
    process.exit(1);
  }

  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('1. Connecting to PostgreSQL / Supabase...');
    const client = await pool.connect();
    try {
      const sql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
      await client.query(sql);
      console.log('✓ 20 PostgreSQL tables & indexes created/verified from server/schema.postgres.sql');

      // Ensure local catalog is initialized so we can seed Postgres with initial Cairo data
      initDb();

      console.log('2. Seeding initial Greater Cairo catalog & accounts into PostgreSQL...');
      for (const tbl of TABLES) {
        const rows = db.prepare(`SELECT * FROM ${tbl.name}`).all();
        if (!rows.length) continue;

        const cols = Object.keys(rows[0]);
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
        const updateSet = cols
          .filter((c) => c !== tbl.pk)
          .map((c) => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');

        const upsertSql = updateSet
          ? `INSERT INTO ${tbl.name} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${tbl.pk}") DO UPDATE SET ${updateSet}`
          : `INSERT INTO ${tbl.name} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${tbl.pk}") DO NOTHING`;

        for (const r of rows) {
          const vals = cols.map((c) => r[c]);
          await client.query(upsertSql, vals);
        }
        console.log(`   ✓ Synced ${rows.length} rows -> ${tbl.name}`);
      }

      console.log('🎉 PostgreSQL / Supabase migration and seed completed successfully!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ PostgreSQL migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAndSeedPostgres();

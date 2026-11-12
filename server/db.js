import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'squadly_prod.sqlite');

export const db = new DatabaseSync(dbPath);

// PostgreSQL / Supabase Pool (Active whenever DATABASE_URL is set in .env)
const isLocalPg =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));

export const pgPool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalPg ? false : { rejectUnauthorized: false },
    })
  : null;

export function hashDocNumber(docNum) {
  return crypto
    .createHash('sha256')
    .update(`squadly_salt_2027_${String(docNum).trim().toUpperCase()}`)
    .digest('hex');
}

export function hashPassword(password) {
  const salt = 'squadly_admin_salt_2027';
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

export function hashOtp(mobile, code) {
  return crypto
    .createHash('sha256')
    .update(`squadly_otp_${mobile}_${code}`)
    .digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'squadly_prod_jwt_secret_2027_cairo_eg';

export function signJwt(payload, expiresInSeconds = 86400 * 60) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Signed rotating 60-second QR Check-in Token (UC-29 & Section 11.2)
export function generateQrToken(activityId, userId) {
  const windowSlot = Math.floor(Date.now() / 60000); // rotates every 60 seconds
  const raw = `${activityId}:${userId}:${windowSlot}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(raw).digest('hex').slice(0, 8).toUpperCase();
  const payload = Buffer.from(`${activityId}|${userId}|${windowSlot}|${sig}`).toString('base64url');
  return {
    qrPayload: `squadly://checkin/${payload}`,
    shortCode: `${sig.slice(0, 6)}`,
    expiresInSeconds: 60 - (Math.floor(Date.now() / 1000) % 60),
  };
}

export function verifyQrToken(activityId, scannedInput) {
  if (!scannedInput) return null;
  const clean = String(scannedInput).trim();
  const currentSlot = Math.floor(Date.now() / 60000);

  // Check if full squadly://checkin/ URI was scanned via camera
  if (clean.startsWith('squadly://checkin/')) {
    try {
      const b64 = clean.replace('squadly://checkin/', '');
      const decoded = Buffer.from(b64, 'base64url').toString('utf-8');
      const [actId, userId, slotStr, sig] = decoded.split('|');
      if (actId !== activityId) return null;
      const slot = Number(slotStr);
      if (Math.abs(currentSlot - slot) > 1) return null; // Expired (>60s)
      const expected = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${actId}:${userId}:${slot}`)
        .digest('hex')
        .slice(0, 8)
        .toUpperCase();
      if (sig === expected) return userId;
    } catch {
      return null;
    }
  }

  // Or check 6-char short code against confirmed participants of this activity
  const confirmed = db
    .prepare("SELECT user_id FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in')")
    .all(activityId);

  for (const row of confirmed) {
    for (const slot of [currentSlot, currentSlot - 1]) {
      const expectedShort = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${activityId}:${row.user_id}:${slot}`)
        .digest('hex')
        .slice(0, 6)
        .toUpperCase();
      if (clean.toUpperCase() === expectedShort) {
        return row.user_id;
      }
    }
  }
  return null;
}

// GBR-09: Detect phone numbers, email addresses, social-media handles and links in English & Arabic
export function containsContactDetails(text) {
  if (!text) return false;
  const s = String(text);
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(s)) return true;
  if (/(https?:\/\/|www\.|\.(com|net|org|eg|me|io)\b)/i.test(s)) return true;
  if (/(^|\s)@[a-zA-Z0-9_.]{2,}/i.test(s)) return true;
  if (/\b(whatsapp|واتساب|واتس|انستجرام|انستا|instagram|insta|telegram|تليجرام|facebook|فيسبوك|snapchat|سناب)\b/i.test(s)) return true;
  const normalizedDigits = s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const digitsOnly = normalizedDigits.replace(/[\s\-().+]/g, '');
  if (/\b01[0125]\d{8}\b/.test(digitsOnly) || /\d{8,}/.test(digitsOnly)) return true;
  const numberWords = /\b(zero|one|two|three|four|five|six|seven|eight|nine|صفر|واحد|اتنين|اثنين|تلاتة|ثلاثة|اربعة|أربعة|خمسة|ستة|سبعة|تمانية|ثمانية|تسعة|زيرو)\b/gi;
  const matches = s.match(numberWords);
  if (matches && matches.length >= 5) return true;
  return false;
}

export function getDisplayName(fullName) {
  if (!fullName) return 'Member';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export function getAgeFromDob(dob) {
  if (!dob) return 28;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function getAgeRangeLabel(dob) {
  const age = getAgeFromDob(dob);
  if (age < 25) return '18–24';
  if (age < 35) return '25–34';
  if (age < 45) return '35–44';
  return '45+';
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_parameters (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label_en TEXT NOT NULL,
      label_ar TEXT NOT NULL,
      category TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hobbies (
      id TEXT PRIMARY KEY,
      name_en TEXT UNIQUE NOT NULL,
      name_ar TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL,
      min_slots INTEGER NOT NULL CHECK(min_slots >= 3),
      max_slots INTEGER NOT NULL CHECK(max_slots <= 50),
      default_duration INTEGER NOT NULL,
      outdoor INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Active',
      display_order INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      address TEXT NOT NULL,
      area TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Cairo',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      venue_type TEXT NOT NULL,
      supported_hobbies TEXT NOT NULL,
      public_place_confirmed INTEGER NOT NULL DEFAULT 1,
      opening_hours TEXT,
      status TEXT NOT NULL DEFAULT 'Approved',
      proposed_by TEXT,
      rejection_reason TEXT,
      unsafe_reports_30d INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      mobile TEXT UNIQUE NOT NULL,
      full_name TEXT,
      display_name TEXT,
      dob TEXT,
      gender TEXT,
      city TEXT DEFAULT 'Cairo',
      area TEXT DEFAULT 'Sheikh Zayed',
      email TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      profile_photo TEXT,
      pending_photo TEXT,
      interests TEXT DEFAULT '[]',
      emergency_name TEXT,
      emergency_mobile TEXT,
      emergency_relation TEXT,
      terms_version TEXT DEFAULT '1.1',
      terms_accepted_at TEXT,
      account_status TEXT NOT NULL DEFAULT 'Registered',
      suspended_until TEXT,
      suspension_reason TEXT,
      organizing_suspended_until TEXT,
      verification_status TEXT NOT NULL DEFAULT 'Not submitted',
      verification_attempts INTEGER NOT NULL DEFAULT 0,
      verification_rejection_reason TEXT,
      doc_type TEXT,
      doc_hash TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'None',
      subscription_start TEXT,
      subscription_end TEXT,
      free_first_activity_used INTEGER NOT NULL DEFAULT 0,
      approved_activities_count INTEGER NOT NULL DEFAULT 0,
      probation_ended INTEGER NOT NULL DEFAULT 0,
      activities_attended INTEGER NOT NULL DEFAULT 0,
      activities_organized INTEGER NOT NULL DEFAULT 0,
      participant_strikes REAL NOT NULL DEFAULT 0,
      organizer_strikes INTEGER NOT NULL DEFAULT 0,
      rating_avg REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      top_tags TEXT DEFAULT '[]',
      false_severe_reports INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'en',
      notif_interest_matches INTEGER NOT NULL DEFAULT 1,
      active_session_token TEXT,
      lat REAL NOT NULL DEFAULT 30.0444,
      lng REAL NOT NULL DEFAULT 31.2357,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_requests (
      mobile TEXT PRIMARY KEY,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_sent_at TEXT NOT NULL,
      resends_this_hour INTEGER NOT NULL DEFAULT 0,
      wrong_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    );

    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Identity',
      doc_type TEXT NOT NULL,
      doc_number_masked TEXT,
      doc_hash TEXT,
      front_image TEXT,
      back_image TEXT,
      selfie_image TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      rejection_reason TEXT,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      hobby_id TEXT NOT NULL,
      organizer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      venue_id TEXT NOT NULL,
      area TEXT NOT NULL,
      total_slots INTEGER NOT NULL,
      min_to_run INTEGER NOT NULL CHECK(min_to_run >= 3),
      confirmation_deadline_hours INTEGER NOT NULL DEFAULT 6,
      gender_type TEXT NOT NULL DEFAULT 'Mixed',
      skill_level TEXT NOT NULL DEFAULT 'All levels',
      age_min INTEGER,
      age_max INTEGER,
      join_mode TEXT NOT NULL DEFAULT 'Approval',
      fee_required INTEGER NOT NULL DEFAULT 0,
      fee_amount INTEGER NOT NULL DEFAULT 0,
      fee_covers TEXT,
      status TEXT NOT NULL DEFAULT 'Published',
      change_pending INTEGER NOT NULL DEFAULT 0,
      change_payload TEXT,
      change_deadline TEXT,
      cancel_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participations (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_organizer INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Confirmed',
      waitlist_pos INTEGER,
      offer_expires_at TEXT,
      request_expires_at TEXT,
      checked_in_at TEXT,
      organizer_confirmed INTEGER DEFAULT 0,
      used_free_activity INTEGER NOT NULL DEFAULT 0,
      dispute_status TEXT,
      dispute_reason TEXT,
      disputed_at TEXT,
      muted_chat INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(activity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      audio_data TEXT,
      voice_duration INTEGER,
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
      positive_tags TEXT DEFAULT '[]',
      negative_tags TEXT DEFAULT '[]',
      private_feedback TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(activity_id, from_user_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_user_id TEXT,
      activity_id TEXT,
      message_id TEXT,
      category TEXT NOT NULL,
      is_severe INTEGER NOT NULL DEFAULT 0,
      details TEXT,
      evidence_json TEXT,
      status TEXT NOT NULL DEFAULT 'Received',
      outcome TEXT,
      admin_note TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS safety_flags (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      target_user_id TEXT,
      activity_id TEXT,
      venue_id TEXT,
      description TEXT NOT NULL,
      evidence TEXT,
      status TEXT NOT NULL DEFAULT 'Open',
      admin_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      body_en TEXT NOT NULL,
      body_ar TEXT NOT NULL,
      channels TEXT NOT NULL DEFAULT 'Push, In-app',
      related_activity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount_egp INTEGER NOT NULL,
      promo_code TEXT,
      payment_method TEXT NOT NULL DEFAULT 'Card',
      transaction_ref TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      refund_requested INTEGER NOT NULL DEFAULT 0,
      refund_reason TEXT,
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      discount_fixed INTEGER NOT NULL DEFAULT 0,
      valid_until TEXT NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 100,
      used_count INTEGER NOT NULL DEFAULT 0,
      applies_to TEXT NOT NULL DEFAULT 'both',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS hobby_suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      typical_group_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      two_fa_secret TEXT NOT NULL DEFAULT '123456',
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_name TEXT NOT NULL,
      admin_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      before_val TEXT,
      after_val TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const hobbyCount = db.prepare('SELECT COUNT(*) as c FROM hobbies').get().c;
  if (hobbyCount === 0) {
    seedInitialCatalog();
  }

  // If Cloud PostgreSQL (Supabase / Neon) is configured in .env, auto-migrate & sync
  if (pgPool) {
    syncPostgresTables().catch((err) => {
      console.error('PostgreSQL background sync warning:', err.message);
    });
  }
}

export async function syncPostgresTables() {
  if (!pgPool) return { synced: false, reason: 'DATABASE_URL not set' };
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
  await pgPool.query(schemaSql);

  const tables = [
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

  let totalRows = 0;
  for (const tbl of tables) {
    const rows = db.prepare(`SELECT * FROM ${tbl.name}`).all();
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(', ');
    const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
    const updateSet = cols
      .filter((c) => c !== tbl.pk)
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');
    const sql = updateSet
      ? `INSERT INTO ${tbl.name} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${tbl.pk}") DO UPDATE SET ${updateSet}`
      : `INSERT INTO ${tbl.name} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${tbl.pk}") DO NOTHING`;
    for (const r of rows) {
      await pgPool.query(sql, cols.map((c) => r[c]));
      totalRows++;
    }
  }
  return { synced: true, tables: tables.length, totalRows };
}

function seedInitialCatalog() {
  const now = new Date();
  const isoNow = now.toISOString();
  const fmtDateOffset = (days) => new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];

  // 1. System Parameters (Section 12)
  const params = [
    ['subscription_price_egp', '250', 'Subscription price (EGP / year, VAT incl.)', 'سعر الاشتراك السنوي (جنيه شامل الضريبة)', 'Membership'],
    ['free_first_activity', '1', 'Free first activity per user (lifetime)', 'أول نشاط مجاني لكل مستخدم', 'Membership'],
    ['min_people_per_activity', '3', 'Minimum people per activity (Fixed GBR-01)', 'الحد الأدنى للمشاركين في أي نشاط (ثابت)', 'Safety'],
    ['scheduling_window_hours_min', '2', 'Minimum hours ahead to schedule', 'الحد الأدنى للجدولة مقدماً (ساعات)', 'Scheduling'],
    ['scheduling_window_days_max', '30', 'Maximum days ahead to schedule', 'الحد الأقصى للجدولة مقدماً (أيام)', 'Scheduling'],
    ['allowed_hours', '06:00–22:00', 'Allowed activity hours (all year, Cairo time)', 'ساعات الأنشطة المسموحة طوال العام', 'Scheduling'],
    ['max_active_activities_organizer', '3', 'Max active activities per organizer', 'الحد الأقصى للأنشطة النشطة لكل منظم', 'Organizing'],
    ['probation_activities_count', '3', 'Probation activities needing admin approval', 'عدد أنشطة فترة الاختبار للمنظم الجديد', 'Organizing'],
    ['max_upcoming_bookings_user', '5', 'Max upcoming bookings per user', 'الحد الأقصى للحجوزات القادمة للمستخدم', 'Joining'],
    ['time_clash_buffer_mins', '30', 'Time-clash buffer between activities (minutes)', 'الفاصل الزمني لمنع التعارض (دقيقة)', 'Joining'],
    ['default_search_radius_km', '15', 'Default search radius (km)', 'نطاق البحث الافتراضي (كم)', 'Discovery'],
    ['checkin_window_mins', '30', 'Check-in window before/after start (minutes)', 'نافذة تسجيل الحضور قبل وبعد البداية (دقيقة)', 'Safety'],
    ['voice_note_max_sec', '60', 'Max voice note length (seconds)', 'الحد الأقصى للرسالة الصوتية (ثانية)', 'Chat'],
    ['verification_sla_hours', '48', 'Identity verification review SLA (hours)', 'مهلة مراجعة توثيق الهوية (ساعة)', 'Moderation'],
    ['severe_report_sla_hours', '24', 'Severe report decision SLA (hours)', 'مهلة البت في البلاغات الجسيمة (ساعة)', 'Moderation'],
  ];
  const insertParam = db.prepare('INSERT INTO system_parameters VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of params) insertParam.run(p[0], p[1], p[2], p[3], p[4], isoNow);

  // 2. Hobbies Catalog (Section 6.3 - AS-03)
  const hobbies = [
    ['hob-padel', 'Padel', 'بادل', '🎾', 4, 8, 90, 1, 'Active', 1],
    ['hob-football', 'Football', 'كرة قدم', '⚽', 6, 22, 90, 1, 'Active', 2],
    ['hob-basketball', 'Basketball', 'كرة سلة', '🏀', 6, 12, 60, 1, 'Active', 3],
    ['hob-running', 'Running', 'جري', '🏃', 3, 25, 60, 1, 'Active', 4],
    ['hob-volleyball', 'Volleyball', 'كرة طائرة', '🏐', 6, 14, 90, 1, 'Active', 5],
    ['hob-cycling', 'Cycling', 'دراجات', '🚴', 3, 20, 90, 1, 'Active', 6],
    ['hob-hiking', 'Hiking', 'مشي لمسافات', '🥾', 4, 25, 180, 1, 'Active', 7],
    ['hob-boardgames', 'Board Games', 'ألعاب لوحية', '🎲', 3, 10, 120, 0, 'Active', 8],
  ];
  const insertHobby = db.prepare('INSERT INTO hobbies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const h of hobbies) insertHobby.run(...h);

  // 3. Vetted Public Venues in Greater Cairo (Section 6.4 - AS-03)
  const venues = [
    ['ven-1', 'Padel In — Sheikh Zayed', 'بادل إن — الشيخ زايد', 'Arkan Plaza Extension, 26th of July Corridor', 'Sheikh Zayed', 'Cairo', 30.0195, 31.0023, 'Court', JSON.stringify(['hob-padel']), 1, '06:00 - 22:00', 'Approved', null, null, 0, isoNow],
    ['ven-2', 'The Hub Sports Club — New Cairo', 'ذا هب سبورتس كلوب — القاهرة الجديدة', 'Fifth Settlement, North 90th St', 'New Cairo', 'Cairo', 30.0254, 31.4913, 'Sports club', JSON.stringify(['hob-padel', 'hob-football', 'hob-basketball', 'hob-running']), 1, '06:00 - 22:00', 'Approved', null, null, 0, isoNow],
    ['ven-3', 'Maadi Sporting & Yacht Club Courts', 'ملاعب نادي المعادي الرياضي', 'Road 18, Sarayat El Maadi', 'Maadi', 'Cairo', 29.9626, 31.2589, 'Sports club', JSON.stringify(['hob-padel', 'hob-volleyball', 'hob-running', 'hob-basketball']), 1, '06:00 - 22:00', 'Approved', null, null, 0, isoNow],
    ['ven-4', 'Gezira Sporting Club Track & Courts', 'مضمار وملاعب نادي الجزيرة', 'Saray El Gezira St, Zamalek', 'Zamalek', 'Cairo', 30.0561, 31.2219, 'Sports club', JSON.stringify(['hob-running', 'hob-padel', 'hob-basketball', 'hob-football']), 1, '06:00 - 22:00', 'Approved', null, null, 0, isoNow],
    ['ven-5', 'Wadi Degla Protectorate Trail', 'محمية وادي دجلة', 'Wadi Degla Gate, Zahraa El Maadi', 'Maadi', 'Cairo', 29.9550, 31.3301, 'Park', JSON.stringify(['hob-hiking', 'hob-running', 'hob-cycling']), 1, '06:00 - 18:00', 'Approved', null, null, 0, isoNow],
    ['ven-6', 'Room Art Space & Board Café', 'رووم آرت سبيس وكافيه الألعاب', 'Fifth Settlement, New Cairo', 'New Cairo', 'Cairo', 30.0332, 31.4750, 'Café', JSON.stringify(['hob-boardgames']), 1, '10:00 - 22:00', 'Approved', null, null, 0, isoNow],
    ['ven-7', 'Heliopolis Sporting Arena', 'ملاعب هليوبوليس الرياضية', 'El Merghany St, Heliopolis', 'Heliopolis', 'Cairo', 30.0875, 31.3284, 'Court', JSON.stringify(['hob-football', 'hob-padel', 'hob-volleyball']), 1, '06:00 - 22:00', 'Approved', null, null, 0, isoNow],
  ];
  const insertVenue = db.prepare('INSERT INTO venues VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const v of venues) insertVenue.run(...v);

  // 4. Initial Verified Organizers & Members in Greater Cairo
  const nextYear = fmtDateOffset(340);
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, mobile, full_name, display_name, dob, gender, city, area, email, email_verified,
      profile_photo, interests, emergency_name, emergency_mobile, emergency_relation,
      terms_version, terms_accepted_at, account_status, verification_status, doc_type, doc_hash,
      subscription_status, subscription_start, subscription_end, free_first_activity_used,
      approved_activities_count, probation_ended, activities_attended, activities_organized,
      participant_strikes, organizer_strikes, rating_avg, rating_count, top_tags, lat, lng, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1.1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'usr-yara', '01055551234', 'Yara Mostafa', 'Yara M.', '1997-04-15', 'Female', 'Cairo', 'Sheikh Zayed',
    'yara.mostafa@squadly.eg', 1,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
    JSON.stringify([{ hobbyId: 'hob-padel', skillLevel: 'Intermediate' }, { hobbyId: 'hob-running', skillLevel: 'Beginner' }]),
    'Nadia Mostafa', '01099887766', 'Parent', isoNow, 'Verified', 'Approved', 'National ID', hashDocNumber('29704150101234'),
    'Active', fmtDateOffset(-25), nextYear, 1, 4, 1, 11, 4, 0, 0, 4.9, 9, JSON.stringify(['On time', 'Friendly', 'Good sport']),
    30.025, 31.015, isoNow
  );

  insertUser.run(
    'usr-omar', '01122334455', 'Omar Hassan', 'Omar H.', '1994-09-20', 'Male', 'Cairo', 'Sheikh Zayed',
    'omar.hassan@squadly.eg', 1,
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
    JSON.stringify([{ hobbyId: 'hob-padel', skillLevel: 'Intermediate' }, { hobbyId: 'hob-football', skillLevel: 'Advanced' }]),
    'Karim Hassan', '01234567890', 'Sibling', isoNow, 'Verified', 'Approved', 'National ID', hashDocNumber('29409200105678'),
    'Active', fmtDateOffset(-60), nextYear, 1, 7, 1, 18, 7, 0, 0, 4.9, 14, JSON.stringify(['Well organized', 'On time', 'Skilled']),
    30.021, 31.005, isoNow
  );

  insertUser.run(
    'usr-layla', '01288776655', 'Layla Mostafa', 'Layla M.', '1999-02-10', 'Female', 'Cairo', 'Maadi',
    'layla.m@squadly.eg', 1,
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80',
    JSON.stringify([{ hobbyId: 'hob-padel', skillLevel: 'Intermediate' }, { hobbyId: 'hob-hiking', skillLevel: 'Intermediate' }]),
    'Salma Mostafa', '01011223344', 'Sibling', isoNow, 'Verified', 'Approved', 'National ID', hashDocNumber('29902100109988'),
    'Active', fmtDateOffset(-10), nextYear, 1, 1, 0, 6, 1, 0, 0, 4.8, 5, JSON.stringify(['Friendly', 'Good sport']),
    29.962, 31.260, isoNow
  );

  // 5. Initial Published Activities in Greater Cairo
  const insertActivity = db.prepare(`
    INSERT INTO activities (
      id, hobby_id, organizer_id, title, description, date, start_time, duration,
      venue_id, area, total_slots, min_to_run, confirmation_deadline_hours,
      gender_type, skill_level, age_min, age_max, join_mode, fee_required, fee_amount, fee_covers,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertActivity.run(
    'act-1', 'hob-padel', 'usr-omar', 'Friday Night Padel — Mixed Doubles',
    'Casual but competitive doubles match at Padel In. Intermediate level. Bring your own racket if possible — rentals available on site.',
    fmtDateOffset(1), '20:00', 90, 'ven-1', 'Sheikh Zayed', 4, 4, 6, 'Mixed', 'Intermediate', 21, 40, 'Approval', 1, 150, 'Court rental & balls', 'Published', isoNow
  );
  insertActivity.run(
    'act-2', 'hob-padel', 'usr-yara', 'Sunrise Padel @ The Hub',
    'Early morning energizing session before work! Friendly rally and rotating partners.',
    fmtDateOffset(2), '07:00', 90, 'ven-2', 'New Cairo', 4, 3, 6, 'Mixed', 'All levels', 18, 50, 'Instant', 1, 175, 'Court booking', 'Confirmed', isoNow
  );
  insertActivity.run(
    'act-3', 'hob-padel', 'usr-layla', 'Ladies Only Padel Meetup',
    'Supportive evening padel meetup for women in Maadi! Beginner & intermediate players.',
    fmtDateOffset(3), '18:30', 90, 'ven-3', 'Maadi', 4, 4, 12, 'Ladies-only', 'Beginner', 18, 45, 'Approval', 1, 160, 'Court rental', 'Published', isoNow
  );
  insertActivity.run(
    'act-4', 'hob-running', 'usr-omar', 'Zamalek Morning 5K Track Run',
    'Steady 5K group run at Gezira Sporting Track followed by cooldown.',
    fmtDateOffset(0), '08:30', 60, 'ven-4', 'Zamalek', 8, 3, 3, 'Mixed', 'All levels', null, null, 'Instant', 0, 0, 'Free track meetup', 'Confirmed', isoNow
  );
  insertActivity.run(
    'act-5', 'hob-boardgames', 'usr-yara', 'Catan & Ticket to Ride Strategy Evening',
    'Strategy board games session at Room Art Space Café in New Cairo.',
    fmtDateOffset(4), '19:00', 120, 'ven-6', 'New Cairo', 6, 4, 6, 'Mixed', 'All levels', 20, 45, 'Instant', 1, 100, 'Game library pass', 'Published', isoNow
  );

  const insertPart = db.prepare(`
    INSERT INTO participations (id, activity_id, user_id, is_organizer, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertPart.run('prt-1', 'act-1', 'usr-omar', 1, 'Confirmed', isoNow);
  insertPart.run('prt-2', 'act-1', 'usr-layla', 0, 'Confirmed', isoNow);

  insertPart.run('prt-3', 'act-2', 'usr-yara', 1, 'Confirmed', isoNow);
  insertPart.run('prt-4', 'act-2', 'usr-omar', 0, 'Confirmed', isoNow);
  insertPart.run('prt-5', 'act-2', 'usr-layla', 0, 'Confirmed', isoNow);

  insertPart.run('prt-7', 'act-3', 'usr-layla', 1, 'Confirmed', isoNow);

  insertPart.run('prt-8', 'act-4', 'usr-omar', 1, 'Confirmed', isoNow);
  insertPart.run('prt-9', 'act-4', 'usr-yara', 0, 'Confirmed', isoNow);
  insertPart.run('prt-10', 'act-4', 'usr-layla', 0, 'Confirmed', isoNow);

  insertPart.run('prt-11', 'act-5', 'usr-yara', 1, 'Confirmed', isoNow);
  insertPart.run('prt-12', 'act-5', 'usr-omar', 0, 'Confirmed', isoNow);
  insertPart.run('prt-13', 'act-5', 'usr-layla', 0, 'Confirmed', isoNow);

  // 6. Seed Promo Codes (UC-07, UC-48)
  const insertPromo = db.prepare('INSERT INTO promo_codes VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertPromo.run('SQUAD2027', 20, 0, '2027-12-31', 500, 14, 'both', 1);
  insertPromo.run('CAIRO50', 0, 50, '2027-06-30', 200, 8, 'new', 1);
  insertPromo.run('VIPFREE', 100, 0, '2027-03-31', 50, 2, 'new', 1);

  // 7. Seed Admin Accounts with Scrypt Password Hashes & 2FA Secrets (UC-40: 12+ char passwords)
  const defaultPassHash = hashPassword('SquadlyAdmin#2027');
  const insertAdmin = db.prepare(`
    INSERT INTO admin_accounts (id, name, email, password_hash, role, active, two_fa_secret, failed_attempts, locked_until, last_login)
    VALUES (?, ?, ?, ?, ?, 1, '123456', 0, NULL, ?)
  `);
  insertAdmin.run('adm-super', 'Mustafa F.', 'super@squadly.eg', defaultPassHash, 'Super Admin', isoNow);
  insertAdmin.run('adm-mod', 'Sara K.', 'moderator@squadly.eg', defaultPassHash, 'Moderator', isoNow);
  insertAdmin.run('adm-rev', 'Ahmed M.', 'kyc@squadly.eg', defaultPassHash, 'Verification Reviewer', isoNow);
}

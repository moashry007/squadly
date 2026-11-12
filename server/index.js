import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  db,
  pgPool,
  initDb,
  syncPostgresTables,
  hashDocNumber,
  hashPassword,
  hashOtp,
  signJwt,
  verifyJwt,
  generateQrToken,
  verifyQrToken,
  containsContactDetails,
  getDisplayName,
  getAgeFromDob,
  getAgeRangeLabel,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Never cache index.html or dist assets in development/testing so UI changes appear immediately
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'dist'), { etag: false, maxAge: 0 }));

const uid = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;

// Extract Authenticated Member or Admin from Authorization Bearer header
function getMemberFromReq(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyJwt(token);
  if (!payload || payload.type !== 'member') return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user || user.account_status === 'Deleted' || user.account_status === 'Banned') return null;
  // UC-03: Enforce single active session per account
  if (user.active_session_token && user.active_session_token !== token) return null;
  return user;
}

function getAdminFromReq(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyJwt(token);
  if (!payload || payload.type !== 'admin') return null;
  const admin = db.prepare('SELECT * FROM admin_accounts WHERE id = ? AND active = 1').get(payload.adminId);
  return admin || null;
}

function createNotification(userId, code, titleEn, titleAr, bodyEn, bodyAr, relatedActivityId = null, channels = 'Push, In-app') {
  db.prepare(`
    INSERT INTO notifications (id, user_id, code, title_en, title_ar, body_en, body_ar, channels, related_activity_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(uid('ntf'), userId, code, titleEn, titleAr, bodyEn, bodyAr, channels, relatedActivityId, new Date().toISOString());
}

function logAudit(admin, action, targetType, targetId, beforeVal, afterVal, reason) {
  db.prepare(`
    INSERT INTO audit_logs (id, admin_id, admin_name, admin_role, action, target_type, target_id, before_val, after_val, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uid('aud'),
    admin?.id || 'system',
    admin?.name || 'System Scheduler',
    admin?.role || 'System',
    action,
    targetType,
    targetId,
    typeof beforeVal === 'object' ? JSON.stringify(beforeVal) : String(beforeVal ?? ''),
    typeof afterVal === 'object' ? JSON.stringify(afterVal) : String(afterVal ?? ''),
    reason || 'Administrative action',
    new Date().toISOString()
  );
}

// Haversine Distance (km)
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function enrichActivity(act, viewer = null, viewerLat = null, viewerLng = null) {
  const hobby = db.prepare('SELECT * FROM hobbies WHERE id = ?').get(act.hobby_id);
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(act.venue_id);
  const organizer = db.prepare('SELECT * FROM users WHERE id = ?').get(act.organizer_id);
  const viewerId = viewer?.id || null;

  const parts = db.prepare(`
    SELECT p.*, u.display_name, u.full_name, u.gender, u.profile_photo, u.dob, u.rating_avg, u.rating_count, u.activities_attended, u.interests
    FROM participations p
    JOIN users u ON u.id = p.user_id
    WHERE p.activity_id = ?
  `).all(act.id);

  const confirmedParts = parts.filter((p) => ['Confirmed', 'Checked in', 'Attended'].includes(p.status));
  const femaleCount = confirmedParts.filter((p) => p.gender === 'Female').length;
  const maleCount = confirmedParts.filter((p) => p.gender === 'Male').length;
  const waitlistedParts = parts.filter((p) => p.status === 'Waitlisted').sort((a, b) => (a.waitlist_pos || 99) - (b.waitlist_pos || 99));
  const requestedParts = parts.filter((p) => p.status === 'Requested');

  const viewerPart = viewerId ? parts.find((p) => p.user_id === viewerId) : null;
  const isConfirmedOrOrganizer =
    viewerId &&
    (act.organizer_id === viewerId ||
      (viewerPart && ['Confirmed', 'Checked in', 'Attended'].includes(viewerPart.status)));

  let refLat = viewerLat || viewer?.lat || 30.0444;
  let refLng = viewerLng || viewer?.lng || 31.2357;
  if (distanceKm(refLat, refLng, 30.0444, 31.2357) > 80) {
    refLat = 30.0444;
    refLng = 31.2357;
  }
  const dist = venue ? distanceKm(refLat, refLng, venue.lat, venue.lng) : 3.2;

  // GBR-10: Guests do not see organizer identity
  const organizerCard = viewer
    ? {
        id: organizer?.id,
        displayName: organizer?.display_name || 'Organizer',
        photo: organizer?.profile_photo,
        verified: organizer?.verification_status === 'Approved',
        ratingAvg: organizer?.rating_count >= 3 ? organizer.rating_avg : null,
        ratingCount: organizer?.rating_count || 0,
        activitiesHosted: organizer?.activities_organized || 0,
      }
    : null;

  // GBR-11: Participant list visible ONLY to organizer and confirmed participants
  const roster = isConfirmedOrOrganizer
    ? confirmedParts.map((p) => ({
        userId: p.user_id,
        displayName: p.display_name,
        photo: p.profile_photo,
        gender: p.gender,
        ageRange: getAgeRangeLabel(p.dob),
        isOrganizer: !!p.is_organizer,
        status: p.status,
        checkedInAt: p.checked_in_at,
        organizerConfirmed: !!p.organizer_confirmed,
      }))
    : [];

  const pendingRequests =
    viewerId === act.organizer_id
      ? requestedParts.map((p) => ({
          id: p.id,
          userId: p.user_id,
          displayName: p.display_name,
          photo: p.profile_photo,
          gender: p.gender,
          ageRange: getAgeRangeLabel(p.dob),
          ratingAvg: p.rating_count >= 3 ? p.rating_avg : null,
          activitiesAttended: p.activities_attended,
          updatedAt: p.updated_at,
        }))
      : [];

  return {
    ...act,
    fee_required: !!act.fee_required,
    change_pending: !!act.change_pending,
    change_payload: act.change_payload ? JSON.parse(act.change_payload) : null,
    hobby,
    venue,
    distanceKm: dist,
    confirmedCount: confirmedParts.length,
    femaleCount,
    maleCount,
    genderSplit: `${femaleCount}F / ${maleCount}M`,
    waitlistCount: waitlistedParts.length,
    pendingRequestCount: requestedParts.length,
    organizerCard,
    roster,
    pendingRequests,
    viewerParticipation: viewerPart || null,
    chatWritable: confirmedParts.length >= 3 && !['Cancelled', 'Completed', 'Rejected', 'Draft'].includes(act.status),
  };
}

// ============================================================================
// SCHEDULED SYSTEM JOBS ENGINE (UC-38 & UC-39) — Runs every 60 seconds
// ============================================================================
function runScheduledJobs() {
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Check Confirmation Deadlines & Minimum to Run (UC-38 & GBR-01)
    const openActs = db.prepare("SELECT * FROM activities WHERE status IN ('Published', 'Full')").all();
    for (const act of openActs) {
      const startTime = new Date(`${act.date}T${act.start_time}:00`);
      const hoursLeft = (startTime.getTime() - now.getTime()) / 3600000;
      if (hoursLeft <= act.confirmation_deadline_hours && hoursLeft > 0) {
        const confirmedCount = db
          .prepare("SELECT COUNT(*) as c FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in')")
          .get(act.id).c;
        if (confirmedCount >= act.min_to_run && confirmedCount >= 3) {
          db.prepare("UPDATE activities SET status = 'Confirmed' WHERE id = ?").run(act.id);
          const parts = db.prepare("SELECT user_id FROM participations WHERE activity_id = ? AND status = 'Confirmed'").all(act.id);
          for (const p of parts) {
            createNotification(p.user_id, 'NTF-20b', "It's on!", 'النشاط مؤكد!', `It's on! ${act.title} has enough players.`, `اكتمل العدد المطلوب لنشاط ${act.title}.`, act.id);
          }
        } else {
          db.prepare("UPDATE activities SET status = 'Cancelled', cancel_reason = 'Minimum not reached at confirmation deadline (UC-38)' WHERE id = ?").run(act.id);
          const freeUsers = db.prepare('SELECT user_id FROM participations WHERE activity_id = ? AND used_free_activity = 1').all(act.id);
          for (const fu of freeUsers) {
            db.prepare('UPDATE users SET free_first_activity_used = 0 WHERE id = ?').run(fu.user_id);
          }
        }
      }
    }

    // 2. Auto-reject Probation Activities still Pending Approval 2h before start (UC-22 A3 / UC-44 A1)
    const pendingProbation = db.prepare("SELECT * FROM activities WHERE status = 'Pending Approval'").all();
    for (const act of pendingProbation) {
      const startTime = new Date(`${act.date}T${act.start_time}:00`);
      const hoursLeft = (startTime.getTime() - now.getTime()) / 3600000;
      if (hoursLeft <= 2) {
        db.prepare("UPDATE activities SET status = 'Rejected', cancel_reason = 'Auto-rejected 2h before start (SLA expired)' WHERE id = ?").run(act.id);
        createNotification(act.organizer_id, 'NTF-27', 'Activity Not Approved', 'لم تتم الموافقة', `${act.title} was not approved before the 2-hour cutoff.`, `انتهت مهلة المراجعة لنشاط ${act.title}.`, act.id);
      }
    }

    // 3. Expire 1-hour Waitlist Offers (GBR-29 / UC-18)
    const expiredOffers = db
      .prepare("SELECT * FROM participations WHERE status = 'Offered' AND offer_expires_at IS NOT NULL AND offer_expires_at < ?")
      .all(nowIso);
    for (const off of expiredOffers) {
      db.prepare("UPDATE participations SET status = 'Expired', updated_at = ? WHERE id = ?").run(nowIso, off.id);
    }
  } catch (e) {
    console.error('Scheduled job error:', e);
  }
}

setInterval(runScheduledJobs, 60000);

// ============================================================================
// PUBLIC & MEMBER APP API ENDPOINTS
// ============================================================================

app.get('/api/db/status', async (req, res) => {
  if (!pgPool) {
    return res.json({
      connected: false,
      engine: 'SQLite (PostgreSQL Standby — set DATABASE_URL in .env)',
      tables: 20,
    });
  }
  try {
    const r = await pgPool.query('SELECT NOW() as now');
    res.json({
      connected: true,
      engine: 'PostgreSQL / Supabase Cloud',
      serverTime: r.rows[0]?.now,
      tables: 20,
    });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.post('/api/db/sync-postgres', async (req, res) => {
  try {
    const result = await syncPostgresTables();
    res.json(result);
  } catch (err) {
    res.status(500).json({ synced: false, error: err.message });
  }
});

app.get('/api/bootstrap', (req, res) => {
  const viewer = getMemberFromReq(req);
  const viewerLat = req.query.lat ? Number(req.query.lat) : null;
  const viewerLng = req.query.lng ? Number(req.query.lng) : null;

  const hobbies = db.prepare('SELECT * FROM hobbies ORDER BY display_order ASC').all();
  const venues = db.prepare('SELECT * FROM venues ORDER BY created_at DESC').all().map((v) => ({
    ...v,
    supported_hobbies: JSON.parse(v.supported_hobbies || '[]'),
  }));

  const currentUser = viewer
    ? {
        ...viewer,
        interests: JSON.parse(viewer.interests || '[]'),
        top_tags: JSON.parse(viewer.top_tags || '[]'),
        age: getAgeFromDob(viewer.dob),
        ageRange: getAgeRangeLabel(viewer.dob),
      }
    : null;

  const blockedUserIds = new Set();
  if (viewer) {
    const blocks = db.prepare('SELECT * FROM blocks WHERE blocker_id = ? OR blocked_id = ?').all(viewer.id, viewer.id);
    for (const b of blocks) {
      blockedUserIds.add(b.blocker_id === viewer.id ? b.blocked_id : b.blocker_id);
    }
  }

  const rawActivities = db.prepare('SELECT * FROM activities ORDER BY date ASC, start_time ASC').all();
  const activities = rawActivities.map((a) => {
    const enriched = enrichActivity(a, viewer, viewerLat, viewerLng);
    const allPartUserIds = db
      .prepare("SELECT user_id FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in', 'Attended')")
      .all(a.id)
      .map((r) => r.user_id);
    const hasBlockedMember = allPartUserIds.some((uid) => blockedUserIds.has(uid));
    return { ...enriched, hasBlockedMember };
  });

  const notifications = viewer
    ? db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(viewer.id)
    : [];

  const myBlocks = viewer
    ? db.prepare(`
        SELECT b.*, u.display_name, u.profile_photo
        FROM blocks b
        JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
      `).all(viewer.id)
    : [];

  const systemParameters = db.prepare('SELECT * FROM system_parameters').all();

  res.json({
    dbEngine: pgPool ? 'PostgreSQL / Supabase' : 'SQLite / PostgreSQL-Compatible',
    currentUser,
    hobbies,
    venues,
    activities,
    notifications,
    myBlocks,
    systemParameters,
  });
});

// UC-02 & UC-03: Real OTP Generation, Rate Limiting, Expiry & Lockout
app.post('/api/auth/send-otp', async (req, res) => {
  const { mobile, mode } = req.body;
  const clean = String(mobile || '').replace(/\s+/g, '');
  if (!/^01[0125]\d{8}$/.test(clean)) {
    return res.status(400).json({ code: 'ERR-001' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE mobile = ?').get(clean);
  if (existing && existing.account_status === 'Banned') {
    return res.status(403).json({ code: 'ERR-043' });
  }
  if (mode === 'register' && existing && existing.account_status !== 'Deleted') {
    return res.status(400).json({ code: 'ERR-005' });
  }
  if (mode === 'login' && (!existing || existing.account_status === 'Deleted')) {
    return res.status(404).json({ code: 'ERR-042' });
  }

  const now = new Date();
  const otpRow = db.prepare('SELECT * FROM otp_requests WHERE mobile = ?').get(clean);

  if (otpRow) {
    // Check 30-minute lock (UC-02 E6)
    if (otpRow.locked_until && new Date(otpRow.locked_until) > now) {
      return res.status(429).json({ code: 'ERR-004' });
    }
    // Check max 3 resends per hour
    const lastSent = new Date(otpRow.last_sent_at);
    const sameHour = now.getTime() - lastSent.getTime() < 3600000;
    if (sameHour && otpRow.resends_this_hour >= 4) {
      const lockUntil = new Date(now.getTime() + 30 * 60000).toISOString();
      db.prepare('UPDATE otp_requests SET locked_until = ? WHERE mobile = ?').run(lockUntil, clean);
      return res.status(429).json({ code: 'ERR-004' });
    }
  }

  // Generate real cryptographically random 6-digit OTP (valid 5 minutes)
  const rawOtp = String(crypto.randomInt(100000, 999999));
  const otpHash = hashOtp(clean, rawOtp);
  const expiresAt = new Date(now.getTime() + 5 * 60000).toISOString();
  const resends = otpRow && now.getTime() - new Date(otpRow.last_sent_at).getTime() < 3600000 ? otpRow.resends_this_hour + 1 : 1;

  db.prepare(`
    INSERT OR REPLACE INTO otp_requests (mobile, otp_hash, expires_at, last_sent_at, resends_this_hour, wrong_attempts, locked_until)
    VALUES (?, ?, ?, ?, ?, 0, NULL)
  `).run(clean, otpHash, expiresAt, now.toISOString(), resends);

  // Dispatch to SMS Webhook if configured in .env
  if (process.env.SMS_WEBHOOK_URL) {
    try {
      await fetch(process.env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: `+20${clean.slice(1)}`, message: `Your Squadly verification code is ${rawOtp}. Valid for 5 minutes.` }),
      });
    } catch (e) {
      console.error('SMS webhook error:', e);
    }
  }

  res.json({
    ok: true,
    code: 'INF-002',
    mobile: clean,
    smsDispatched: !process.env.SMS_WEBHOOK_URL ? `SMS to +20${clean.slice(1)}: Your Squadly code is ${rawOtp}` : 'Sent via SMS Gateway',
    otpGenerated: !process.env.SMS_WEBHOOK_URL ? rawOtp : undefined,
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { mobile, otp, mode } = req.body;
  const clean = String(mobile || '').replace(/\s+/g, '');
  const now = new Date();

  const otpRow = db.prepare('SELECT * FROM otp_requests WHERE mobile = ?').get(clean);
  if (!otpRow) {
    return res.status(400).json({ code: 'ERR-003' });
  }
  if (otpRow.locked_until && new Date(otpRow.locked_until) > now) {
    return res.status(429).json({ code: 'ERR-004' });
  }
  if (new Date(otpRow.expires_at) < now) {
    return res.status(400).json({ code: 'ERR-003' });
  }

  const candidateHash = hashOtp(clean, String(otp || '').trim());
  if (candidateHash !== otpRow.otp_hash) {
    const wrong = otpRow.wrong_attempts + 1;
    if (wrong >= 5) {
      const lockUntil = new Date(now.getTime() + 30 * 60000).toISOString();
      db.prepare('UPDATE otp_requests SET wrong_attempts = ?, locked_until = ? WHERE mobile = ?').run(wrong, lockUntil, clean);
      return res.status(429).json({ code: 'ERR-004' });
    }
    db.prepare('UPDATE otp_requests SET wrong_attempts = ? WHERE mobile = ?').run(wrong, clean);
    return res.status(400).json({ code: 'ERR-002', attemptsLeft: 5 - wrong });
  }

  // OTP verified -> invalidate OTP
  db.prepare('DELETE FROM otp_requests WHERE mobile = ?').run(clean);

  let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(clean);
  const nowIso = now.toISOString();
  if (mode === 'register' || !user) {
    const id = uid('usr');
    db.prepare(`
      INSERT INTO users (id, mobile, account_status, verification_status, subscription_status, terms_version, terms_accepted_at, created_at)
      VALUES (?, ?, 'Registered', 'Not submitted', 'None', '1.1', ?, ?)
    `).run(id, clean, nowIso, nowIso);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (user.active_session_token) {
    // UC-03 Step 5: Another device was logged in -> end old session & send NTF-35
    createNotification(
      user.id,
      'NTF-35',
      'New Device Login',
      'تسجيل دخول من جهاز جديد',
      'Your account was signed in on a new device. Not you? Contact support.',
      'تم تسجيل الدخول إلى حسابك من جهاز جديد. إذا لم تكن أنت، تواصل مع الدعم فوراً.',
      null,
      'Push, Email'
    );
  }

  // Issue 60-day JWT & store as single active session token (UC-03)
  const token = signJwt({ type: 'member', userId: user.id, mobile: user.mobile }, 86400 * 60);
  db.prepare('UPDATE users SET active_session_token = ? WHERE id = ?').run(token, user.id);

  res.json({ ok: true, token, user });
});

app.post('/api/auth/logout', (req, res) => {
  const user = getMemberFromReq(req);
  if (user) {
    db.prepare('UPDATE users SET active_session_token = NULL WHERE id = ?').run(user.id);
  }
  res.json({ ok: true });
});

// Update Browser GPS Coordinates (GBR-17: used only to calculate distance)
app.post('/api/profile/location', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { lat, lng } = req.body;
  if (typeof lat === 'number' && typeof lng === 'number') {
    db.prepare('UPDATE users SET lat = ?, lng = ? WHERE id = ?').run(lat, lng, user.id);
  }
  res.json({ ok: true });
});

// UC-04 & UC-09: Create / Edit Profile
app.post('/api/profile/save', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    fullName,
    dob,
    gender,
    city,
    area,
    email,
    profilePhoto,
    interests,
    emergencyName,
    emergencyMobile,
    emergencyRelation,
  } = req.body;

  // GBR-04: Age 18+ check
  const age = getAgeFromDob(dob || user.dob);
  if (age < 18) {
    db.prepare("UPDATE users SET account_status = 'Banned', verification_status = 'Blocked', active_session_token = NULL WHERE id = ?").run(user.id);
    return res.status(400).json({ code: 'ERR-006' });
  }

  if (emergencyMobile && emergencyMobile.replace(/\s+/g, '') === user.mobile) {
    return res.status(400).json({ code: 'ERR-054' });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ code: 'ERR-008' });
  }
  if (email) {
    const dupEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id);
    if (dupEmail) return res.status(400).json({ code: 'ERR-009' });
  }

  // GBR-07: Locked identity fields after verification
  const isVerified = user.verification_status === 'Approved';
  const finalFullName = isVerified ? user.full_name : fullName || user.full_name;
  const finalDob = isVerified ? user.dob : dob || user.dob;
  const finalGender = isVerified ? user.gender : gender || user.gender;
  const displayName = getDisplayName(finalFullName);

  let finalPhoto = user.profile_photo || profilePhoto;
  let pendingPhoto = user.pending_photo;
  if (isVerified && profilePhoto && profilePhoto !== user.profile_photo) {
    pendingPhoto = profilePhoto;
    db.prepare(`
      INSERT INTO verifications (id, user_id, type, doc_type, front_image, back_image, selfie_image, status, submitted_at)
      VALUES (?, ?, 'PhotoChange', 'Photo Re-review', ?, ?, ?, 'Pending', ?)
    `).run(uid('ver'), user.id, profilePhoto, profilePhoto, profilePhoto, new Date().toISOString());
  } else if (profilePhoto) {
    finalPhoto = profilePhoto;
  }

  db.prepare(`
    UPDATE users SET
      full_name = ?,
      display_name = ?,
      dob = ?,
      gender = ?,
      city = ?,
      area = ?,
      email = ?,
      email_verified = CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE email_verified END,
      profile_photo = ?,
      pending_photo = ?,
      interests = ?,
      emergency_name = ?,
      emergency_mobile = ?,
      emergency_relation = ?
    WHERE id = ?
  `).run(
    finalFullName,
    displayName,
    finalDob,
    finalGender,
    city || user.city || 'Cairo',
    area || user.area || 'Sheikh Zayed',
    email || user.email,
    finalPhoto,
    pendingPhoto,
    JSON.stringify(interests || []),
    emergencyName || user.emergency_name,
    emergencyMobile || user.emergency_mobile,
    emergencyRelation || user.emergency_relation || 'Parent',
    user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const outsideCairo = !['Cairo', 'Giza', 'Greater Cairo'].includes(updated.city);
  res.json({ ok: true, user: updated, infoCode: outsideCairo ? 'INF-007' : 'INF-034' });
});

// UC-06: Submit Identity Verification (Live Camera Images)
app.post('/api/verification/submit', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { docType, docNumber, frontImage, backImage, selfieImage } = req.body;
  if (!frontImage || !selfieImage) {
    return res.status(400).json({ code: 'ERR-010' });
  }

  if (user.verification_attempts >= 3) {
    db.prepare("UPDATE users SET verification_status = 'Escalated' WHERE id = ?").run(user.id);
    return res.status(400).json({ code: 'ERR-012' });
  }

  const docHash = hashDocNumber(docNumber || `${user.id}_doc`);
  const dupDoc = db.prepare('SELECT id FROM users WHERE doc_hash = ? AND id != ?').get(docHash, user.id);
  if (dupDoc) {
    db.prepare(`
      INSERT INTO safety_flags (id, type, target_user_id, description, evidence, status, created_at)
      VALUES (?, 'Duplicate ID Document Attempt', ?, 'User attempted verification with a document linked to another account (GBR-06).', ?, 'Open', ?)
    `).run(uid('flg'), user.id, JSON.stringify({ existingUserId: dupDoc.id }), new Date().toISOString());
    return res.status(400).json({ code: 'ERR-011' });
  }

  const masked = String(docNumber || '').replace(/^(.{3}).*(.{3})$/, '$1********$2');
  db.prepare(`
    INSERT INTO verifications (id, user_id, type, doc_type, doc_number_masked, doc_hash, front_image, back_image, selfie_image, status, submitted_at)
    VALUES (?, ?, 'Identity', ?, ?, ?, ?, ?, ?, 'Pending', ?)
  `).run(
    uid('ver'),
    user.id,
    docType || 'National ID',
    masked,
    docHash,
    frontImage,
    backImage || frontImage,
    selfieImage,
    new Date().toISOString()
  );

  db.prepare(`
    UPDATE users SET verification_status = 'Pending', doc_type = ?, doc_hash = ?, verification_attempts = verification_attempts + 1
    WHERE id = ?
  `).run(docType || 'National ID', docHash, user.id);

  res.json({ ok: true, code: 'INF-003' });
});

// UC-07 & UC-08: Pay Annual Subscription
app.post('/api/subscription/pay', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { promoCode, paymentMethod, cardLast4 } = req.body;
  if (user.verification_status !== 'Approved') return res.status(400).json({ code: 'ERR-016' });
  if (!user.email_verified) return res.status(400).json({ code: 'ERR-056' });
  if (!['Cairo', 'Giza', 'Greater Cairo'].includes(user.city)) return res.status(400).json({ code: 'INF-007' });

  const basePriceRow = db.prepare("SELECT value FROM system_parameters WHERE key = 'subscription_price_egp'").get();
  let amount = Number(basePriceRow?.value || 250);

  if (promoCode) {
    const promo = db.prepare('SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(?) AND active = 1').get(promoCode.trim());
    if (!promo || promo.used_count >= promo.max_uses || new Date(promo.valid_until) < new Date()) {
      return res.status(400).json({ code: 'ERR-014' });
    }
    if (promo.discount_percent > 0) {
      amount = Math.max(0, Math.round(amount * (1 - promo.discount_percent / 100)));
    } else if (promo.discount_fixed > 0) {
      amount = Math.max(0, amount - promo.discount_fixed);
    }
    db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?').run(promo.code);
  }

  const now = new Date();
  let startDate = now;
  if (user.subscription_status === 'Active' && user.subscription_end && new Date(user.subscription_end) > now) {
    startDate = new Date(user.subscription_end);
  }
  const endDate = new Date(startDate.getTime() + 365 * 86400000).toISOString().split('T')[0];
  const startIso = now.toISOString().split('T')[0];
  const txRef = `PAYMOB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  db.prepare(`
    INSERT INTO subscriptions (id, user_id, amount_egp, promo_code, payment_method, transaction_ref, status, refund_requested, started_at, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Active', 0, ?, ?)
  `).run(uid('sub'), user.id, amount, promoCode || null, paymentMethod || `Card *${cardLast4 || '4242'}`, txRef, startIso, endDate);

  db.prepare(`
    UPDATE users SET subscription_status = 'Active', subscription_start = ?, subscription_end = ?
    WHERE id = ?
  `).run(startIso, endDate, user.id);

  createNotification(
    user.id,
    'NTF-03',
    'Subscription Activated',
    'تم تفعيل العضوية السنوية',
    `Your Squadly membership is active until ${endDate}. Receipt #${txRef}`,
    `عضويتك في Squadly مفعلة حتى ${endDate}. إيصال رقم #${txRef}`,
    null,
    'In-app, Email'
  );

  res.json({ ok: true, code: 'INF-005', endDate, amountPaid: amount, transactionRef: txRef });
});

// UC-17: Join or Request to Join an Activity
app.post('/api/activities/:id/join', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ code: 'INF-001' });

  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!act) return res.status(404).json({ code: 'ERR-023' });

  if (user.verification_status !== 'Approved') return res.status(400).json({ code: 'ERR-016' });
  if (user.account_status === 'Suspended') {
    return res.status(403).json({ code: 'ERR-024', date: user.suspended_until || 'review' });
  }

  let usingFreeActivity = 0;
  if (user.subscription_status === 'Active') {
    if (user.subscription_end && act.date > user.subscription_end) {
      return res.status(400).json({ code: 'ERR-057' });
    }
  } else if (!user.free_first_activity_used) {
    usingFreeActivity = 1;
  } else {
    return res.status(400).json({ code: 'ERR-017' });
  }

  if (act.gender_type === 'Ladies-only' && user.gender !== 'Female') {
    return res.status(400).json({ code: 'ERR-018' });
  }
  if (act.gender_type === 'Men-only' && user.gender !== 'Male') {
    return res.status(400).json({ code: 'ERR-018' });
  }

  const age = getAgeFromDob(user.dob);
  if ((act.age_min && age < act.age_min) || (act.age_max && age > act.age_max)) {
    return res.status(400).json({ code: 'ERR-019' });
  }

  const confirmedMembers = db
    .prepare("SELECT user_id FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in')")
    .all(activityId)
    .map((r) => r.user_id);
  for (const memberId of confirmedMembers) {
    const blocked = db
      .prepare('SELECT id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)')
      .get(user.id, memberId, memberId, user.id);
    if (blocked) return res.status(400).json({ code: 'ERR-058' });
  }

  const existingPart = db.prepare('SELECT * FROM participations WHERE activity_id = ? AND user_id = ?').get(activityId, user.id);
  if (existingPart && ['Confirmed', 'Requested', 'Rejected', 'Removed'].includes(existingPart.status)) {
    return res.status(400).json({ code: 'ERR-049' });
  }

  if (act.change_pending) return res.status(400).json({ code: 'ERR-044' });

  const activeBookings = db
    .prepare(`
      SELECT p.activity_id, a.date, a.start_time, a.duration
      FROM participations p
      JOIN activities a ON a.id = p.activity_id
      WHERE p.user_id = ? AND p.status IN ('Confirmed', 'Requested') AND a.status IN ('Published', 'Full', 'Confirmed', 'Pending Approval')
    `)
    .all(user.id);

  if (activeBookings.length >= 5) {
    return res.status(400).json({ code: 'ERR-021' });
  }

  const toMins = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const newStart = toMins(act.start_time);
  const newEnd = newStart + act.duration;
  for (const b of activeBookings) {
    if (b.date === act.date && b.activity_id !== act.id) {
      const bStart = toMins(b.start_time);
      const bEnd = bStart + b.duration;
      if (newStart < bEnd + 30 && newEnd + 30 > bStart) {
        return res.status(400).json({ code: 'ERR-020' });
      }
    }
  }

  if (confirmedMembers.length >= act.total_slots) {
    return res.status(400).json({ code: 'ERR-062' });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const newStatus = act.join_mode === 'Instant' ? 'Confirmed' : 'Requested';

  if (existingPart) {
    db.prepare('UPDATE participations SET status = ?, used_free_activity = ?, updated_at = ? WHERE id = ?').run(
      newStatus,
      usingFreeActivity,
      nowIso,
      existingPart.id
    );
  } else {
    db.prepare(`
      INSERT INTO participations (id, activity_id, user_id, is_organizer, status, used_free_activity, updated_at)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(uid('prt'), activityId, user.id, newStatus, usingFreeActivity, nowIso);
  }

  if (usingFreeActivity) {
    db.prepare('UPDATE users SET free_first_activity_used = 1 WHERE id = ?').run(user.id);
  }

  const newConfirmedTotal = newStatus === 'Confirmed' ? confirmedMembers.length + 1 : confirmedMembers.length;
  if (newConfirmedTotal >= act.total_slots && act.status === 'Published') {
    db.prepare("UPDATE activities SET status = 'Full' WHERE id = ?").run(activityId);
  }

  if (newStatus === 'Confirmed') {
    createNotification(
      act.organizer_id,
      'NTF-07',
      'Member Joined',
      'انضم عضو جديد',
      `${user.display_name} joined ${act.title}.`,
      `انضم ${user.display_name} إلى ${act.title}.`,
      activityId
    );
    if (newConfirmedTotal === 3) {
      db.prepare(`
        INSERT INTO chat_messages (id, activity_id, sender_id, type, content, created_at)
        VALUES (?, ?, ?, 'system', ?, ?)
      `).run(uid('msg'), activityId, act.organizer_id, `The group chat for ${act.title} is now open (3 confirmed players).`, nowIso);
    }
  } else {
    createNotification(
      act.organizer_id,
      'NTF-08',
      'New Join Request',
      'طلب انضمام جديد',
      `${user.display_name} wants to join ${act.title}.`,
      `يرغب ${user.display_name} في الانضمام إلى ${act.title}.`,
      activityId
    );
  }

  res.json({
    ok: true,
    status: newStatus,
    code: newStatus === 'Confirmed' ? 'INF-009' : 'INF-008',
    usedFreeFirstActivity: !!usingFreeActivity,
  });
});

// UC-18: Join Waitlist
app.post('/api/activities/:id/waitlist', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ code: 'INF-001' });

  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!act) return res.status(404).json({ code: 'ERR-023' });

  const currentWaitlist = db
    .prepare("SELECT COUNT(*) as c FROM participations WHERE activity_id = ? AND status = 'Waitlisted'")
    .get(activityId).c;

  if (currentWaitlist >= act.total_slots) {
    return res.status(400).json({ code: 'ERR-059' });
  }

  const pos = currentWaitlist + 1;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO participations (id, activity_id, user_id, is_organizer, status, waitlist_pos, updated_at)
    VALUES (?, ?, ?, 0, 'Waitlisted', ?, ?)
  `).run(uid('prt'), activityId, user.id, pos, now);

  res.json({ ok: true, code: 'INF-010', position: pos });
});

// UC-19: Leave / Cancel Participation
app.post('/api/activities/:id/leave', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ code: 'INF-001' });

  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  const part = db.prepare('SELECT * FROM participations WHERE activity_id = ? AND user_id = ?').get(activityId, user.id);
  if (!act || !part) return res.status(404).json({ code: 'ERR-023' });

  const now = new Date();
  const actStart = new Date(`${act.date}T${act.start_time}:00`);
  const hoursUntilStart = (actStart.getTime() - now.getTime()) / 3600000;

  let newStatus = 'Withdrawn';
  let strikeAdded = 0;

  if (part.status === 'Confirmed') {
    if (hoursUntilStart < 24 && hoursUntilStart > 0) {
      newStatus = 'Late-cancelled';
      strikeAdded = 0.5;
      db.prepare('UPDATE users SET participant_strikes = participant_strikes + 0.5 WHERE id = ?').run(user.id);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      if (u.participant_strikes >= 3) {
        const suspEnd = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
        db.prepare("UPDATE users SET account_status = 'Suspended', suspended_until = ?, suspension_reason = '3 reliability strikes' WHERE id = ?").run(suspEnd, user.id);
        createNotification(user.id, 'NTF-26', 'Account Suspended (14 Days)', 'تم تعليق الحساب (14 يوماً)', `Your account is suspended from joining and organizing until ${suspEnd}.`, `تم تعليق حسابك حتى ${suspEnd}.`);
      }
    } else {
      newStatus = 'Cancelled';
      if (part.used_free_activity) {
        db.prepare('UPDATE users SET free_first_activity_used = 0 WHERE id = ?').run(user.id);
      }
    }
  }

  db.prepare('UPDATE participations SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now.toISOString(), part.id);

  // Promote from waitlist (GBR-29)
  const firstWaitlisted = db
    .prepare("SELECT * FROM participations WHERE activity_id = ? AND status = 'Waitlisted' ORDER BY waitlist_pos ASC LIMIT 1")
    .get(activityId);
  if (firstWaitlisted && hoursUntilStart >= 3) {
    const promotedStatus = hoursUntilStart > 24 ? (act.join_mode === 'Instant' ? 'Confirmed' : 'Requested') : 'Offered';
    const offerExp = promotedStatus === 'Offered' ? new Date(now.getTime() + 3600000).toISOString() : null;
    db.prepare('UPDATE participations SET status = ?, offer_expires_at = ?, updated_at = ? WHERE id = ?').run(
      promotedStatus,
      offerExp,
      now.toISOString(),
      firstWaitlisted.id
    );
    createNotification(
      firstWaitlisted.user_id,
      promotedStatus === 'Confirmed' ? 'NTF-11' : 'NTF-12',
      'Spot Opened Up!',
      'أصبح هناك مكان متاح!',
      `A spot opened up for ${act.title}.`,
      `أصبح هناك مكان متاح في ${act.title}.`,
      activityId
    );
  }

  const remainingConfirmed = db
    .prepare("SELECT COUNT(*) as c FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in')")
    .get(activityId).c;

  if (act.status === 'Confirmed' && remainingConfirmed < 3) {
    db.prepare("UPDATE activities SET status = 'Cancelled', cancel_reason = 'Minimum not reached (dropped below 3 players - GBR-01)' WHERE id = ?").run(activityId);
  } else if (act.status === 'Full' && remainingConfirmed < act.total_slots) {
    db.prepare("UPDATE activities SET status = 'Published' WHERE id = ?").run(activityId);
  }

  res.json({ ok: true, status: newStatus, strikeAdded });
});

// UC-22: Create Activity
app.post('/api/activities', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ code: 'INF-001' });

  const {
    hobbyId,
    title,
    description,
    date,
    startTime,
    duration,
    venueId,
    totalSlots,
    minToRun,
    confirmationDeadlineHours,
    genderType,
    skillLevel,
    ageMin,
    ageMax,
    joinMode,
    feeRequired,
    feeAmount,
    feeCovers,
  } = req.body;

  const hobby = db.prepare('SELECT * FROM hobbies WHERE id = ?').get(hobbyId);
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(venueId);

  if (user.verification_status !== 'Approved') return res.status(400).json({ code: 'ERR-016' });
  if (user.account_status === 'Suspended') return res.status(403).json({ code: 'ERR-024' });
  if (user.organizing_suspended_until && new Date(user.organizing_suspended_until) > new Date()) {
    return res.status(403).json({ code: 'ERR-025' });
  }
  if (user.subscription_status !== 'Active' && user.free_first_activity_used) {
    return res.status(400).json({ code: 'ERR-017' });
  }

  const activeOrgCount = db
    .prepare("SELECT COUNT(*) as c FROM activities WHERE organizer_id = ? AND status IN ('Pending Approval', 'Published', 'Full', 'Confirmed')")
    .get(user.id).c;
  if (activeOrgCount >= 3) {
    return res.status(400).json({ code: 'ERR-026' });
  }

  if (containsContactDetails(title) || containsContactDetails(description) || containsContactDetails(feeCovers)) {
    return res.status(400).json({ code: 'ERR-033' });
  }

  const [sh, sm] = String(startTime || '18:00').split(':').map(Number);
  const startMins = sh * 60 + sm;
  const durMins = Number(duration || hobby?.default_duration || 90);
  const endMins = startMins + durMins;
  if (startMins < 6 * 60 || endMins > 22 * 60) {
    return res.status(400).json({ code: 'ERR-028' });
  }

  const slots = Number(totalSlots);
  const minRun = Number(minToRun || hobby?.min_slots || 3);
  if (!hobby || slots < hobby.min_slots || slots > hobby.max_slots) {
    return res.status(400).json({ code: 'ERR-029' });
  }
  if (minRun < 3 || minRun > slots) {
    return res.status(400).json({ code: 'ERR-061' });
  }

  if (genderType === 'Ladies-only' && user.gender !== 'Female') {
    return res.status(400).json({ code: 'ERR-030' });
  }
  if (genderType === 'Men-only' && user.gender !== 'Male') {
    return res.status(400).json({ code: 'ERR-030' });
  }

  if (feeRequired && (Number(feeAmount) < 1 || Number(feeAmount) > 5000)) {
    return res.status(400).json({ code: 'ERR-051' });
  }

  const isOnProbation = !user.probation_ended && user.approved_activities_count < 3;
  const status = venue?.status === 'Pending' ? 'Draft' : isOnProbation ? 'Pending Approval' : 'Published';

  const actId = uid('act');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO activities (
      id, hobby_id, organizer_id, title, description, date, start_time, duration,
      venue_id, area, total_slots, min_to_run, confirmation_deadline_hours,
      gender_type, skill_level, age_min, age_max, join_mode, fee_required, fee_amount, fee_covers,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actId,
    hobbyId,
    user.id,
    title.trim(),
    (description || '').trim(),
    date,
    startTime,
    durMins,
    venueId,
    venue?.area || 'Cairo',
    slots,
    minRun,
    Number(confirmationDeadlineHours || 6),
    genderType || 'Mixed',
    skillLevel || 'All levels',
    ageMin ? Number(ageMin) : null,
    ageMax ? Number(ageMax) : null,
    joinMode || 'Approval',
    feeRequired ? 1 : 0,
    feeRequired ? Number(feeAmount) : 0,
    feeCovers || '',
    status,
    now
  );

  db.prepare(`
    INSERT INTO participations (id, activity_id, user_id, is_organizer, status, updated_at)
    VALUES (?, ?, ?, 1, 'Confirmed', ?)
  `).run(uid('prt'), actId, user.id, now);

  if (user.subscription_status !== 'Active' && !user.free_first_activity_used) {
    db.prepare('UPDATE users SET free_first_activity_used = 1 WHERE id = ?').run(user.id);
  }

  res.json({
    ok: true,
    activityId: actId,
    status,
    code: isOnProbation ? 'INF-011' : 'INF-012',
    probationStep: isOnProbation ? user.approved_activities_count + 1 : null,
  });
});

// UC-23: Organizer Manages Join Requests
app.post('/api/activities/:id/requests/:partId', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { decision } = req.body;
  const activityId = req.params.id;
  const partId = req.params.partId;

  const act = db.prepare('SELECT * FROM activities WHERE id = ? AND organizer_id = ?').get(activityId, user.id);
  const part = db.prepare('SELECT * FROM participations WHERE id = ? AND activity_id = ?').get(partId, activityId);
  if (!act || !part) return res.status(404).json({ code: 'ERR-023' });

  const now = new Date().toISOString();
  if (decision === 'accept') {
    const confirmedCount = db
      .prepare("SELECT COUNT(*) as c FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in')")
      .get(activityId).c;
    if (confirmedCount >= act.total_slots) {
      return res.status(400).json({ code: 'ERR-062' });
    }
    db.prepare("UPDATE participations SET status = 'Confirmed', updated_at = ? WHERE id = ?").run(now, partId);
    if (confirmedCount + 1 >= act.total_slots) {
      db.prepare("UPDATE activities SET status = 'Full' WHERE id = ?").run(activityId);
    }
    if (confirmedCount + 1 === 3) {
      db.prepare(`
        INSERT INTO chat_messages (id, activity_id, sender_id, type, content, created_at)
        VALUES (?, ?, ?, 'system', ?, ?)
      `).run(uid('msg'), activityId, act.organizer_id, `The group chat for ${act.title} is open (3 confirmed players).`, now);
    }
    createNotification(part.user_id, 'NTF-09', "You're in!", 'تم قبول طلبك!', `You're in! ${act.title} on ${act.date}.`, `تم قبول طلبك للانضمام إلى ${act.title}.`, activityId);
  } else {
    db.prepare("UPDATE participations SET status = 'Rejected', updated_at = ? WHERE id = ?").run(now, partId);
    if (part.used_free_activity) {
      db.prepare('UPDATE users SET free_first_activity_used = 0 WHERE id = ?').run(part.user_id);
    }
    createNotification(part.user_id, 'NTF-10', 'Request Not Accepted', 'لم يتم قبول الطلب', `Your request for ${act.title} wasn't accepted.`, `لم يتم قبول طلبك في ${act.title}.`, activityId);
  }

  res.json({ ok: true });
});

// UC-24 & UC-20: Edit Activity & Participant Consent
app.put('/api/activities/:id', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ? AND organizer_id = ?').get(activityId, user.id);
  if (!act) return res.status(404).json({ code: 'ERR-023' });

  const { title, description, date, startTime, duration, venueId, feeAmount, totalSlots } = req.body;
  if (containsContactDetails(title) || containsContactDetails(description)) {
    return res.status(400).json({ code: 'ERR-033' });
  }

  const confirmedOthers = db
    .prepare("SELECT * FROM participations WHERE activity_id = ? AND is_organizer = 0 AND status = 'Confirmed'")
    .all(activityId);

  const consentNeeded =
    confirmedOthers.length > 0 &&
    ((date && date !== act.date) ||
      (startTime && startTime !== act.start_time) ||
      (duration && Number(duration) !== act.duration) ||
      (venueId && venueId !== act.venue_id) ||
      (feeAmount !== undefined && Number(feeAmount) !== act.fee_amount) ||
      (totalSlots && Number(totalSlots) < act.total_slots));

  if (consentNeeded) {
    const deadline = new Date(Date.now() + 12 * 3600000).toISOString();
    const payload = {
      proposed: {
        title: title || act.title,
        description: description ?? act.description,
        date: date || act.date,
        start_time: startTime || act.start_time,
        duration: Number(duration || act.duration),
        venue_id: venueId || act.venue_id,
        fee_amount: Number(feeAmount ?? act.fee_amount),
        total_slots: Number(totalSlots || act.total_slots),
      },
      responses: { [act.organizer_id]: 'accepted' },
      deadline,
    };
    db.prepare('UPDATE activities SET change_pending = 1, change_payload = ?, change_deadline = ? WHERE id = ?').run(
      JSON.stringify(payload),
      deadline,
      activityId
    );
    for (const p of confirmedOthers) {
      createNotification(p.user_id, 'NTF-16', 'Change Needs Your Response', 'تعديل يحتاج لموافقتك', `${act.title} has changes. Accept or decline.`, `تعديل جديد على ${act.title}.`, activityId);
    }
    return res.json({ ok: true, changePending: true, code: 'INF-019' });
  }

  db.prepare(`
    UPDATE activities SET
      title = ?, description = ?, date = ?, start_time = ?, duration = ?, venue_id = ?, fee_amount = ?, total_slots = ?
    WHERE id = ?
  `).run(
    title || act.title,
    description ?? act.description,
    date || act.date,
    startTime || act.start_time,
    Number(duration || act.duration),
    venueId || act.venue_id,
    Number(feeAmount ?? act.fee_amount),
    Number(totalSlots || act.total_slots),
    activityId
  );

  res.json({ ok: true, changePending: false, code: 'NTF-21' });
});

app.post('/api/activities/:id/change-response', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { decision } = req.body;
  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!act || !act.change_pending) return res.status(400).json({ code: 'ERR-023' });

  const payload = JSON.parse(act.change_payload);
  payload.responses[user.id] = decision;

  if (decision === 'decline') {
    db.prepare("UPDATE participations SET status = 'Left', updated_at = ? WHERE activity_id = ? AND user_id = ?").run(
      new Date().toISOString(),
      activityId,
      user.id
    );
  }

  const confirmedParts = db
    .prepare("SELECT user_id FROM participations WHERE activity_id = ? AND status = 'Confirmed'")
    .all(activityId);

  const allResponded = confirmedParts.every((p) => payload.responses[p.user_id]);
  if (allResponded) {
    if (confirmedParts.length >= 3) {
      const prop = payload.proposed;
      db.prepare(`
        UPDATE activities SET
          title = ?, description = ?, date = ?, start_time = ?, duration = ?, venue_id = ?, fee_amount = ?, total_slots = ?,
          change_pending = 0, change_payload = NULL, change_deadline = NULL
        WHERE id = ?
      `).run(prop.title, prop.description, prop.date, prop.start_time, prop.duration, prop.venue_id, prop.fee_amount, prop.total_slots, activityId);
    } else {
      db.prepare(`
        UPDATE activities SET status = 'Cancelled', cancel_reason = 'Not enough participants accepted the change (GBR-01)', change_pending = 0
        WHERE id = ?
      `).run(activityId);
    }
  } else {
    db.prepare('UPDATE activities SET change_payload = ? WHERE id = ?').run(JSON.stringify(payload), activityId);
  }

  res.json({ ok: true });
});

// UC-25: Organizer Cancels Activity
app.post('/api/activities/:id/cancel', (req, res) => {
  const user = getMemberFromReq(req);
  const admin = getAdminFromReq(req);
  if (!user && !admin) return res.status(401).json({ error: 'Unauthorized' });

  const { reason } = req.body;
  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!act) return res.status(404).json({ code: 'ERR-023' });

  const now = new Date();
  const actStart = new Date(`${act.date}T${act.start_time}:00`);
  const hoursUntilStart = (actStart.getTime() - now.getTime()) / 3600000;

  db.prepare("UPDATE activities SET status = 'Cancelled', cancel_reason = ? WHERE id = ?").run(reason || 'Cancelled', activityId);

  const freeUsers = db.prepare('SELECT user_id FROM participations WHERE activity_id = ? AND used_free_activity = 1').all(activityId);
  for (const fu of freeUsers) {
    db.prepare('UPDATE users SET free_first_activity_used = 0 WHERE id = ?').run(fu.user_id);
  }

  if (!admin && hoursUntilStart < 24 && hoursUntilStart > 0) {
    db.prepare('UPDATE users SET organizer_strikes = organizer_strikes + 1 WHERE id = ?').run(act.organizer_id);
  }

  const parts = db.prepare('SELECT user_id FROM participations WHERE activity_id = ? AND is_organizer = 0').all(activityId);
  for (const p of parts) {
    createNotification(p.user_id, 'NTF-15', 'Activity Cancelled', 'تم إلغاء النشاط', `${act.title} on ${act.date} was cancelled: ${reason}.`, `تم إلغاء ${act.title}: ${reason}.`, activityId);
  }

  if (admin) {
    logAudit(admin, 'CANCEL_ACTIVITY', 'Activity', activityId, act.status, 'Cancelled', reason);
  }

  res.json({ ok: true });
});

// UC-27: Propose a New Venue
app.post('/api/venues/propose', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { nameEn, nameAr, address, area, venueType, supportedHobbies, lat, lng } = req.body;
  if (containsContactDetails(nameEn) || containsContactDetails(nameAr) || containsContactDetails(address)) {
    return res.status(400).json({ code: 'ERR-033' });
  }
  const id = uid('ven');
  db.prepare(`
    INSERT INTO venues (id, name_en, name_ar, address, area, city, lat, lng, venue_type, supported_hobbies, public_place_confirmed, status, proposed_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'Cairo', ?, ?, ?, ?, 1, 'Pending', ?, ?)
  `).run(
    id,
    nameEn,
    nameAr || nameEn,
    address || area,
    area || 'Sheikh Zayed',
    lat || user.lat || 30.0444,
    lng || user.lng || 31.2357,
    venueType || 'Court',
    JSON.stringify(supportedHobbies || ['hob-padel']),
    user.id,
    new Date().toISOString()
  );

  res.json({ ok: true, venueId: id, code: 'INF-025' });
});

// UC-28: Suggest a Hobby
app.post('/api/hobbies/suggest', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, description, typicalGroupSize } = req.body;
  if (Number(typicalGroupSize) < 3) {
    return res.status(400).json({ code: 'ERR-064' });
  }
  db.prepare(`
    INSERT INTO hobby_suggestions (id, user_id, name, description, typical_group_size, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'Pending', ?)
  `).run(uid('sug'), user.id, name, description || '', Number(typicalGroupSize), new Date().toISOString());
  res.json({ ok: true, code: 'INF-026' });
});

// UC-29: Generate Real Signed 60-Second Dynamic QR Token & Verify Scanned QR
app.get('/api/activities/:id/qr-token', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tokenData = generateQrToken(req.params.id, user.id);
  res.json(tokenData);
});

app.post('/api/activities/:id/scan-qr', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activityId = req.params.id;
  const { scannedCode } = req.body;
  const matchedUserId = verifyQrToken(activityId, scannedCode);
  if (!matchedUserId) {
    return res.status(400).json({ code: 'ERR-039' });
  }
  const participant = db.prepare('SELECT id, display_name, profile_photo, gender, dob FROM users WHERE id = ?').get(matchedUserId);
  res.json({ ok: true, participant });
});

app.post('/api/activities/:id/checkin', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { participantUserId, matches, organizerConfirmMatch } = req.body;
  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!act) return res.status(404).json({ code: 'ERR-023' });

  const now = new Date().toISOString();

  if (organizerConfirmMatch !== undefined) {
    if (organizerConfirmMatch) {
      db.prepare('UPDATE participations SET organizer_confirmed = 1, updated_at = ? WHERE activity_id = ? AND user_id = ?').run(
        now,
        activityId,
        user.id
      );
      return res.json({ ok: true });
    } else {
      db.prepare(`
        INSERT INTO safety_flags (id, type, target_user_id, activity_id, description, evidence, status, created_at)
        VALUES (?, 'Organizer Identity Mismatch at Check-in', ?, ?, 'Participant reported organizer does not match their verified photo (UC-29 A2).', ?, 'Open', ?)
      `).run(uid('flg'), act.organizer_id, activityId, JSON.stringify({ reportedBy: user.id }), now);
      return res.json({ ok: true, alertSent: true });
    }
  }

  if (matches) {
    db.prepare("UPDATE participations SET status = 'Checked in', checked_in_at = ?, updated_at = ? WHERE activity_id = ? AND user_id = ?").run(
      now,
      now,
      activityId,
      participantUserId
    );
    return res.json({ ok: true, code: 'INF-027' });
  } else {
    db.prepare(`
      INSERT INTO safety_flags (id, type, target_user_id, activity_id, description, evidence, status, created_at)
      VALUES (?, 'Participant Photo Mismatch at Check-in', ?, ?, 'Organizer reported participant does not match their verified photo (UC-29 A1).', ?, 'Open', ?)
    `).run(uid('flg'), participantUserId, activityId, JSON.stringify({ organizerId: act.organizer_id }), now);
    return res.json({ ok: true, mismatchLogged: true });
  }
});

// UC-30: Mark Attendance and No-Shows
app.post('/api/activities/:id/attendance', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { targetUserId, status } = req.body;
  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ? AND organizer_id = ?').get(activityId, user.id);
  if (!act) return res.status(404).json({ code: 'ERR-023' });

  const now = new Date().toISOString();
  db.prepare('UPDATE participations SET status = ?, updated_at = ? WHERE activity_id = ? AND user_id = ?').run(
    status,
    now,
    activityId,
    targetUserId
  );

  if (status === 'No-show') {
    db.prepare('UPDATE users SET participant_strikes = participant_strikes + 1 WHERE id = ?').run(targetUserId);
    createNotification(targetUserId, 'NTF-25', 'Marked as No-show', 'تم تسجيل عدم حضور', `You were marked as a no-show for ${act.title}. Dispute within 48h.`, `تم تسجيل عدم حضورك في ${act.title}.`, activityId);
  } else if (status === 'Attended') {
    db.prepare('UPDATE users SET activities_attended = activities_attended + 1 WHERE id = ?').run(targetUserId);
  }

  res.json({ ok: true });
});

// UC-31: Trigger SOS / Safety Alert
app.post('/api/sos/trigger', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { activityId, lat, lng } = req.body;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  const venue = act ? db.prepare('SELECT * FROM venues WHERE id = ?').get(act.venue_id) : null;

  const id = uid('sos');
  const now = new Date().toISOString();
  const finalLat = lat || user.lat || venue?.lat || 30.0444;
  const finalLng = lng || user.lng || venue?.lng || 31.2357;

  db.prepare(`
    INSERT INTO sos_alerts (id, user_id, activity_id, venue_name, lat, lng, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)
  `).run(id, user.id, activityId, venue?.name_en || 'Activity Venue', finalLat, finalLng, now);

  res.json({
    ok: true,
    sosId: id,
    code: 'INF-028',
    emergencyContactSms: `${user.full_name || user.display_name} triggered a safety alert on Squadly at ${venue?.name_en || 'Venue'}. Live location: https://maps.google.com/?q=${finalLat},${finalLng}`,
  });
});

app.post('/api/sos/:id/safe', (req, res) => {
  db.prepare("UPDATE sos_alerts SET status = 'Safe', notes = 'User reported: I am safe now (NTF-34b)' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// UC-32: Dispute a No-Show
app.post('/api/activities/:id/dispute', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { reason } = req.body;
  db.prepare(`
    UPDATE participations SET dispute_status = 'Pending', dispute_reason = ?, disputed_at = ?
    WHERE activity_id = ? AND user_id = ?
  `).run(reason, new Date().toISOString(), req.params.id, user.id);

  res.json({ ok: true, code: 'INF-032' });
});

// UC-33: Group Chat (With Real Recorded Audio Voice Notes & Location Pins)
app.get('/api/activities/:id/chat', (req, res) => {
  const messages = db
    .prepare(`
      SELECT m.*, u.display_name, u.profile_photo
      FROM chat_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.activity_id = ?
      ORDER BY m.created_at ASC
    `)
    .all(req.params.id);
  res.json({ messages });
});

app.post('/api/activities/:id/chat', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { type, content, audioData, voiceDuration, lat, lng } = req.body;
  const activityId = req.params.id;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!act) return res.status(404).json({ code: 'ERR-034' });

  const confirmedCount = db
    .prepare("SELECT COUNT(*) as c FROM participations WHERE activity_id = ? AND status IN ('Confirmed', 'Checked in', 'Attended')")
    .get(activityId).c;

  if (confirmedCount < 3 || ['Cancelled', 'Completed'].includes(act.status)) {
    return res.status(400).json({ code: confirmedCount < 3 ? 'INF-013' : 'ERR-034' });
  }

  if (type === 'text' && containsContactDetails(content)) {
    return res.status(400).json({ code: 'ERR-033' });
  }

  if (type === 'voice' && Number(voiceDuration) > 60) {
    return res.status(400).json({ code: 'ERR-048' });
  }

  const id = uid('msg');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chat_messages (id, activity_id, sender_id, type, content, audio_data, voice_duration, lat, lng, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    activityId,
    user.id,
    type || 'text',
    content,
    audioData || null,
    voiceDuration || null,
    lat || null,
    lng || null,
    now
  );

  res.json({ ok: true, messageId: id });
});

// UC-34: Post-Activity Ratings
app.post('/api/activities/:id/rate', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { toUserId, stars, positiveTags, negativeTags, privateFeedback } = req.body;
  const activityId = req.params.id;

  db.prepare(`
    INSERT OR REPLACE INTO ratings (id, activity_id, from_user_id, to_user_id, stars, positive_tags, negative_tags, private_feedback, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uid('rat'),
    activityId,
    user.id,
    toUserId,
    Number(stars),
    JSON.stringify(positiveTags || []),
    JSON.stringify(negativeTags || []),
    privateFeedback || null,
    new Date().toISOString()
  );

  const stats = db.prepare('SELECT AVG(stars) as avg, COUNT(*) as cnt FROM ratings WHERE to_user_id = ?').get(toUserId);
  const newAvg = Math.round((stats.avg || 5) * 10) / 10;
  db.prepare('UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?').run(newAvg, stats.cnt, toUserId);

  if ((negativeTags && negativeTags.includes('Unsafe behavior')) || (stats.cnt >= 5 && newAvg < 3.0)) {
    db.prepare(`
      INSERT INTO safety_flags (id, type, target_user_id, activity_id, description, evidence, status, created_at)
      VALUES (?, 'Safety Rating Flag (Unsafe Tag or Low Avg)', ?, ?, 'User received an Unsafe behavior tag or dropped below 3.0 rating threshold.', ?, 'Open', ?)
    `).run(uid('flg'), toUserId, activityId, JSON.stringify({ stars, negativeTags, privateFeedback }), new Date().toISOString());
  }

  res.json({ ok: true, code: 'INF-018' });
});

// UC-35: Report User, Activity, or Message
app.post('/api/reports', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { targetType, targetUserId, activityId, messageId, category, details } = req.body;
  if (category === 'Other' && (!details || !details.trim())) {
    return res.status(400).json({ code: 'ERR-037' });
  }

  const severeCategories = [
    'Harassment / Sexual harassment',
    'Threats or violence',
    'Impersonation / fake profile',
    'Hate speech',
  ];
  const isSevere = severeCategories.includes(category) ? 1 : 0;

  const chatContext = activityId
    ? db.prepare('SELECT sender_id, content, created_at FROM chat_messages WHERE activity_id = ? ORDER BY created_at DESC LIMIT 20').all(activityId)
    : [];

  const repId = uid('rep');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO reports (id, reporter_id, target_type, target_user_id, activity_id, message_id, category, is_severe, details, evidence_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received', ?)
  `).run(
    repId,
    user.id,
    targetType || 'User',
    targetUserId || null,
    activityId || null,
    messageId || null,
    category,
    isSevere,
    details || '',
    JSON.stringify({ chatContext, timestamp: now }),
    now
  );

  if (isSevere && targetUserId && user.false_severe_reports < 2) {
    db.prepare(`
      UPDATE users SET account_status = 'Suspended', suspended_until = 'Pending 24h Moderator Review', suspension_reason = ?
      WHERE id = ?
    `).run(`Auto-suspended under GBR-16 pending review (${category})`, targetUserId);

    createNotification(
      targetUserId,
      'NTF-36',
      'Account Under Review',
      'الحساب قيد المراجعة',
      'Your account is temporarily restricted while we review a report.',
      'تم تقييد حسابك مؤقتاً لحين مراجعة بلاغ متعلق بالسلامة.',
      null,
      'Push, In-app, Email'
    );
  }

  res.json({ ok: true, reportId: repId, code: 'INF-017', autoSuspended: !!(isSevere && targetUserId) });
});

// UC-36: Block / Unblock a User
app.post('/api/blocks', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { blockedId } = req.body;
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO blocks (id, blocker_id, blocked_id, created_at) VALUES (?, ?, ?, ?)').run(
    uid('blk'),
    user.id,
    blockedId,
    now
  );

  const blockCount = db.prepare('SELECT COUNT(*) as c FROM blocks WHERE blocked_id = ?').get(blockedId).c;
  if (blockCount >= 3) {
    db.prepare(`
      INSERT INTO safety_flags (id, type, target_user_id, description, evidence, status, created_at)
      VALUES (?, 'Blocked by 3+ Users', ?, 'User has been blocked by 3 or more distinct members.', ?, 'Open', ?)
    `).run(uid('flg'), blockedId, JSON.stringify({ blockCount }), now);
  }

  res.json({ ok: true });
});

app.delete('/api/blocks/:id', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  db.prepare('DELETE FROM blocks WHERE id = ? AND blocker_id = ?').run(req.params.id, user.id);
  res.json({ ok: true });
});

// UC-11: Delete Account
app.post('/api/account/delete', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const openReport = db.prepare("SELECT id FROM reports WHERE target_user_id = ? AND status != 'Closed'").get(user.id);
  const newStatus = openReport ? 'Deletion pending' : 'Deleted';
  db.prepare('UPDATE users SET account_status = ?, active_session_token = NULL WHERE id = ?').run(newStatus, user.id);
  res.json({ ok: true, status: newStatus, code: 'INF-033' });
});

app.post('/api/notifications/read-all', (req, res) => {
  const user = getMemberFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
  res.json({ ok: true });
});

// ============================================================================
// MODULE I — REAL ADMIN PANEL AUTHENTICATION & RBAC ENDPOINTS (UC-40 to UC-52)
// ============================================================================

app.post('/api/admin/login', (req, res) => {
  const { email, password, twoFaCode } = req.body;
  const admin = db.prepare('SELECT * FROM admin_accounts WHERE LOWER(email) = LOWER(?) AND active = 1').get(String(email || '').trim());
  if (!admin) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const now = new Date();
  if (admin.locked_until && new Date(admin.locked_until) > now) {
    return res.status(429).json({ error: 'Admin account locked for 30 minutes due to 5 failed sign-in attempts (UC-40 E1).' });
  }

  const candidateHash = hashPassword(password || '');
  if (candidateHash !== admin.password_hash || String(twoFaCode || '').trim() !== admin.two_fa_secret) {
    const failed = admin.failed_attempts + 1;
    const lockUntil = failed >= 5 ? new Date(now.getTime() + 30 * 60000).toISOString() : null;
    db.prepare('UPDATE admin_accounts SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(failed, lockUntil, admin.id);
    return res.status(401).json({ error: `Invalid password or 2FA code (${Math.max(0, 5 - failed)} attempts remaining).` });
  }

  // Reset failed attempts & issue 30-minute idle timeout JWT (UC-40)
  db.prepare('UPDATE admin_accounts SET failed_attempts = 0, locked_until = NULL, last_login = ? WHERE id = ?').run(now.toISOString(), admin.id);
  const token = signJwt({ type: 'admin', adminId: admin.id, role: admin.role, name: admin.name }, 30 * 60);
  logAudit(admin, 'ADMIN_LOGIN', 'AdminAccount', admin.id, null, 'Signed in with 2FA', 'Authenticated session started');

  res.json({
    ok: true,
    token,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  });
});

app.get('/api/admin/overview', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin) return res.status(401).json({ error: 'Admin authentication required' });

  // Section 7.2 Role-Based Filtering: Only Super Admin & Verification Reviewer can see KYC document images (GBR-37)
  const canSeeKyc = ['Super Admin', 'Verification Reviewer'].includes(admin.role);
  const verifications = canSeeKyc
    ? db.prepare(`
        SELECT v.*, u.full_name, u.display_name, u.dob, u.gender, u.mobile, u.profile_photo, u.city
        FROM verifications v
        JOIN users u ON u.id = v.user_id
        ORDER BY v.submitted_at ASC
      `).all()
    : [];

  if (canSeeKyc && verifications.some((v) => v.status === 'Pending')) {
    logAudit(admin, 'VIEW_KYC_QUEUE', 'VerificationQueue', 'all', null, 'Viewed pending ID document queue (GBR-37)', 'Routine KYC review');
  }

  const probationActivities = db.prepare(`
    SELECT a.*, u.display_name as organizer_name, u.full_name as organizer_full_name, u.approved_activities_count, v.name_en as venue_name, h.name_en as hobby_name, h.icon as hobby_icon
    FROM activities a
    JOIN users u ON u.id = a.organizer_id
    JOIN venues v ON v.id = a.venue_id
    JOIN hobbies h ON h.id = a.hobby_id
    WHERE a.status = 'Pending Approval'
    ORDER BY a.date ASC, a.start_time ASC
  `).all();

  const reports = db.prepare(`
    SELECT r.*, rep.display_name as reporter_name, tgt.display_name as target_name, tgt.account_status as target_status, a.title as activity_title
    FROM reports r
    LEFT JOIN users rep ON rep.id = r.reporter_id
    LEFT JOIN users tgt ON tgt.id = r.target_user_id
    LEFT JOIN activities a ON a.id = r.activity_id
    ORDER BY r.is_severe DESC, r.created_at DESC
  `).all();

  const disputes = db.prepare(`
    SELECT p.*, u.display_name, a.title as activity_title, a.date as activity_date
    FROM participations p
    JOIN users u ON u.id = p.user_id
    JOIN activities a ON a.id = p.activity_id
    WHERE p.dispute_status IS NOT NULL
  `).all();

  const sosAlerts = db.prepare(`
    SELECT s.*, u.full_name, u.display_name, u.mobile, u.emergency_name, u.emergency_mobile, u.emergency_relation, a.title as activity_title
    FROM sos_alerts s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN activities a ON a.id = s.activity_id
    ORDER BY s.created_at DESC
  `).all();

  const safetyFlags = db.prepare(`
    SELECT f.*, u.display_name as target_name
    FROM safety_flags f
    LEFT JOIN users u ON u.id = f.target_user_id
    ORDER BY f.created_at DESC
  `).all();

  const users = db.prepare("SELECT * FROM users WHERE account_status != 'Deleted' ORDER BY created_at DESC").all();

  // Moderators see safety metrics only, no revenue (UC-50)
  const subscriptions =
    admin.role === 'Super Admin'
      ? db.prepare(`
          SELECT s.*, u.display_name, u.full_name, u.mobile, u.activities_attended
          FROM subscriptions s
          JOIN users u ON u.id = s.user_id
          ORDER BY s.started_at DESC
        `).all()
      : [];

  const hobbySuggestions = db.prepare(`
    SELECT hs.*, u.display_name
    FROM hobby_suggestions hs
    LEFT JOIN users u ON u.id = hs.user_id
    ORDER BY hs.created_at DESC
  `).all();

  const auditLogs = admin.role === 'Super Admin' ? db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all() : [];

  res.json({
    admin,
    verifications,
    probationActivities,
    reports,
    disputes,
    sosAlerts,
    safetyFlags,
    users,
    subscriptions,
    hobbySuggestions,
    auditLogs,
  });
});

// UC-43: Review Identity Verification
app.post('/api/admin/verifications/:id/decision', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Verification Reviewer'].includes(admin.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { decision, reason } = req.body;
  const ver = db.prepare('SELECT * FROM verifications WHERE id = ?').get(req.params.id);
  if (!ver) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  if (decision === 'approve') {
    db.prepare("UPDATE verifications SET status = 'Approved', reviewed_at = ?, reviewed_by = ?, front_image = NULL, back_image = NULL WHERE id = ?").run(
      now,
      admin.id,
      ver.id
    );
    if (ver.type === 'PhotoChange') {
      const u = db.prepare('SELECT pending_photo FROM users WHERE id = ?').get(ver.user_id);
      db.prepare('UPDATE users SET profile_photo = COALESCE(?, profile_photo), pending_photo = NULL WHERE id = ?').run(u?.pending_photo, ver.user_id);
    } else {
      db.prepare("UPDATE users SET account_status = 'Verified', verification_status = 'Approved' WHERE id = ?").run(ver.user_id);
      createNotification(ver.user_id, 'NTF-01', "You're Verified!", 'تم توثيق هويتك!', "You're verified! Subscribe to start joining activities.", 'تم توثيق هويتك بنجاح!', null, 'Push, In-app, Email');
    }
    logAudit(admin, 'APPROVE_VERIFICATION', 'Verification', ver.id, 'Pending', 'Approved (ID images deleted per Section 11.3)', 'Checklist passed');
  } else if (decision === 'block') {
    db.prepare("UPDATE verifications SET status = 'Blocked', rejection_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(reason || 'Underage or fake document', now, admin.id, ver.id);
    db.prepare("UPDATE users SET account_status = 'Banned', verification_status = 'Blocked', active_session_token = NULL WHERE id = ?").run(ver.user_id);
    logAudit(admin, 'BLOCK_VERIFICATION', 'Verification', ver.id, 'Pending', 'Blocked / Banned', reason);
  } else {
    db.prepare("UPDATE verifications SET status = 'Rejected', rejection_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(reason || 'Blurry document', now, admin.id, ver.id);
    db.prepare("UPDATE users SET verification_status = 'Rejected', verification_rejection_reason = ? WHERE id = ?").run(reason || 'Blurry', ver.user_id);
    createNotification(ver.user_id, 'NTF-02', 'Verification Not Approved', 'لم يتم قبول التوثيق', `We couldn't verify your identity: ${reason}. Please try again.`, `تعذر توثيق هويتك: ${reason}.`, null, 'Push, In-app, Email');
    logAudit(admin, 'REJECT_VERIFICATION', 'Verification', ver.id, 'Pending', 'Rejected', reason);
  }

  res.json({ ok: true });
});

// UC-44: Approve / Reject Probation Activity
app.post('/api/admin/probation/:id/decision', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Moderator'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' });

  const { decision, reason } = req.body;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!act) return res.status(404).json({ error: 'Not found' });

  if (decision === 'approve') {
    db.prepare("UPDATE activities SET status = 'Published' WHERE id = ?").run(act.id);
    db.prepare(`
      UPDATE users SET
        approved_activities_count = approved_activities_count + 1,
        probation_ended = CASE WHEN approved_activities_count + 1 >= 3 THEN 1 ELSE 0 END
      WHERE id = ?
    `).run(act.organizer_id);
    createNotification(act.organizer_id, 'NTF-27', 'Activity Approved!', 'تمت الموافقة على نشاطك!', `${act.title} was approved and is now live.`, `تمت الموافقة على ${act.title}.`, act.id);
    logAudit(admin, 'APPROVE_PROBATION_ACTIVITY', 'Activity', act.id, 'Pending Approval', 'Published', 'Meets safety & venue guidelines');
  } else {
    db.prepare("UPDATE activities SET status = 'Rejected', cancel_reason = ? WHERE id = ?").run(reason || 'Rejected by Moderator', act.id);
    createNotification(act.organizer_id, 'NTF-27', 'Activity Not Approved', 'لم تتم الموافقة على النشاط', `${act.title} was not approved: ${reason}.`, `لم تتم الموافقة على ${act.title}: ${reason}.`, act.id);
    logAudit(admin, 'REJECT_PROBATION_ACTIVITY', 'Activity', act.id, 'Pending Approval', 'Rejected', reason);
  }

  res.json({ ok: true });
});

// UC-41: Manage Hobbies
app.post('/api/admin/hobbies', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || admin.role !== 'Super Admin') return res.status(403).json({ error: 'Forbidden' });

  const { nameEn, nameAr, icon, minSlots, maxSlots, defaultDuration, outdoor } = req.body;
  if (Number(minSlots) < 3) return res.status(400).json({ code: 'ERR-050' });
  const id = uid('hob');
  const maxOrder = db.prepare('SELECT MAX(display_order) as m FROM hobbies').get().m || 1;
  db.prepare('INSERT INTO hobbies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    nameEn,
    nameAr || nameEn,
    icon || '🏆',
    Number(minSlots),
    Number(maxSlots || 12),
    Number(defaultDuration || 90),
    outdoor ? 1 : 0,
    'Active',
    maxOrder + 1
  );
  logAudit(admin, 'CREATE_HOBBY', 'Hobby', id, null, nameEn, 'Added to catalog');
  res.json({ ok: true });
});

app.post('/api/admin/hobbies/:id/toggle', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || admin.role !== 'Super Admin') return res.status(403).json({ error: 'Forbidden' });

  const h = db.prepare('SELECT * FROM hobbies WHERE id = ?').get(req.params.id);
  const next = h.status === 'Active' ? 'Inactive' : 'Active';
  db.prepare('UPDATE hobbies SET status = ? WHERE id = ?').run(next, h.id);
  logAudit(admin, 'TOGGLE_HOBBY', 'Hobby', h.id, h.status, next, 'Catalog update');
  res.json({ ok: true });
});

// UC-42: Manage Venues
app.post('/api/admin/venues/:id/decision', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Moderator'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' });

  const { decision, reason } = req.body;
  const v = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Not found' });
  const nextStatus = decision === 'approve' ? 'Approved' : decision === 'deactivate' ? 'Inactive' : 'Rejected';
  db.prepare('UPDATE venues SET status = ?, rejection_reason = ? WHERE id = ?').run(nextStatus, reason || null, v.id);
  if (v.proposed_by) {
    createNotification(v.proposed_by, 'NTF-28', 'Venue Proposal Decision', 'قرار اقتراح المكان', `Your venue ${v.name_en} was ${nextStatus.toLowerCase()}.`, `تم تحديث حالة المكان المقترح ${v.name_ar}: ${nextStatus}.`, null);
  }
  logAudit(admin, 'VENUE_DECISION', 'Venue', v.id, v.status, nextStatus, reason || 'Venue moderation');
  res.json({ ok: true });
});

// UC-45: Resolve Report & UC-32 Resolve Dispute
app.post('/api/admin/reports/:id/resolve', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Moderator'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' });

  const { outcome, adminNote } = req.body;
  const rep = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  db.prepare("UPDATE reports SET status = 'Closed', outcome = ?, admin_note = ?, resolved_at = ?, resolved_by = ? WHERE id = ?").run(
    outcome,
    adminNote || 'Reviewed by Moderator',
    now,
    admin.id,
    rep.id
  );

  if (rep.target_user_id) {
    if (outcome === 'Dismiss' && rep.is_severe) {
      db.prepare("UPDATE users SET account_status = 'Verified', suspended_until = NULL, suspension_reason = NULL WHERE id = ?").run(rep.target_user_id);
      createNotification(rep.target_user_id, 'NTF-26b', 'Suspension Lifted', 'تم رفع التقييد', 'Your account is fully active again.', 'حسابك مفعل بالكامل الآن.');
    } else if (outcome === 'Suspend 14 days') {
      const suspEnd = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      db.prepare("UPDATE users SET account_status = 'Suspended', suspended_until = ? WHERE id = ?").run(suspEnd, rep.target_user_id);
    } else if (outcome === 'Ban' && admin.role === 'Super Admin') {
      db.prepare("UPDATE users SET account_status = 'Banned', active_session_token = NULL WHERE id = ?").run(rep.target_user_id);
    } else if (outcome === 'Mark as false report') {
      db.prepare('UPDATE users SET false_severe_reports = false_severe_reports + 1 WHERE id = ?').run(rep.reporter_id);
      if (rep.is_severe) {
        db.prepare("UPDATE users SET account_status = 'Verified', suspended_until = NULL WHERE id = ?").run(rep.target_user_id);
      }
    }
  }

  createNotification(rep.reporter_id, 'NTF-37', 'Report Closed', 'تم إغلاق البلاغ', 'Your report is Closed. Thank you for keeping Squadly safe.', 'تمت مراجعة وإغلاق بلاغك.');
  logAudit(admin, 'RESOLVE_REPORT', 'Report', rep.id, rep.status, outcome, adminNote);
  res.json({ ok: true });
});

app.post('/api/admin/disputes/:id/resolve', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Moderator'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' });

  const { decision } = req.body;
  const part = db.prepare('SELECT * FROM participations WHERE id = ?').get(req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });

  if (decision === 'Upheld') {
    db.prepare("UPDATE participations SET status = 'Attended', dispute_status = 'Upheld' WHERE id = ?").run(part.id);
    db.prepare('UPDATE users SET participant_strikes = MAX(0, participant_strikes - 1), activities_attended = activities_attended + 1 WHERE id = ?').run(part.user_id);
  } else {
    db.prepare("UPDATE participations SET dispute_status = 'Rejected' WHERE id = ?").run(part.id);
  }
  logAudit(admin, 'RESOLVE_DISPUTE', 'Participation', part.id, 'Pending', decision, 'No-show dispute review');
  res.json({ ok: true });
});

// UC-46: Admin User Actions
app.post('/api/admin/users/:id/action', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Moderator'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' });

  const { action, reason } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });

  if (action === 'suspend') {
    const end = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    db.prepare("UPDATE users SET account_status = 'Suspended', suspended_until = ?, suspension_reason = ? WHERE id = ?").run(end, reason, u.id);
  } else if (action === 'lift') {
    db.prepare("UPDATE users SET account_status = 'Verified', suspended_until = NULL, suspension_reason = NULL, participant_strikes = 0 WHERE id = ?").run(u.id);
  } else if (action === 'ban' && admin.role === 'Super Admin') {
    db.prepare("UPDATE users SET account_status = 'Banned', active_session_token = NULL WHERE id = ?").run(u.id);
  } else if (action === 'unban' && admin.role === 'Super Admin') {
    db.prepare("UPDATE users SET account_status = 'Verified' WHERE id = ?").run(u.id);
  } else if (action === 'end_probation' && admin.role === 'Super Admin') {
    db.prepare('UPDATE users SET probation_ended = 1, approved_activities_count = MAX(3, approved_activities_count) WHERE id = ?').run(u.id);
  }
  logAudit(admin, `USER_${action.toUpperCase()}`, 'User', u.id, u.account_status, action, reason);
  res.json({ ok: true });
});

// UC-48: Subscriptions Refund
app.post('/api/admin/subscriptions/:id/refund', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || admin.role !== 'Super Admin') return res.status(403).json({ error: 'Forbidden' });

  const { decision } = req.body;
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  if (decision === 'approve') {
    db.prepare("UPDATE subscriptions SET status = 'Refunded', refund_requested = 0 WHERE id = ?").run(sub.id);
    db.prepare("UPDATE users SET subscription_status = 'Refunded', free_first_activity_used = 1 WHERE id = ?").run(sub.user_id);
    logAudit(admin, 'APPROVE_REFUND', 'Subscription', sub.id, 'Active', 'Refunded (GBR-35)', 'Within 14 days, 0 activities attended');
  } else {
    db.prepare('UPDATE subscriptions SET refund_requested = 0 WHERE id = ?').run(sub.id);
  }
  res.json({ ok: true });
});

// UC-49: Acknowledge SOS Alert
app.post('/api/admin/sos/:id/acknowledge', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || !['Super Admin', 'Moderator'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' });

  const { status, notes } = req.body;
  db.prepare('UPDATE sos_alerts SET status = ?, acknowledged_by = ?, acknowledged_at = ?, notes = ? WHERE id = ?').run(
    status || 'Acknowledged',
    admin.id,
    new Date().toISOString(),
    notes || 'Moderator acknowledged and contacted member',
    req.params.id
  );
  logAudit(admin, 'ACKNOWLEDGE_SOS', 'SOSAlert', req.params.id, 'Active', status || 'Acknowledged', notes);
  res.json({ ok: true });
});

// UC-51: Update System Parameter
app.post('/api/admin/parameters/:key', (req, res) => {
  const admin = getAdminFromReq(req);
  if (!admin || admin.role !== 'Super Admin') return res.status(403).json({ error: 'Forbidden' });

  const { value } = req.body;
  const key = req.params.key;
  if (key === 'min_people_per_activity' && Number(value) < 3) {
    return res.status(400).json({ code: 'ERR-050' });
  }
  const old = db.prepare('SELECT value FROM system_parameters WHERE key = ?').get(key);
  db.prepare('UPDATE system_parameters SET value = ?, updated_at = ? WHERE key = ?').run(String(value), new Date().toISOString(), key);
  logAudit(admin, 'UPDATE_PARAMETER', 'SystemParameter', key, old?.value, value, 'System configuration update');
  res.json({ ok: true });
});

// SPA Fallback for client-side routes (/admin, /activities, etc.)
app.get('*', (req, res) => {
  const indexFile = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(200).send('Squadly API Server Active');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Squadly Production Server (v1.1) running on http://0.0.0.0:${PORT}`);
});

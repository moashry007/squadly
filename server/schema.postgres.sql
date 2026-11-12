-- ============================================================================
-- Squadly v1.1 — PostgreSQL / Supabase Production Schema (Release 1)
-- Complies with Egypt Personal Data Protection Law No. 151 of 2020
-- Time zone: Africa/Cairo
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_parameters (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hobbies (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(30) UNIQUE NOT NULL,
  name_ar VARCHAR(30) UNIQUE NOT NULL,
  icon TEXT NOT NULL,
  min_slots INTEGER NOT NULL CHECK (min_slots >= 3),
  max_slots INTEGER NOT NULL CHECK (max_slots >= min_slots AND max_slots <= 50),
  default_duration INTEGER NOT NULL CHECK (default_duration BETWEEN 30 AND 720),
  outdoor BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  display_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS venues (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(60) NOT NULL,
  name_ar VARCHAR(60) NOT NULL,
  address TEXT NOT NULL,
  area VARCHAR(60) NOT NULL,
  city VARCHAR(60) NOT NULL DEFAULT 'Cairo',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  venue_type VARCHAR(40) NOT NULL,
  supported_hobbies JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_place_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  opening_hours VARCHAR(60),
  status VARCHAR(20) NOT NULL DEFAULT 'Approved',
  proposed_by VARCHAR(64),
  rejection_reason TEXT,
  unsafe_reports_30d INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  mobile VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(60),
  display_name VARCHAR(40),
  dob DATE,
  gender VARCHAR(10),
  city VARCHAR(40) DEFAULT 'Cairo',
  area VARCHAR(60) DEFAULT 'Sheikh Zayed',
  email VARCHAR(120) UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_photo TEXT,
  pending_photo TEXT,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  emergency_name VARCHAR(60),
  emergency_mobile VARCHAR(20),
  emergency_relation VARCHAR(30),
  terms_version VARCHAR(20) DEFAULT '1.1',
  terms_accepted_at TIMESTAMPTZ,
  account_status VARCHAR(30) NOT NULL DEFAULT 'Registered',
  suspended_until TEXT,
  suspension_reason TEXT,
  organizing_suspended_until TEXT,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'Not submitted',
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  verification_rejection_reason TEXT,
  doc_type VARCHAR(30),
  doc_hash VARCHAR(128) UNIQUE,
  subscription_status VARCHAR(30) NOT NULL DEFAULT 'None',
  subscription_start DATE,
  subscription_end DATE,
  free_first_activity_used BOOLEAN NOT NULL DEFAULT FALSE,
  approved_activities_count INTEGER NOT NULL DEFAULT 0,
  probation_ended BOOLEAN NOT NULL DEFAULT FALSE,
  activities_attended INTEGER NOT NULL DEFAULT 0,
  activities_organized INTEGER NOT NULL DEFAULT 0,
  participant_strikes NUMERIC(4,1) NOT NULL DEFAULT 0,
  organizer_strikes INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,1) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  top_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  false_severe_reports INTEGER NOT NULL DEFAULT 0,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  notif_interest_matches BOOLEAN NOT NULL DEFAULT TRUE,
  active_session_token TEXT,
  lat DOUBLE PRECISION NOT NULL DEFAULT 30.0444,
  lng DOUBLE PRECISION NOT NULL DEFAULT 31.2357,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_requests (
  mobile VARCHAR(20) PRIMARY KEY,
  otp_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL,
  resends_this_hour INTEGER NOT NULL DEFAULT 0,
  wrong_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS verifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'Identity',
  doc_type VARCHAR(30) NOT NULL,
  doc_number_masked VARCHAR(40),
  doc_hash VARCHAR(128),
  front_image TEXT,
  back_image TEXT,
  selfie_image TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(64) PRIMARY KEY,
  hobby_id VARCHAR(64) NOT NULL REFERENCES hobbies(id),
  organizer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  title VARCHAR(60) NOT NULL,
  description VARCHAR(500),
  date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  duration INTEGER NOT NULL,
  venue_id VARCHAR(64) NOT NULL REFERENCES venues(id),
  area VARCHAR(60) NOT NULL,
  total_slots INTEGER NOT NULL,
  min_to_run INTEGER NOT NULL CHECK (min_to_run >= 3),
  confirmation_deadline_hours INTEGER NOT NULL DEFAULT 6,
  gender_type VARCHAR(20) NOT NULL DEFAULT 'Mixed',
  skill_level VARCHAR(20) NOT NULL DEFAULT 'All levels',
  age_min INTEGER,
  age_max INTEGER,
  join_mode VARCHAR(20) NOT NULL DEFAULT 'Approval',
  fee_required BOOLEAN NOT NULL DEFAULT FALSE,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  fee_covers VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'Published',
  change_pending BOOLEAN NOT NULL DEFAULT FALSE,
  change_payload JSONB,
  change_deadline TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participations (
  id VARCHAR(64) PRIMARY KEY,
  activity_id VARCHAR(64) NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_organizer BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'Confirmed',
  waitlist_pos INTEGER,
  offer_expires_at TIMESTAMPTZ,
  request_expires_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  organizer_confirmed BOOLEAN DEFAULT FALSE,
  used_free_activity BOOLEAN NOT NULL DEFAULT FALSE,
  dispute_status VARCHAR(20),
  dispute_reason VARCHAR(300),
  disputed_at TIMESTAMPTZ,
  muted_chat BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  activity_id VARCHAR(64) NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  audio_data TEXT,
  voice_duration INTEGER,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id VARCHAR(64) PRIMARY KEY,
  activity_id VARCHAR(64) NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  from_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  to_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  positive_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  negative_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_feedback VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  reporter_id VARCHAR(64) NOT NULL REFERENCES users(id),
  target_type VARCHAR(20) NOT NULL,
  target_user_id VARCHAR(64),
  activity_id VARCHAR(64),
  message_id VARCHAR(64),
  category VARCHAR(80) NOT NULL,
  is_severe BOOLEAN NOT NULL DEFAULT FALSE,
  details TEXT,
  evidence_json JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'Received',
  outcome VARCHAR(60),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS blocks (
  id VARCHAR(64) PRIMARY KEY,
  blocker_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS sos_alerts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  activity_id VARCHAR(64) NOT NULL REFERENCES activities(id),
  venue_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  acknowledged_by VARCHAR(64),
  acknowledged_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_flags (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(80) NOT NULL,
  target_user_id VARCHAR(64),
  activity_id VARCHAR(64),
  venue_id VARCHAR(64),
  description TEXT NOT NULL,
  evidence JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  channels VARCHAR(60) NOT NULL DEFAULT 'Push, In-app',
  related_activity_id VARCHAR(64),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_egp INTEGER NOT NULL,
  promo_code VARCHAR(40),
  payment_method VARCHAR(40) NOT NULL DEFAULT 'Card',
  transaction_ref VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
  refund_reason TEXT,
  started_at DATE NOT NULL,
  ends_at DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code VARCHAR(40) PRIMARY KEY,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_fixed INTEGER NOT NULL DEFAULT 0,
  valid_until DATE NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  applies_to VARCHAR(20) NOT NULL DEFAULT 'both',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS hobby_suggestions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  name VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  typical_group_size INTEGER NOT NULL CHECK (typical_group_size >= 3),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(40) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  two_fa_secret VARCHAR(64) NOT NULL DEFAULT 'SQUADLY2FA',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  admin_name VARCHAR(80) NOT NULL,
  admin_role VARCHAR(40) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  before_val TEXT,
  after_val TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

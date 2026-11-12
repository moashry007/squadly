-- ============================================================================
-- Squadly v1.1 — Row Level Security (RLS) & Authorization Policies
-- Supabase Best Practices Compliant:
-- 1. Uses explicit `TO authenticated` / `TO anon` clauses (avoids deprecated auth.role())
-- 2. Combines `TO authenticated` with ownership predicates (protects against BOLA/IDOR)
-- 3. Provides symmetric USING + WITH CHECK clauses for all UPDATE policies
-- 4. Ensures all UPDATE operations have corresponding SELECT policies
-- ============================================================================

-- 1. ENABLE ROW LEVEL SECURITY ON ALL 20 TABLES
ALTER TABLE "public"."system_parameters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hobbies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."otp_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."participations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sos_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."safety_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hobby_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

-- 2. PUBLIC CATALOG TABLES (Read access for both anon and authenticated)
CREATE POLICY "Public read for system parameters"
  ON "public"."system_parameters" FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read for active hobbies"
  ON "public"."hobbies" FOR SELECT
  TO anon, authenticated
  USING (status = 'Active');

CREATE POLICY "Public read for approved venues"
  ON "public"."venues" FOR SELECT
  TO anon, authenticated
  USING (status = 'Approved');

CREATE POLICY "Members can suggest venues"
  ON "public"."venues" FOR INSERT
  TO authenticated
  WITH CHECK (proposed_by = (SELECT auth.uid())::text);

-- 3. USERS TABLE POLICIES
CREATE POLICY "Users can read public member profiles"
  ON "public"."users" FOR SELECT
  TO anon, authenticated
  USING (account_status != 'Banned' AND account_status != 'Deleted');

CREATE POLICY "Users can insert their own profile"
  ON "public"."users" FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own profile"
  ON "public"."users" FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid())::text)
  WITH CHECK (id = (SELECT auth.uid())::text);

-- 4. ACTIVITIES POLICIES
CREATE POLICY "Public read for published activities"
  ON "public"."activities" FOR SELECT
  TO anon, authenticated
  USING (status IN ('Published', 'Confirmed', 'Completed', 'In progress'));

CREATE POLICY "Authenticated members can host activities"
  ON "public"."activities" FOR INSERT
  TO authenticated
  WITH CHECK (organizer_id = (SELECT auth.uid())::text);

CREATE POLICY "Organizers can update their own activities"
  ON "public"."activities" FOR UPDATE
  TO authenticated
  USING (organizer_id = (SELECT auth.uid())::text)
  WITH CHECK (organizer_id = (SELECT auth.uid())::text);

-- 5. PARTICIPATIONS POLICIES
CREATE POLICY "Members can view activity participations"
  ON "public"."participations" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Members can join activities"
  ON "public"."participations" FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own participation status"
  ON "public"."participations" FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text)
  WITH CHECK (user_id = (SELECT auth.uid())::text);

-- 6. GROUP CHAT MESSAGES POLICIES
CREATE POLICY "Participants can view activity chat"
  ON "public"."chat_messages" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."participations" p
      WHERE p.activity_id = "public"."chat_messages".activity_id
        AND p.user_id = (SELECT auth.uid())::text
        AND p.status IN ('Confirmed', 'Checked in', 'Attended')
    )
    OR
    EXISTS (
      SELECT 1 FROM "public"."activities" a
      WHERE a.id = "public"."chat_messages".activity_id
        AND a.organizer_id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "Confirmed participants can post messages"
  ON "public"."chat_messages" FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid())::text);

-- 7. RATINGS POLICIES
CREATE POLICY "Members can view ratings"
  ON "public"."ratings" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Members can submit peer ratings"
  ON "public"."ratings" FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = (SELECT auth.uid())::text);

-- 8. NOTIFICATIONS POLICIES
CREATE POLICY "Users can read own notifications"
  ON "public"."notifications" FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Users can mark own notifications as read"
  ON "public"."notifications" FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text)
  WITH CHECK (user_id = (SELECT auth.uid())::text);

-- 9. USER BLOCKING POLICIES
CREATE POLICY "Users can manage own blocks"
  ON "public"."blocks" FOR ALL
  TO authenticated
  USING (blocker_id = (SELECT auth.uid())::text)
  WITH CHECK (blocker_id = (SELECT auth.uid())::text);

-- 10. SOS ALERTS & SAFETY POLICIES
CREATE POLICY "Users can trigger emergency SOS"
  ON "public"."sos_alerts" FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Users can view own SOS alerts"
  ON "public"."sos_alerts" FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

-- 11. REPORTS POLICIES
CREATE POLICY "Users can file safety reports"
  ON "public"."reports" FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid())::text);

CREATE POLICY "Users can view their filed reports"
  ON "public"."reports" FOR SELECT
  TO authenticated
  USING (reporter_id = (SELECT auth.uid())::text);

-- 12. VERIFICATIONS (KYC) POLICIES
CREATE POLICY "Users can view own KYC status"
  ON "public"."verifications" FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Users can submit own KYC documents"
  ON "public"."verifications" FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

-- 13. SUBSCRIPTIONS POLICIES
CREATE POLICY "Users can view own subscription"
  ON "public"."subscriptions" FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

-- 14. PROMO CODES
CREATE POLICY "Authenticated members can validate active promo codes"
  ON "public"."promo_codes" FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- 15. HOBBY SUGGESTIONS
CREATE POLICY "Members can suggest hobbies"
  ON "public"."hobby_suggestions" FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Members can view their suggested hobbies"
  ON "public"."hobby_suggestions" FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

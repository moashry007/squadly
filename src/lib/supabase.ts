/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://wizhgerfvebjkssdgfpl.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpemhnZXJmdmViamtzc2RnZnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTkwNjcsImV4cCI6MjEwOTg3NTA2N30.TOKm91TBb_XY2IHneLtgHp_YePrVlgxzA_9YpdcOv4M';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Helper to request SMS OTP via Supabase Auth
 * Note: Requires SMS provider (e.g. Twilio) configured in Supabase project dashboard.
 */
export async function sendSupabasePhoneOtp(phone: string) {
  return await supabase.auth.signInWithOtp({
    phone,
  });
}

/**
 * Helper to verify SMS OTP via Supabase Auth
 */
export async function verifySupabasePhoneOtp(phone: string, token: string) {
  return await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
}

/**
 * Sign out of current Supabase Auth session
 */
export async function signOutOfSupabase() {
  return await supabase.auth.signOut();
}

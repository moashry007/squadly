import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Calendar,
  MapPin,
  Sparkles,
  FileText,
  CreditCard,
  Settings,
  Activity as ActivityIcon,
  Download,
  Lock,
  PhoneCall,
  Eye,
  Plus,
  RefreshCw,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { Lang } from '../i18n/messages';
import { DialogConfig } from './HardwareModals';

interface AdminPanelProps {
  lang: Lang;
  bootstrapData: any;
  onRefresh: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  openDialog: (cfg: DialogConfig) => void;
  onExitAdmin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  lang,
  bootstrapData,
  onRefresh,
  showToast,
  openDialog,
  onExitAdmin,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('squadly_admin_token'));
  const [adminUser, setAdminUser] = useState<any>(() => {
    const raw = localStorage.getItem('squadly_admin_user');
    return raw ? JSON.parse(raw) : null;
  });

  // Login Form State (UC-40: Email + 12+ char password + mandatory 2FA)
  const [email, setEmail] = useState('super@squadly.eg');
  const [password, setPassword] = useState('SquadlyAdmin#2027');
  const [twoFaCode, setTwoFaCode] = useState('123456');

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // New Hobby state (UC-41)
  const [newHobbyEn, setNewHobbyEn] = useState('');
  const [newHobbyAr, setNewHobbyAr] = useState('');
  const [newHobbyIcon, setNewHobbyIcon] = useState('🎾');
  const [newHobbyMin, setNewHobbyMin] = useState(4);
  const [newHobbyMax, setNewHobbyMax] = useState(12);
  const [newHobbyDur, setNewHobbyDur] = useState(90);

  const [userSearch, setUserSearch] = useState('');

  const adminHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  };

  const fetchOverview = async (tokenOverride?: string) => {
    const tk = tokenOverride ?? adminToken;
    if (!tk) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.status === 401) {
        handleAdminLogout();
        return;
      }
      const data = await res.json();
      setOverview(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) fetchOverview();
  }, [adminToken]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, twoFaCode }),
    });
    const d = await res.json();
    if (!res.ok) {
      showToast(d.error || 'Admin sign-in failed', 'error');
      return;
    }
    localStorage.setItem('squadly_admin_token', d.token);
    localStorage.setItem('squadly_admin_user', JSON.stringify(d.admin));
    setAdminToken(d.token);
    setAdminUser(d.admin);
    showToast(`Signed in as ${d.admin.name} (${d.admin.role})`, 'success');
    fetchOverview(d.token);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('squadly_admin_token');
    localStorage.removeItem('squadly_admin_user');
    setAdminToken(null);
    setAdminUser(null);
    setOverview(null);
  };

  const role = adminUser?.role || 'Moderator';

  // Section 7.2 Admin Permissions Matrix
  const allowedTabs = [
    { id: 'dashboard', label: lang === 'ar' ? 'لوحة المؤشرات' : 'Dashboard', roles: ['Super Admin', 'Moderator', 'Verification Reviewer'], icon: ActivityIcon },
    { id: 'verifications', label: lang === 'ar' ? 'توثيق الهوية' : 'KYC Verifications', roles: ['Super Admin', 'Verification Reviewer'], icon: Shield },
    { id: 'probation', label: lang === 'ar' ? 'أنشطة الاختبار' : 'Probation Approvals', roles: ['Super Admin', 'Moderator'], icon: CheckCircle2 },
    { id: 'safety', label: lang === 'ar' ? 'طوارئ SOS والإشارات' : 'Live SOS & Flags', roles: ['Super Admin', 'Moderator'], icon: AlertTriangle },
    { id: 'reports', label: lang === 'ar' ? 'البلاغات والاعتراضات' : 'Reports & Disputes', roles: ['Super Admin', 'Moderator'], icon: FileText },
    { id: 'users', label: lang === 'ar' ? 'إدارة الأعضاء' : 'Users', roles: ['Super Admin', 'Moderator'], icon: Users },
    { id: 'activities', label: lang === 'ar' ? 'إدارة الأنشطة' : 'Activities', roles: ['Super Admin', 'Moderator'], icon: Calendar },
    { id: 'venues', label: lang === 'ar' ? 'الأماكن المعتمدة' : 'Vetted Venues', roles: ['Super Admin', 'Moderator'], icon: MapPin },
    { id: 'hobbies', label: lang === 'ar' ? 'كتالوج الهوايات' : 'Hobbies', roles: ['Super Admin'], icon: Sparkles },
    { id: 'subscriptions', label: lang === 'ar' ? 'الاشتراكات والاسترداد' : 'Subscriptions & Promos', roles: ['Super Admin'], icon: CreditCard },
    { id: 'parameters', label: lang === 'ar' ? 'إعدادات النظام' : 'System Parameters', roles: ['Super Admin'], icon: Settings },
    { id: 'audit', label: lang === 'ar' ? 'سجل المراجعة' : 'Audit Log', roles: ['Super Admin'], icon: Lock },
  ].filter((t) => t.roles.includes(role));

  useEffect(() => {
    if (!allowedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || 'dashboard');
    }
  }, [role]);

  const handleVerificationDecision = (id: string, decision: 'approve' | 'reject' | 'block') => {
    if (decision === 'approve') {
      fetch(`/api/admin/verifications/${id}/decision`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ decision: 'approve' }),
      }).then(() => {
        showToast('Verification approved & ID images purged per Section 11.3!', 'success');
        fetchOverview();
        onRefresh();
      });
      return;
    }

    openDialog({
      code: 'CON-021',
      title: decision === 'block' ? 'Block & Ban Account (Fake ID / Underage)' : 'Reject Identity Verification',
      message: 'Enter the rejection reason (Blurry, Document expired, Name mismatch, DOB mismatch, Gender mismatch, Face mismatch, Duplicate):',
      requireInput: true,
      defaultValue: decision === 'block' ? 'Suspected fake document' : 'Blurry document',
      confirmLabel: decision === 'block' ? 'Block & Ban User' : 'Reject Verification',
      danger: true,
      onConfirm: async (reason) => {
        await fetch(`/api/admin/verifications/${id}/decision`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ decision, reason }),
        });
        showToast(`Verification ${decision}d and logged to Audit Trail`, 'info');
        fetchOverview();
        onRefresh();
      },
    });
  };

  const handleProbationDecision = (id: string, decision: 'approve' | 'reject') => {
    if (decision === 'approve') {
      fetch(`/api/admin/probation/${id}/decision`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ decision: 'approve' }),
      }).then(() => {
        showToast('Probation activity approved & published', 'success');
        fetchOverview();
        onRefresh();
      });
      return;
    }
    openDialog({
      title: 'Reject Probation Activity',
      message: 'Provide a clear reason for the organizer:',
      requireInput: true,
      defaultValue: 'Venue hours or description does not meet guidelines',
      confirmLabel: 'Reject Activity',
      danger: true,
      onConfirm: async (reason) => {
        await fetch(`/api/admin/probation/${id}/decision`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ decision: 'reject', reason }),
        });
        showToast('Probation activity rejected', 'info');
        fetchOverview();
        onRefresh();
      },
    });
  };

  const handleVenueDecision = (id: string, decision: 'approve' | 'reject' | 'deactivate') => {
    if (decision !== 'reject') {
      fetch(`/api/admin/venues/${id}/decision`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ decision }),
      }).then(() => {
        showToast(`Venue status updated (${decision})`, 'success');
        fetchOverview();
        onRefresh();
      });
      return;
    }
    openDialog({
      title: 'Reject Venue Proposal',
      message: 'Enter rejection reason for organizer:',
      requireInput: true,
      defaultValue: 'Could not verify as a staffed public venue',
      confirmLabel: 'Reject Venue',
      danger: true,
      onConfirm: async (reason) => {
        await fetch(`/api/admin/venues/${id}/decision`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ decision: 'reject', reason }),
        });
        showToast('Venue rejected', 'info');
        fetchOverview();
        onRefresh();
      },
    });
  };

  const handleCreateHobby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newHobbyMin < 3) {
      showToast('Minimum slots cannot be less than 3.', 'error');
      return;
    }
    const res = await fetch('/api/admin/hobbies', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        nameEn: newHobbyEn,
        nameAr: newHobbyAr || newHobbyEn,
        icon: newHobbyIcon,
        minSlots: newHobbyMin,
        maxSlots: newHobbyMax,
        defaultDuration: newHobbyDur,
        outdoor: true,
      }),
    });
    if (res.ok) {
      setNewHobbyEn('');
      setNewHobbyAr('');
      showToast('Hobby added to catalog!', 'success');
      onRefresh();
    }
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Title', 'Area', 'Date', 'Start', 'Slots', 'Confirmed', 'Status', 'Fee EGP'],
      ...(bootstrapData?.activities || []).map((a: any) => [
        a.id,
        `"${a.title}"`,
        a.area,
        a.date,
        a.start_time,
        a.total_slots,
        a.confirmedCount,
        a.status,
        a.fee_amount,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `squadly_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('CSV exported', 'success');
  };

  if (!adminToken || !adminUser) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <form onSubmit={handleAdminLogin} className="max-w-md w-full sq-card p-8 border border-purple-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl sq-hero-gradient flex items-center justify-center text-white font-bold">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#1A1033]">Squadly. Admin Sign In</h2>
                <p className="text-xs text-gray-500">Role-Based Access & Mandatory 2FA</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs font-bold text-[#6B2FA0] hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Member App
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50 text-[11px] text-[#2E1A6E] space-y-1">
            <div className="font-bold">Configured Admin Accounts (Section 7.2):</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: 'Super Admin', email: 'super@squadly.eg' },
                { label: 'Moderator', email: 'moderator@squadly.eg' },
                { label: 'KYC Reviewer', email: 'kyc@squadly.eg' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => setEmail(acc.email)}
                  className={`px-2.5 py-1 rounded-full font-bold transition ${
                    email === acc.email ? 'bg-[#6B2FA0] text-white' : 'bg-white text-[#6B2FA0] border border-purple-200'
                  }`}
                >
                  {acc.label} ({acc.email})
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Password (12+ characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 mb-1">6-Digit 2FA Authenticator Code</label>
            <input
              type="text"
              maxLength={6}
              value={twoFaCode}
              onChange={(e) => setTwoFaCode(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-center tracking-widest font-mono text-lg"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full sq-btn-gradient text-white font-extrabold text-sm shadow-md"
          >
            Sign In with 2FA (30m Session)
          </button>
        </form>
      </div>
    );
  }

  const pendingVerifications = (overview?.verifications || []).filter((v: any) => v.status === 'Pending');
  const activeSosAlerts = (overview?.sosAlerts || []).filter((s: any) => s.status === 'Active');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full">
      {/* Admin Top Header */}
      <div className="sq-hero-gradient rounded-3xl p-6 text-white mb-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-black tracking-tight">
              Squadly<span className="text-[#F5A524]">.</span>
            </span>
            <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#F5A524]" /> {adminUser.name} · {adminUser.role}
            </span>
          </div>
          <p className="text-white/80 text-xs mt-1">
            Database Engine: <strong>{bootstrapData?.dbEngine || 'PostgreSQL / SQLite'}</strong> · Every view of KYC documents & chat evidence is audit-logged
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onExitAdmin}
            className="bg-white/15 hover:bg-white/25 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Member App
          </button>
          <button
            onClick={() => {
              fetchOverview();
              onRefresh();
            }}
            className="bg-white/20 hover:bg-white/30 p-2.5 rounded-xl text-white transition"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleAdminLogout}
            className="bg-white text-[#2E1A6E] px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Live SOS Banner if any SOS is Active (UC-49) */}
      {activeSosAlerts.length > 0 && ['Super Admin', 'Moderator'].includes(role) && (
        <div className="bg-[#D93B3B] text-white rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 animate-pulse shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 shrink-0" />
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                LIVE SOS SAFETY ALERT ({activeSosAlerts.length}) — 5-MIN SLA TARGET (AS-05)
              </h3>
              <p className="text-xs text-white/90">
                {activeSosAlerts[0].full_name} triggered SOS at {activeSosAlerts[0].venue_name} ({activeSosAlerts[0].activity_title}) · Emergency Contact ({activeSosAlerts[0].emergency_name}: {activeSosAlerts[0].emergency_mobile}) SMS Sent!
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('safety')}
            className="bg-white text-[#D93B3B] px-4 py-2 rounded-full text-xs font-extrabold shadow"
          >
            Open SOS Response Panel →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-1.5">
          {allowedTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            let badgeCount = 0;
            if (t.id === 'verifications') badgeCount = pendingVerifications.length;
            if (t.id === 'probation') badgeCount = (overview?.probationActivities || []).length;
            if (t.id === 'safety') badgeCount = activeSosAlerts.length + (overview?.safetyFlags || []).filter((f: any) => f.status === 'Open').length;
            if (t.id === 'reports') badgeCount = (overview?.reports || []).filter((r: any) => r.status !== 'Closed').length;

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition ${
                  isActive
                    ? 'sq-btn-gradient text-white shadow-md'
                    : 'bg-white text-[#1A1033] hover:bg-purple-50 border border-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </span>
                {badgeCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                      isActive ? 'bg-white text-[#6B2FA0]' : 'bg-[#F5A524] text-[#1A1033]'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-9">
          {/* TAB 1: DASHBOARD (UC-50) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#1A1033]">Business & Safety Dashboard</h2>
                  <p className="text-xs text-gray-500">
                    {role === 'Moderator'
                      ? 'Moderator view: Safety & Moderation metrics (Revenue hidden per Section 7.2)'
                      : role === 'Verification Reviewer'
                      ? 'Verification Reviewer view: KYC SLA metrics'
                      : 'Super Admin view: Full Registration, Subscription Revenue, Fill Rate & Safety KPIs'}
                  </p>
                </div>
                {role === 'Super Admin' && (
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-2 bg-white border border-purple-200 text-[#6B2FA0] px-4 py-2 rounded-full text-xs font-bold hover:bg-purple-50"
                  >
                    <Download className="w-4 h-4" /> Export Activities CSV
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="sq-card p-4 border border-purple-100">
                  <div className="text-xs text-gray-500 font-semibold">Registered Users</div>
                  <div className="text-2xl font-black text-[#2E1A6E] mt-1">{(overview?.users || []).length}</div>
                  <div className="text-[11px] text-[#2E9E6A] font-semibold mt-1">
                    {(overview?.users || []).filter((u: any) => u.verification_status === 'Approved').length} KYC Verified
                  </div>
                </div>

                <div className="sq-card p-4 border border-purple-100">
                  <div className="text-xs text-gray-500 font-semibold">KYC Queue (48h SLA)</div>
                  <div className="text-2xl font-black text-[#6B2FA0] mt-1">{pendingVerifications.length} Pending</div>
                  <div className="text-[11px] text-gray-500 mt-1">SLA Target: &lt; 48 hrs</div>
                </div>

                {role === 'Super Admin' && (
                  <div className="sq-card p-4 border border-purple-100">
                    <div className="text-xs text-gray-500 font-semibold">Annual Membership Revenue</div>
                    <div className="text-2xl font-black text-[#2E9E6A] mt-1">
                      {(overview?.subscriptions || [])
                        .filter((s: any) => s.status === 'Active')
                        .reduce((acc: number, s: any) => acc + s.amount_egp, 0)}{' '}
                      EGP
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">250 EGP / year (VAT incl.)</div>
                  </div>
                )}

                <div className="sq-card p-4 border border-purple-100">
                  <div className="text-xs text-gray-500 font-semibold">Safety & SOS Status</div>
                  <div className="text-2xl font-black text-[#D93B3B] mt-1">
                    {activeSosAlerts.length} Active SOS
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {(overview?.safetyFlags || []).filter((f: any) => f.status === 'Open').length} Open Safety Flags
                  </div>
                </div>
              </div>

              <div className="sq-card p-5 border border-gray-100">
                <h3 className="font-bold text-sm text-[#1A1033] mb-3">Curated Hobbies & Activity Fill Rates</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(bootstrapData?.hobbies || []).map((h: any) => {
                    const count = (bootstrapData?.activities || []).filter((a: any) => a.hobby_id === h.id).length;
                    return (
                      <div key={h.id} className="p-3 rounded-2xl bg-[#FCF7F3] border border-purple-100/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{h.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-[#1A1033]">{h.name_en}</div>
                            <div className="text-[10px] text-gray-500">Min {h.min_slots}–Max {h.max_slots}</div>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-[#6B2FA0]">{count} acts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KYC IDENTITY VERIFICATION QUEUE (UC-43) */}
          {activeTab === 'verifications' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Identity Verification Queue</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Reviewer view: Verify Egyptian National ID & live liveness selfie against member profile.
                </p>
              </div>

              {(overview?.verifications || []).length === 0 ? (
                <div className="sq-card p-8 text-center text-sm text-gray-500">
                  No KYC submissions in the queue right now. Register a new account and capture a live ID + Selfie to review it here!
                </div>
              ) : (
                (overview?.verifications || []).map((v: any) => (
                  <div key={v.id} className="sq-card p-5 border border-gray-100 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-[#6B2FA0] mr-2">
                          {v.type} · {v.doc_type}
                        </span>
                        <span className="font-extrabold text-sm text-[#1A1033]">{v.full_name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({v.gender} · DOB: {v.dob} · {v.city})
                        </span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          v.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : v.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {v.status} · SLA 48h
                      </span>
                    </div>

                    {v.status === 'Pending' ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-2.5 bg-gray-50 rounded-2xl border border-gray-200">
                            <div className="text-[11px] font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-[#6B2FA0]" /> 1. ID Front ({v.doc_number_masked})
                            </div>
                            <img src={v.front_image} alt="ID Front" className="w-full h-32 object-cover rounded-xl" />
                          </div>
                          <div className="p-2.5 bg-gray-50 rounded-2xl border border-gray-200">
                            <div className="text-[11px] font-bold text-gray-600 mb-1.5">2. ID Back / Data Page</div>
                            <img src={v.back_image} alt="ID Back" className="w-full h-32 object-cover rounded-xl" />
                          </div>
                          <div className="p-2.5 bg-gray-50 rounded-2xl border border-gray-200">
                            <div className="text-[11px] font-bold text-gray-600 mb-1.5">3. Live Camera Selfie</div>
                            <img src={v.selfie_image} alt="Live Selfie" className="w-full h-32 object-cover rounded-xl" />
                          </div>
                        </div>

                        <div className="bg-purple-50/70 rounded-xl p-3 text-xs text-[#1A1033] space-y-1">
                          <div className="font-bold text-[#6B2FA0]">Reviewer Mandatory Checklist:</div>
                          <div>✓ Document genuine & not expired · ✓ Age 18+ on ID · ✓ Name, DOB & gender match profile · ✓ Live selfie matches ID & profile photo</div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          <button
                            onClick={() => handleVerificationDecision(v.id, 'approve')}
                            className="px-4 py-2 rounded-full bg-[#2E9E6A] text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve & Purge ID Images
                          </button>
                          <button
                            onClick={() => handleVerificationDecision(v.id, 'reject')}
                            className="px-4 py-2 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" /> Reject with Reason
                          </button>
                          <button
                            onClick={() => handleVerificationDecision(v.id, 'block')}
                            className="px-4 py-2 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                          >
                            Block & Ban (Underage / Fake ID)
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Reviewed at {v.reviewed_at?.slice(0, 16).replace('T', ' ')} · Document images purged per retention rule.
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: PROBATION ACTIVITY APPROVALS */}
          {activeTab === 'probation' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Probation Activity Approvals</h2>
                <p className="text-xs text-gray-500">
                  An organizer&apos;s first 3 activities require Moderator approval before publishing (SLA 24 hours).
                </p>
              </div>

              {(overview?.probationActivities || []).length === 0 ? (
                <div className="sq-card p-8 text-center text-sm text-gray-500">
                  No probation activities waiting for approval right now.
                </div>
              ) : (
                (overview?.probationActivities || []).map((a: any) => (
                  <div key={a.id} className="sq-card p-5 border border-purple-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{a.hobby_icon}</span>
                        <span className="font-extrabold text-[#1A1033] text-base">{a.title}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          Probation #{a.approved_activities_count + 1} of 3
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{a.description}</p>
                      <div className="text-xs text-gray-500">
                        Organizer: <strong>{a.organizer_name}</strong> · Venue: <strong>{a.venue_name}</strong> ({a.area}) · Date: <strong>{a.date} at {a.start_time}</strong> · Slots: {a.total_slots} (Min {a.min_to_run})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleProbationDecision(a.id, 'approve')}
                        className="px-4 py-2 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                      >
                        Approve & Publish
                      </button>
                      <button
                        onClick={() => handleProbationDecision(a.id, 'reject')}
                        className="px-4 py-2 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: SAFETY FLAGS & LIVE SOS ALERTS (UC-49) */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-red-200">
                <h2 className="text-lg font-extrabold text-[#1A1033]">SOS Alerts & Automated Safety Flags</h2>
                <p className="text-xs text-gray-500">
                  Moderators acknowledge SOS alerts within 5 minutes (05:30–23:00), call the member&apos;s mobile, and review automated safety signals.
                </p>
              </div>

              {(overview?.sosAlerts || []).map((s: any) => (
                <div
                  key={s.id}
                  className={`sq-card p-5 border-2 ${
                    s.status === 'Active' ? 'border-[#D93B3B] bg-red-50/40' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                          s.status === 'Active' ? 'bg-[#D93B3B] text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        SOS Status: {s.status}
                      </span>
                      <h3 className="font-extrabold text-sm text-[#1A1033] mt-1">
                        Member: {s.full_name} ({s.mobile}) — Activity: {s.activity_title} at {s.venue_name}
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Emergency Contact: <strong>{s.emergency_name}</strong> ({s.emergency_relation}) · Phone: <strong>{s.emergency_mobile}</strong> · Coordinates: {s.lat}, {s.lng}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${s.mobile}`}
                        className="px-3 py-2 rounded-full bg-white border border-gray-300 text-xs font-bold flex items-center gap-1"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call Member
                      </a>
                      {s.status === 'Active' && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/sos/${s.id}/acknowledge`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({
                                status: 'Acknowledged',
                                notes: 'Moderator called user and confirmed safety',
                              }),
                            });
                            showToast('SOS Alert Acknowledged & Logged', 'success');
                            fetchOverview();
                          }}
                          className="px-4 py-2 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                        >
                          Acknowledge SOS
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <h3 className="font-extrabold text-sm text-[#1A1033] pt-2">Automated Safety Flags</h3>
              {(overview?.safetyFlags || []).map((f: any) => (
                <div key={f.id} className="sq-card p-4 border border-amber-200 flex items-center justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                      {f.type}
                    </span>
                    <p className="text-xs font-semibold text-[#1A1033] mt-1">{f.description}</p>
                    <p className="text-[11px] text-gray-500">Target: {f.target_name || 'Venue / System'} · Created: {f.created_at.slice(0, 16).replace('T', ' ')}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700">{f.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: REPORTS & NO-SHOW DISPUTES (UC-45, UC-32) */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Reports & No-Show Disputes Queue</h2>
                <p className="text-xs text-gray-500">
                  Severe reports immediately suspend the reported user pending review (24h SLA).
                </p>
              </div>

              {(overview?.reports || []).map((r: any) => (
                <div key={r.id} className="sq-card p-5 border border-gray-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {r.is_severe ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#D93B3B] text-white text-[11px] font-bold">
                          SEVERE (24h SLA · Auto-Suspended)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6B2FA0] text-[11px] font-bold">
                          Standard Report
                        </span>
                      )}
                      <span className="font-extrabold text-sm text-[#1A1033]">{r.category}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-500">Status: {r.status}</span>
                  </div>
                  <p className="text-xs text-gray-700">
                    Reporter: <strong>{r.reporter_name}</strong> · Reported Target: <strong>{r.target_name || r.activity_title}</strong> ({r.target_type})
                  </p>
                  <p className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">{r.details || 'Evidence snapshot attached.'}</p>

                  {r.status !== 'Closed' ? (
                    <div className="flex flex-wrap gap-2">
                      {['Dismiss', 'Warning', 'Strike', 'Suspend 14 days', 'Mark as false report'].map((out) => (
                        <button
                          key={out}
                          onClick={() =>
                            openDialog({
                              title: `Resolve Report: ${out}`,
                              message: 'Every moderation outcome requires a written Moderator note:',
                              requireInput: true,
                              defaultValue: 'Reviewed evidence and chat logs',
                              confirmLabel: `Apply ${out}`,
                              onConfirm: async (adminNote) => {
                                await fetch(`/api/admin/reports/${r.id}/resolve`, {
                                  method: 'POST',
                                  headers: adminHeaders,
                                  body: JSON.stringify({ outcome: out, adminNote }),
                                });
                                showToast(`Report resolved with outcome: ${out}`, 'success');
                                fetchOverview();
                                onRefresh();
                              },
                            })
                          }
                          className="px-3 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#6B2FA0] text-xs font-bold transition"
                        >
                          {out}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#2E9E6A] font-semibold">
                      Outcome: {r.outcome} — Note: {r.admin_note}
                    </div>
                  )}
                </div>
              ))}

              <h3 className="font-extrabold text-sm text-[#1A1033] pt-2">No-Show Disputes (72h SLA)</h3>
              {(overview?.disputes || []).length === 0 ? (
                <div className="sq-card p-5 text-xs text-gray-500">No pending no-show disputes.</div>
              ) : (
                (overview?.disputes || []).map((d: any) => (
                  <div key={d.id} className="sq-card p-4 border border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm text-[#1A1033]">
                        {d.display_name} — {d.activity_title} ({d.activity_date})
                      </div>
                      <p className="text-xs text-gray-600">Explanation: &ldquo;{d.dispute_reason}&rdquo;</p>
                      <span className="text-[11px] text-gray-400">Status: {d.dispute_status}</span>
                    </div>
                    {d.dispute_status === 'Pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/disputes/${d.id}/resolve`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({ decision: 'Upheld' }),
                            });
                            showToast('Dispute Upheld: Strike removed & marked Attended', 'success');
                            fetchOverview();
                            onRefresh();
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                        >
                          Uphold (Remove Strike)
                        </button>
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/disputes/${d.id}/resolve`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({ decision: 'Rejected' }),
                            });
                            showToast('Dispute Rejected: Strike remains', 'info');
                            fetchOverview();
                            onRefresh();
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: MANAGE USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1A1033]">Manage Users</h2>
                  <p className="text-xs text-gray-500">Search by name, mobile, email or ID.</p>
                </div>
                <input
                  type="text"
                  placeholder="Search name, mobile, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-xs w-64"
                />
              </div>

              {(overview?.users || [])
                .filter((u: any) =>
                  `${u.full_name} ${u.mobile} ${u.email} ${u.id}`.toLowerCase().includes(userSearch.toLowerCase())
                )
                .map((u: any) => (
                  <div key={u.id} className="sq-card p-4 border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={u.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'}
                        alt={u.display_name}
                        className="w-11 h-11 rounded-full object-cover border border-purple-200"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#1A1033]">{u.full_name || u.mobile}</span>
                          <span className="text-xs text-gray-500">({u.display_name})</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.account_status === 'Verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.account_status === 'Suspended'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {u.account_status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Mobile: {u.mobile} · Sub: <strong>{u.subscription_status}</strong> · Strikes: <strong>{u.participant_strikes}P / {u.organizer_strikes}O</strong> · Probation: {u.probation_ended ? 'Graduated' : `${u.approved_activities_count}/3`}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {u.account_status !== 'Suspended' ? (
                        <button
                          onClick={() =>
                            openDialog({
                              code: 'CON-020',
                              title: `Suspend ${u.display_name} for 14 days?`,
                              message: 'Reason is required and recorded in the Audit Log:',
                              requireInput: true,
                              defaultValue: 'Community guidelines violation',
                              confirmLabel: 'Suspend User',
                              danger: true,
                              onConfirm: async (reason) => {
                                await fetch(`/api/admin/users/${u.id}/action`, {
                                  method: 'POST',
                                  headers: adminHeaders,
                                  body: JSON.stringify({ action: 'suspend', reason }),
                                });
                                showToast(`Suspended ${u.display_name}`, 'info');
                                fetchOverview();
                                onRefresh();
                              },
                            })
                          }
                          className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold"
                        >
                          Suspend 14d
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/users/${u.id}/action`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({ action: 'lift', reason: 'Admin lifted suspension' }),
                            });
                            showToast(`Lifted suspension for ${u.display_name}`, 'success');
                            fetchOverview();
                            onRefresh();
                          }}
                          className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold"
                        >
                          Lift Suspension
                        </button>
                      )}

                      {role === 'Super Admin' && !u.probation_ended && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/users/${u.id}/action`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({ action: 'end_probation', reason: 'Trusted organizer' }),
                            });
                            showToast(`Ended probation for ${u.display_name}`, 'success');
                            fetchOverview();
                            onRefresh();
                          }}
                          className="px-3 py-1.5 rounded-full bg-purple-100 text-[#6B2FA0] text-xs font-bold"
                        >
                          End Probation
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* TAB 7: MANAGE ACTIVITIES */}
          {activeTab === 'activities' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Oversee Activities</h2>
                <p className="text-xs text-gray-500">
                  Admins do not edit user activities; they can cancel an activity for Force Majeure or Policy Violation.
                </p>
              </div>
              {(bootstrapData?.activities || []).map((a: any) => (
                <div key={a.id} className="sq-card p-4 border border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{a.hobby?.icon}</span>
                      <span className="font-bold text-sm text-[#1A1033]">{a.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#6B2FA0] text-[10px] font-bold">
                        {a.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {a.area} · {a.date} {a.start_time} · {a.confirmedCount}/{a.total_slots} ({a.genderSplit}) · {a.gender_type}
                    </div>
                  </div>
                  {a.status !== 'Cancelled' && a.status !== 'Completed' && (
                    <button
                      onClick={() =>
                        openDialog({
                          code: 'CON-022',
                          title: `Cancel ${a.title}?`,
                          message: 'Specify Force Majeure (weather — no strikes) or Policy Violation:',
                          requireInput: true,
                          defaultValue: 'Force majeure: weather alert',
                          confirmLabel: 'Cancel Activity',
                          danger: true,
                          onConfirm: async (reason) => {
                            await fetch(`/api/activities/${a.id}/cancel`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({ reason: `Admin cancelled: ${reason}` }),
                            });
                            showToast('Activity cancelled & participants notified', 'info');
                            onRefresh();
                          },
                        })
                      }
                      className="px-3.5 py-1.5 rounded-full bg-red-50 text-[#D93B3B] text-xs font-bold hover:bg-red-100"
                    >
                      Cancel Activity
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 8: MANAGE VENUES */}
          {activeTab === 'venues' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Vetted Public Venues & Organizer Proposals</h2>
                <p className="text-xs text-gray-500">
                  Activities can only take place at approved public venues. Private homes are never allowed.
                </p>
              </div>
              {(bootstrapData?.venues || []).map((v: any) => (
                <div key={v.id} className="sq-card p-4 border border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#1A1033]">{v.name_en}</span>
                      <span className="text-xs text-gray-400">({v.name_ar})</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          v.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {v.area} · {v.venue_type} · {v.address} · Public Place Confirmed: Yes
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {v.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => handleVenueDecision(v.id, 'approve')}
                          className="px-3.5 py-1.5 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                        >
                          Approve Proposal
                        </button>
                        <button
                          onClick={() => handleVenueDecision(v.id, 'reject')}
                          className="px-3.5 py-1.5 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {v.status === 'Approved' && (
                      <button
                        onClick={() => handleVenueDecision(v.id, 'deactivate')}
                        className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 9: MANAGE HOBBIES */}
          {activeTab === 'hobbies' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateHobby} className="sq-card p-5 border border-purple-100 space-y-3">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Manage Hobby Catalog</h2>
                <p className="text-xs text-gray-500">No hobby can have a minimum below 3 players.</p>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <input
                    type="text"
                    placeholder="English Name"
                    value={newHobbyEn}
                    onChange={(e) => setNewHobbyEn(e.target.value)}
                    required
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Arabic Name (الاسم بالعربية)"
                    value={newHobbyAr}
                    onChange={(e) => setNewHobbyAr(e.target.value)}
                    required
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Emoji"
                    value={newHobbyIcon}
                    onChange={(e) => setNewHobbyIcon(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-center"
                  />
                  <input
                    type="number"
                    min={3}
                    max={50}
                    value={newHobbyMin}
                    onChange={(e) => setNewHobbyMin(Number(e.target.value))}
                    title="Min Slots (>=3)"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs"
                  />
                </div>
                <button type="submit" className="px-4 py-2 rounded-full sq-btn-gradient text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add Curated Hobby
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(bootstrapData?.hobbies || []).map((h: any) => (
                  <div key={h.id} className="sq-card p-4 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{h.icon}</span>
                      <div>
                        <div className="font-extrabold text-sm text-[#1A1033]">
                          {h.name_en} · {h.name_ar}
                        </div>
                        <div className="text-xs text-gray-500">
                          Slots: {h.min_slots}–{h.max_slots} · Default: {h.default_duration}m · {h.status}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/hobbies/${h.id}/toggle`, {
                          method: 'POST',
                          headers: adminHeaders,
                        });
                        onRefresh();
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        h.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {h.status}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: SUBSCRIPTIONS, REFUNDS & PROMO CODES */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Subscriptions, Refunds & Promo Codes</h2>
                <p className="text-xs text-gray-500">
                  A subscription is refundable only within 14 days of purchase and only if the user attended 0 activities in that period.
                </p>
              </div>

              {(overview?.subscriptions || []).map((s: any) => (
                <div key={s.id} className="sq-card p-4 border border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-sm text-[#1A1033]">
                      {s.full_name} ({s.mobile}) — {s.amount_egp} EGP
                    </div>
                    <div className="text-xs text-gray-500">
                      Started: {s.started_at} · Ends: {s.ends_at} · Status: <strong>{s.status}</strong> · Promo: {s.promo_code || 'None'}
                    </div>
                  </div>
                  {s.refund_requested === 1 && (
                    <button
                      onClick={() =>
                        openDialog({
                          code: 'CON-023',
                          title: `Refund ${s.amount_egp} EGP to ${s.display_name}?`,
                          message: 'User is within 14 days of purchase with 0 attended activities.',
                          confirmLabel: 'Approve Refund',
                          onConfirm: async () => {
                            await fetch(`/api/admin/subscriptions/${s.id}/refund`, {
                              method: 'POST',
                              headers: adminHeaders,
                              body: JSON.stringify({ decision: 'approve' }),
                            });
                            showToast(`Refunded ${s.amount_egp} EGP`, 'success');
                            fetchOverview();
                            onRefresh();
                          },
                        })
                      }
                      className="px-3.5 py-1.5 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                    >
                      Approve Refund
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 11: SYSTEM PARAMETERS */}
          {activeTab === 'parameters' && (
            <div className="space-y-4">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Configurable System Parameters</h2>
                <p className="text-xs text-gray-500">
                  Changes apply immediately without a new app release and are recorded in the Audit Log.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(bootstrapData?.systemParameters || []).map((p: any) => (
                  <div key={p.key} className="sq-card p-4 border border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#6B2FA0]">{p.category}</span>
                      <div className="text-xs font-bold text-[#1A1033]">{lang === 'ar' ? p.label_ar : p.label_en}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{p.key}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-purple-50 font-extrabold text-xs text-[#2E1A6E]">
                        {p.value}
                      </span>
                      {p.key !== 'min_people_per_activity' && (
                        <button
                          onClick={() =>
                            openDialog({
                              title: `Update ${p.label_en}`,
                              message: 'Parameter changes take effect immediately and are audit-logged:',
                              requireInput: true,
                              defaultValue: p.value,
                              confirmLabel: 'Save Parameter',
                              onConfirm: async (nextVal) => {
                                await fetch(`/api/admin/parameters/${p.key}`, {
                                  method: 'POST',
                                  headers: adminHeaders,
                                  body: JSON.stringify({ value: nextVal }),
                                });
                                showToast(`Parameter ${p.key} updated to ${nextVal}`, 'success');
                                onRefresh();
                                fetchOverview();
                              },
                            })
                          }
                          className="text-xs text-[#A42A9B] font-bold hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 12: IMMUTABLE AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="sq-card p-5 border border-purple-100">
                <h2 className="text-lg font-extrabold text-[#1A1033]">Immutable Admin Audit Log</h2>
                <p className="text-xs text-gray-500">
                  Retained 2 years. Entries cannot be edited or deleted. Records every admin sign-in, parameter update, KYC view, and moderation outcome.
                </p>
              </div>
              {(overview?.auditLogs || []).map((log: any) => (
                <div key={log.id} className="sq-card p-4 border border-gray-100 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-[#6B2FA0] mr-2">[{log.action}]</span>
                    <span className="font-bold text-[#1A1033]">{log.admin_name}</span>
                    <span className="text-gray-500 ml-1">({log.admin_role})</span>
                    <div className="text-gray-600 mt-1">
                      Target: <strong>{log.target_type} ({log.target_id})</strong> · {log.before_val ? `${log.before_val} → ` : ''}{log.after_val} · Reason: <em>{log.reason}</em>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">{log.created_at.slice(0, 19).replace('T', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

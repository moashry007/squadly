import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass, PlusCircle, MessageSquare, User, Bell, ShieldAlert, CheckCircle2,
  MapPin, Calendar, Star, Search, Lock, Sparkles, ShieldCheck, AlertTriangle,
  LogOut, Globe, Phone, Mail, Camera, Trash2, Edit3, CreditCard, Gift, Navigation,
  Smartphone, Users, X, Moon, Sun
} from 'lucide-react';
import { tMsg, Lang } from './i18n/messages';
import { ActivityDetailModal } from './components/ActivityModals';
import { AdminPanel } from './components/AdminPanel';
import { CameraCaptureModal, ActionDialogModal, DialogConfig } from './components/HardwareModals';
import { supabase, signOutOfSupabase } from './lib/supabase';
import { ProtectedRoute, AdminProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('squadly_lang') as Lang) || 'en');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('squadly_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });
  const [routeMode, setRouteMode] = useState<'member' | 'admin'>(() =>
    window.location.pathname.startsWith('/admin') || window.location.hash === '#admin' ? 'admin' : 'member'
  );
  const [memberToken, setMemberToken] = useState<string>(() => localStorage.getItem('squadly_member_token') || '');

  // Auth / Onboarding state
  const [authStep, setAuthStep] = useState<'splash' | 'phone' | 'otp' | 'profile_wizard' | 'kyc_wizard' | 'subscribe' | 'authenticated'>('splash');
  const [phoneInput, setPhoneInput] = useState('01055551234');
  const [otpInput, setOtpInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [smsGatewayBanner, setSmsGatewayBanner] = useState<{ phone: string; code: string; expiresIn: number } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Current Member & Bootstrap Data
  const [bootstrapData, setBootstrapData] = useState<any>({});
  const [user, setUser] = useState<any>(null);
  const [hobbies, setHobbies] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [activities, setActivities] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'active' | 'denied'>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Navigation Tabs inside Member App
  const [memberTab, setMemberTab] = useState<'discover' | 'my_squads' | 'notifications' | 'profile'>('discover');

  // Filters (UC-13, UC-14, UC-15, UC-16, UC-17)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHobby, setFilterHobby] = useState('');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'weekend' | 'week'>('all');
  const [filterMaxFee, setFilterMaxFee] = useState<string>('');
  const [filterHasSpots, setFilterHasSpots] = useState(false);

  // Modals
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Create Activity Form (UC-22)
  const [createForm, setCreateForm] = useState({
    hobbyId: 'hob-padel',
    title: '',
    description: '',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startTime: '18:00',
    duration: 90,
    venueId: 'ven-1',
    totalSlots: 4,
    minToRun: 3,
    confirmationDeadlineHours: 6,
    genderType: 'Mixed',
    skillLevel: 'All levels',
    joinMode: 'Instant',
    feeRequired: true,
    feeAmount: 150,
    feeCovers: 'Court booking & balls'
  });

  // Camera & Dialog Modals
  const [cameraTarget, setCameraTarget] = useState<null | 'avatar' | 'kyc_front' | 'kyc_back' | 'kyc_selfie'>(null);
  const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);

  // Profile Wizard state (UC-04)
  const [profForm, setProfForm] = useState({
    fullName: '',
    dob: '1997-04-15',
    gender: 'Female',
    city: 'Cairo',
    area: 'Sheikh Zayed',
    email: 'member@squadly.eg',
    profilePhoto: '',
    emergencyName: 'Nadia Mostafa',
    emergencyMobile: '01099887766',
    emergencyRelation: 'Parent',
    interests: [] as { hobbyId: string; skillLevel: string }[]
  });

  // KYC state (UC-06)
  const [kycStep, setKycStep] = useState<1 | 2 | 3>(1);
  const [kycDocNumber, setKycDocNumber] = useState('29704150109911');
  const [kycFrontPhoto, setKycFrontPhoto] = useState<string>('');
  const [kycBackPhoto, setKycBackPhoto] = useState<string>('');
  const [kycSelfiePhoto, setKycSelfiePhoto] = useState<string>('');

  // Subscription & Card Checkout state (UC-07)
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8891');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('842');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'meeza'>('card');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'ar' : 'en';
    setLang(next);
    localStorage.setItem('squadly_lang', next);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('squadly_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const fetchBootstrap = useCallback(async (tokenOverride?: string) => {
    const activeToken = tokenOverride !== undefined ? tokenOverride : memberToken;
    try {
      const headers: Record<string, string> = {};
      if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;
      const q = new URLSearchParams();
      if (userCoords) {
        q.set('lat', String(userCoords.lat));
        q.set('lng', String(userCoords.lng));
      }
      const res = await fetch(`/api/bootstrap?${q.toString()}`, { headers });
      const data = await res.json();
      setBootstrapData(data);
      setHobbies(data.hobbies || []);
      setVenues(data.venues || []);

      const paramMap: Record<string, string> = {};
      (data.systemParameters || []).forEach((p: any) => {
        paramMap[p.key] = p.value;
      });
      setParams(paramMap);

      const cu = data.currentUser || null;
      setUser(cu);
      setActivities(data.activities || []);
      setNotifications(data.notifications || []);
      setBlocks(data.myBlocks || []);

      if (cu) {
        setProfForm({
          fullName: cu.full_name || '',
          dob: cu.dob || '1997-04-15',
          gender: cu.gender || 'Female',
          city: cu.city || 'Cairo',
          area: cu.area || 'Sheikh Zayed',
          email: cu.email || '',
          profilePhoto: cu.profile_photo || '',
          emergencyName: cu.emergency_name || '',
          emergencyMobile: cu.emergency_mobile || '',
          emergencyRelation: cu.emergency_relation || 'Parent',
          interests: Array.isArray(cu.interests) ? cu.interests : []
        });
        setCardHolder(cu.full_name || '');
        if (!cu.full_name) {
          setAuthStep('profile_wizard');
        } else {
          setAuthStep('authenticated');
        }
      } else if (activeToken) {
        localStorage.removeItem('squadly_member_token');
        setMemberToken('');
        setAuthStep('phone');
      }
    } catch (e) {
      console.error('Bootstrap error', e);
    }
  }, [memberToken, userCoords]);

  useEffect(() => {
    fetchBootstrap();

    // Listen to Supabase Auth State changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('squadly_member_token');
        setMemberToken('');
        setUser(null);
        setAuthStep('splash');
      } else if (session?.user && !memberToken) {
        // If Supabase has an active session but local app token is unset
        fetchBootstrap();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchBootstrap, memberToken]);

  // Real Browser GPS Sync (UC-13)
  const syncBrowserLocation = useCallback(() => {
    if (!navigator.geolocation || !memberToken) return;
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsStatus('active');
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          await fetch('/api/profile/location', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${memberToken}`
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            })
          });
          fetchBootstrap();
        } catch {
          // ignore
        }
      },
      () => {
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [memberToken, fetchBootstrap]);

  // Client-side Activity Filtering (UC-13..16)
  const filteredActivities = activities.filter((act) => {
    if (filterHobby && act.hobby_id !== filterHobby) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = act.title?.toLowerCase().includes(q);
      const matchArea = act.area?.toLowerCase().includes(q);
      const matchHobby = act.hobby?.name_en?.toLowerCase().includes(q) || act.hobby?.name_ar?.includes(q);
      if (!matchTitle && !matchArea && !matchHobby) return false;
    }
    if (filterMaxFee !== '') {
      if (Number(act.fee_amount || 0) > Number(filterMaxFee)) return false;
    }
    if (filterHasSpots) {
      if ((act.confirmedCount || 0) >= (act.total_slots || 4)) return false;
    }
    if (filterDate !== 'all') {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (filterDate === 'today' && act.date !== todayStr) return false;
    }
    return true;
  });

  const selectedActivity = selectedActivityId
    ? activities.find((a) => a.id === selectedActivityId) || null
    : null;

  // Auth Handlers (UC-01, UC-02, UC-03)
  const normalizeEgyptianMobile = (raw: string) => {
    const clean = raw.replace(/\s+/g, '');
    if (clean.startsWith('+20')) return '0' + clean.slice(3);
    return clean;
  };

  const handleSendOtp = async () => {
    if (isSendingOtp) return;
    setIsSendingOtp(true);
    try {
      const mobile = normalizeEgyptianMobile(phoneInput);
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, mode: isRegisterMode ? 'register' : 'login' })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(tMsg(data.code || 'ERR-001', lang), 'error');
        return;
      }
      setResendCooldown(60);
      if (data.otpGenerated) {
        setOtpInput(data.otpGenerated);
        setSmsGatewayBanner({
          phone: `+20${mobile.slice(1)}`,
          code: data.otpGenerated,
          expiresIn: 300
        });
      }
      showToast(tMsg(data.code || 'INF-002', lang), 'success');
      setAuthStep('otp');
    } catch (err: any) {
      console.error('[Squadly] Send OTP error', err);
      showToast(
        lang === 'ar'
          ? 'تعذر الاتصال بالخادم. يرجى التأكد من تشغيل السيرفر.'
          : 'Could not connect to server. Ensure backend is running.',
        'error'
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isVerifyingOtp) return;
    setIsVerifyingOtp(true);
    try {
      const mobile = normalizeEgyptianMobile(phoneInput);
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          otp: otpInput,
          mode: isRegisterMode ? 'register' : 'login'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(tMsg(data.code || 'ERR-002', lang), 'error');
        return;
      }
      setSmsGatewayBanner(null);
      localStorage.setItem('squadly_member_token', data.token);
      setMemberToken(data.token);
      await fetchBootstrap(data.token);
      showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Signed in with verified session!', 'success');
    } catch (err: any) {
      console.error('[Squadly] Verify OTP error', err);
      showToast(
        lang === 'ar'
          ? 'تعذر التحقق من الرمز بسبب مشكلة في الاتصال.'
          : 'Connection error while verifying OTP.',
        'error'
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSaveProfile = async () => {
    const res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify(profForm)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(tMsg(data.code || 'ERR-007', lang), 'error');
      return;
    }
    showToast(tMsg(data.infoCode || 'INF-034', lang), 'success');
    await fetchBootstrap();
    setAuthStep('authenticated');
  };

  const handleSubmitKyc = async () => {
    if (!kycFrontPhoto || !kycBackPhoto || !kycSelfiePhoto) {
      showToast(lang === 'ar' ? 'يرجى التقاط صور البطاقة (الأمامية والخلفية) وصورة السيلفي المباشرة أولاً.' : 'Please capture ID Front, ID Back, and Live Selfie before submitting.', 'error');
      return;
    }
    const res = await fetch('/api/verification/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        docType: 'National ID',
        docNumber: kycDocNumber,
        frontImage: kycFrontPhoto,
        backImage: kycBackPhoto,
        selfieImage: kycSelfiePhoto
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(tMsg(data.code || 'ERR-010', lang), 'error');
      return;
    }
    showToast(tMsg(data.code || 'INF-003', lang), 'success');
    await fetchBootstrap();
    setAuthStep('authenticated');
  };

  const handleSubscribe = async () => {
    if (paymentMethod === 'card' && (!cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim())) {
      showToast(lang === 'ar' ? 'يرجى إدخال بيانات البطاقة البنكية.' : 'Please complete your card payment details.', 'error');
      return;
    }
    const res = await fetch('/api/subscription/pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        promoCode: promoCodeInput || undefined,
        paymentMethod: paymentMethod === 'card' ? `Visa/MC *${cardNumber.slice(-4)}` : paymentMethod.toUpperCase(),
        cardLast4: cardNumber.slice(-4)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(tMsg(data.code || 'ERR-015', lang), 'error');
      return;
    }
    showToast(tMsg(data.code || 'INF-005', lang), 'success');
    await fetchBootstrap();
    setAuthStep('authenticated');
  };

  const handleCreateActivity = async () => {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify(createForm)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(tMsg(data.code || 'ERR-026', lang), 'error');
      return;
    }
    showToast(tMsg(data.code || 'INF-012', lang), 'success');
    setShowCreateModal(false);
    fetchBootstrap();
  };

  const handleTriggerSos = async () => {
    let lat = user?.lat || 30.0195;
    let lng = user?.lng || 31.0023;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // fallback to last known coordinates
      }
    }
    const activeAct = activities.find(a => a.viewerParticipation?.status === 'Confirmed') || activities[0];
    const res = await fetch('/api/sos/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        activityId: activeAct?.id || null,
        lat,
        lng
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(tMsg(data.code || 'INF-028', lang), 'info');
      setShowSosModal(false);
    } else {
      showToast(tMsg(data.code || 'ERR-001', lang), 'error');
    }
  };

  const handleLogout = async () => {
    if (memberToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${memberToken}` }
      }).catch(() => {});
    }
    await signOutOfSupabase().catch(() => {});
    localStorage.removeItem('squadly_member_token');
    setMemberToken('');
    setUser(null);
    setAuthStep('splash');
    showToast(lang === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully', 'info');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const switchRoute = (mode: 'member' | 'admin') => {
    setRouteMode(mode);
    window.history.pushState({}, '', mode === 'admin' ? '/admin' : '/');
  };

  if (routeMode === 'admin') {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#FCF7F3] text-[#1A1033] flex flex-col">
        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 bg-[#1A1033] text-white border-white/15">
            <span className="text-xs font-bold flex-1">{toast.msg}</span>
          </div>
        )}
        <AdminProtectedRoute
          isAdminAuthenticated={Boolean(localStorage.getItem('squadly_admin_token'))}
          fallback={
            <AdminPanel
              lang={lang}
              bootstrapData={bootstrapData}
              onRefresh={() => fetchBootstrap()}
              showToast={showToast}
              openDialog={(cfg) => setDialogConfig(cfg)}
              onExitAdmin={() => switchRoute('member')}
            />
          }
        >
          <AdminPanel
            lang={lang}
            bootstrapData={bootstrapData}
            onRefresh={() => fetchBootstrap()}
            showToast={showToast}
            openDialog={(cfg) => setDialogConfig(cfg)}
            onExitAdmin={() => switchRoute('member')}
          />
        </AdminProtectedRoute>
        <ActionDialogModal dialog={dialogConfig} onClose={() => setDialogConfig(null)} />
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#FCF7F3] text-[#1A1033] flex flex-col">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 transition-all ${
          toast.type === 'error' ? 'bg-[#D93B3B] text-white border-red-400' :
          toast.type === 'success' ? 'bg-[#2E9E6A] text-white border-emerald-400' :
          'bg-[#2E1A6E] text-white border-purple-400'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> :
           toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> :
           <Sparkles className="w-5 h-5 shrink-0 text-[#F5A524]" />}
          <span className="text-xs font-bold leading-snug flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-xs opacity-75 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      {/* SMS Gateway Push Notification Banner (when OTP is dispatched) */}
      {smsGatewayBanner && authStep === 'otp' && (
        <div className="fixed top-4 right-4 z-[90] bg-[#1A1033] text-white p-4 rounded-2xl shadow-2xl border border-[#F5A524]/40 max-w-xs">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F5A524] flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" /> SMS Gateway Dispatch
            </span>
            <button onClick={() => setSmsGatewayBanner(null)} className="text-white/50 hover:text-white text-xs">✕</button>
          </div>
          <p className="text-xs text-white/80">
            To <span className="font-mono font-bold text-white">{smsGatewayBanner.phone}</span>: Your Squadly verification code is{' '}
            <span className="font-mono font-extrabold text-sm text-[#F5A524] underline">{smsGatewayBanner.code}</span>
          </p>
          <p className="text-[10px] text-white/50 mt-1">Valid for 5 minutes • Single-use HMAC hash stored</p>
        </div>
      )}

      {/* Responsive Web & Mobile App Container */}
      <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto bg-[#FCF7F3] min-h-screen shadow-sm border-x border-purple-900/5 relative">
        {/* SPLASH / ONBOARDING SCREEN (UC-01 / UC-02) */}
        {authStep === 'splash' && (
          <div
            style={{ background: 'linear-gradient(135deg, #2E1A6E 0%, #6B2FA0 48%, #A42A9B 82%, #C4407A 100%)' }}
            className="flex-1 bg-[#2E1A6E] squadly-gradient text-white p-6 md:p-12 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#F5A524]/20 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-extrabold text-xl border border-white/30 text-white shadow">
                  S<span className="text-[#F5A524]">.</span>
                </div>
                <span className="font-extrabold text-xl tracking-tight text-white drop-shadow-sm">
                  Squadly<span className="text-[#F5A524]">.</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLang}
                  className="px-3.5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-extrabold flex items-center gap-1.5 border border-white/25 backdrop-blur cursor-pointer shadow-sm"
                >
                  <Globe className="w-3.5 h-3.5 text-[#F5A524]" /> {lang === 'en' ? 'العربية' : 'English'}
                </button>
              </div>
            </div>

            <div className="my-auto py-10 z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1A1033]/50 text-[#F5A524] text-xs font-extrabold uppercase tracking-wider mb-5 border border-[#F5A524]/40 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" /> {lang === 'ar' ? 'مجتمع الهوايات الموثق في مصر' : "Egypt's Verified Hobby Community"}
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4 text-white drop-shadow-sm">
                {lang === 'ar' ? 'ابحث عن مجموعتك. عش شغفك بأمان.' : 'Find Your Squad. Share Your Passion Safely.'}
              </h1>
              <p className="text-sm md:text-base text-white/95 font-medium leading-relaxed mb-8">
                {lang === 'ar'
                  ? 'انضم إلى أنشطة جماعية حقيقية من البادل والجري إلى الألعاب اللوحية — جميع الأعضاء موثقون بالبطاقة الشخصية والسيلفي المباشر.'
                  : 'Discover curated small-group activities across Greater Cairo from Padel & Running to Strategy Board Games — every organizer and participant is KYC ID & Live-Selfie verified.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-[#1A1033]/45 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-md">
                  <ShieldCheck className="w-6 h-6 text-[#F5A524] mb-1.5" />
                  <p className="text-sm font-extrabold text-white">{lang === 'ar' ? 'توثيق الهوية' : '100% KYC Verified'}</p>
                  <p className="text-xs text-white/90 mt-0.5">{lang === 'ar' ? 'بطاقة شخصية + سيلفي حي' : 'National ID + Live Selfie'}</p>
                </div>
                <div className="bg-[#1A1033]/45 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-md">
                  <Users className="w-6 h-6 text-[#F5A524] mb-1.5" />
                  <p className="text-sm font-extrabold text-white">{lang === 'ar' ? 'مجموعات متوازنة' : 'Small Squads'}</p>
                  <p className="text-xs text-white/90 mt-0.5">{lang === 'ar' ? 'تقييم متبادل وحضور بـ QR' : 'Dynamic QR & Mutual Rating'}</p>
                </div>
                <div className="bg-[#1A1033]/45 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-md">
                  <ShieldAlert className="w-6 h-6 text-[#F5A524] mb-1.5" />
                  <p className="text-sm font-extrabold text-white">{lang === 'ar' ? 'طوارئ SOS' : 'Live SOS Shield'}</p>
                  <p className="text-xs text-white/90 mt-0.5">{lang === 'ar' ? 'حماية فورية طوال النشاط' : '6am–10pm Verified Venues'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 z-10 max-w-md w-full mx-auto">
              <button
                onClick={() => { setIsRegisterMode(true); setAuthStep('phone'); }}
                className="w-full py-4 rounded-2xl bg-[#F5A524] hover:bg-[#e0941b] text-[#1A1033] font-extrabold text-sm shadow-xl transition cursor-pointer"
              >
                {lang === 'ar' ? 'إنشاء حساب جديد (+18)' : 'Create New Account (18+)'}
              </button>
              <button
                onClick={() => { setIsRegisterMode(false); setAuthStep('phone'); }}
                className="w-full py-3.5 rounded-2xl bg-[#1A1033]/60 hover:bg-[#1A1033]/85 text-white font-extrabold text-sm border border-white/35 transition cursor-pointer shadow-lg"
              >
                {lang === 'ar' ? 'تسجيل الدخول برقم الموبايل' : 'Sign In with Egyptian Mobile'}
              </button>
            </div>
          </div>
        )}

        {/* PHONE INPUT SCREEN (UC-01 / UC-02) */}
        {authStep === 'phone' && (
          <div className="flex-1 p-6 md:p-12 flex flex-col justify-between max-w-lg mx-auto w-full">
            <div>
              <button onClick={() => setAuthStep('splash')} className="text-xs font-bold text-[#6B2FA0] mb-6 flex items-center gap-1 cursor-pointer">
                ← {lang === 'ar' ? 'رجوع' : 'Back'}
              </button>
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#2E1A6E] flex items-center justify-center mb-4">
                <Phone className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#1A1033] mb-1">
                {isRegisterMode
                  ? (lang === 'ar' ? 'التسجيل برقم الموبايل' : 'Register with Mobile Number')
                  : (lang === 'ar' ? 'تسجيل الدخول' : 'Welcome Back to Squadly.')}
              </h2>
              <p className="text-xs text-gray-500 mb-6">
                {lang === 'ar'
                  ? 'أدخل رقم هاتفك المصري لإرسال رمز التحقق المكون من 6 أرقام.'
                  : 'Enter your Egyptian mobile number (010 / 011 / 012 / 015) to receive a real 6-digit OTP code.'}
              </p>

              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                {lang === 'ar' ? 'رقم الهاتف المحمول' : 'Egyptian Mobile Number'}
              </label>
              <input
                type="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="01055551234"
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 bg-white font-mono text-base font-bold focus:outline-none focus:border-[#6B2FA0]"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                {lang === 'ar' ? 'الصيغة المدعومة: 010 / 011 / 012 / 015 (11 رقماً)' : 'Format: 010XXXXXXXX, 011XXXXXXXX, 012XXXXXXXX, or 015XXXXXXXX'}
              </p>

              {/* Seeded Database Accounts Quick-Fill */}
              <div className="mt-5 p-3.5 rounded-2xl bg-purple-50/80 border border-purple-100">
                <p className="text-[11px] font-bold text-[#2E1A6E] mb-2">
                  {lang === 'ar' ? 'حسابات مسجلة في قاعدة البيانات:' : 'Seeded Verified Accounts (Click to autofill mobile):'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => { setPhoneInput('01055551234'); setIsRegisterMode(false); }}
                    className="text-left px-2.5 py-2 rounded-xl bg-white hover:bg-purple-100 border border-purple-200 font-semibold truncate cursor-pointer"
                  >
                    🌟 Yara M. (01055551234)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhoneInput('01122334455'); setIsRegisterMode(false); }}
                    className="text-left px-2.5 py-2 rounded-xl bg-white hover:bg-purple-100 border border-purple-200 font-semibold truncate cursor-pointer"
                  >
                    🎾 Omar H. (01122334455)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhoneInput('01288776655'); setIsRegisterMode(false); }}
                    className="text-left px-2.5 py-2 rounded-xl bg-white hover:bg-purple-100 border border-purple-200 font-semibold truncate cursor-pointer"
                  >
                    🥾 Layla M. (01288776655)
                  </button>
                </div>
              </div>

              {isRegisterMode && (
                <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-1 rounded text-[#2E1A6E]"
                  />
                  <span className="text-xs text-gray-600 leading-snug">
                    {lang === 'ar'
                      ? 'أوافق على شروط الاستخدام وسياسة الخصوصية وأقر بأن عمري 18 عاماً أو أكثر.'
                      : 'I accept the Squadly Terms of Service & Privacy Policy and confirm I am 18+ years old.'}
                  </span>
                </label>
              )}
            </div>

            <button
              onClick={handleSendOtp}
              disabled={isSendingOtp}
              className="w-full py-4 rounded-2xl bg-[#2E1A6E] hover:bg-[#3d2490] active:scale-[0.98] text-white font-extrabold text-sm shadow-lg transition cursor-pointer mt-6 mb-4 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSendingOtp ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{lang === 'ar' ? 'جاري الإرسال...' : 'Sending OTP...'}</span>
                </>
              ) : (
                <span>{lang === 'ar' ? 'إرسال رمز التحقق (OTP)' : 'Send 6-Digit Verification OTP'}</span>
              )}
            </button>
          </div>
        )}

        {/* OTP VERIFICATION SCREEN (UC-01 / UC-02 / UC-03) */}
        {authStep === 'otp' && (
          <div className="flex-1 p-6 md:p-12 flex flex-col justify-between max-w-lg mx-auto w-full">
            <div>
              <button onClick={() => setAuthStep('phone')} className="text-xs font-bold text-[#6B2FA0] mb-6 cursor-pointer">
                ← {lang === 'ar' ? 'تعديل الرقم' : 'Change Number'}
              </button>
              <h2 className="text-2xl font-extrabold text-[#1A1033] mb-1">
                {lang === 'ar' ? 'تأكيد رمز التحقق' : 'Verify 6-Digit OTP'}
              </h2>
              <p className="text-xs text-gray-500 mb-6">
                {lang === 'ar'
                  ? `تم إرسال رمز التحقق إلى ${phoneInput}. الرمز صالح لمدة 5 دقائق.`
                  : `Enter the 6-digit code dispatched to ${phoneInput}. Expires in 5 minutes (Max 5 attempts).`}
              </p>

              <input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={e => setOtpInput(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-4 rounded-2xl border-2 border-[#6B2FA0] bg-white text-center font-mono text-2xl tracking-[0.5em] font-extrabold mb-3"
              />

              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-gray-500">
                  {resendCooldown > 0
                    ? (lang === 'ar' ? `إعادة الإرسال متاحة خلال ${resendCooldown} ثانية` : `Resend available in ${resendCooldown}s`)
                    : (lang === 'ar' ? 'لم يصلك الرمز؟' : "Didn't receive the code?")}
                </span>
                <button
                  disabled={resendCooldown > 0 || isSendingOtp}
                  onClick={handleSendOtp}
                  className="font-extrabold text-[#6B2FA0] disabled:opacity-40 cursor-pointer"
                >
                  {lang === 'ar' ? 'إعادة إرسال الرمز' : 'Resend OTP'}
                </button>
              </div>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp}
              className="w-full py-4 rounded-2xl bg-[#2E1A6E] hover:bg-[#3d2490] active:scale-[0.98] text-white font-extrabold text-sm shadow-lg transition cursor-pointer mb-4 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifyingOtp ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{lang === 'ar' ? 'جاري التحقق...' : 'Verifying...'}</span>
                </>
              ) : (
                <span>{lang === 'ar' ? 'تحقق ومتابعة' : 'Verify & Issue Session Token'}</span>
              )}
            </button>
          </div>
        )}

        {/* PROFILE SETUP WIZARD (UC-04 & UC-09) */}
        {authStep === 'profile_wizard' && (
          <div className="flex-1 p-6 md:p-10 overflow-y-auto max-w-2xl mx-auto w-full">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#A42A9B]">
              {lang === 'ar' ? 'إعداد الملف الشخصي' : 'Profile Setup & Edit'}
            </span>
            <h2 className="text-2xl font-extrabold text-[#1A1033] mb-1">
              {lang === 'ar' ? 'أكمل ملفك الشخصي' : 'Complete Your Member Profile'}
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              {lang === 'ar' ? 'اختر صورة شخصية وهواياتك المفضلة لتخصيص تجربتك.' : 'Capture or upload a profile photo and select your hobbies & emergency contact.'}
            </p>

            <div className="space-y-4">
              {/* Real Camera / File Avatar Picker */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200">
                <img
                  src={profForm.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                  alt="Avatar"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-[#6B2FA0]"
                />
                <div className="flex-1">
                  <p className="text-xs font-extrabold text-[#1A1033] mb-1">
                    {lang === 'ar' ? 'الصورة الشخصية (إلزامية)' : 'Profile Photo (Required)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCameraTarget('avatar')}
                    className="px-3.5 py-2 rounded-xl bg-[#2E1A6E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#F5A524]" />
                    {lang === 'ar' ? 'التقاط بالكاميرا أو رفع صورة' : 'Open Camera / Upload Photo'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={profForm.fullName}
                    onChange={e => setProfForm({ ...profForm, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold"
                    placeholder="Yara Mostafa"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={profForm.email}
                    onChange={e => setProfForm({ ...profForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold"
                    placeholder="yara@squadly.eg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {lang === 'ar' ? 'تاريخ الميلاد (+18)' : 'Date of Birth (18+)'}
                  </label>
                  <input
                    type="date"
                    value={profForm.dob}
                    onChange={e => setProfForm({ ...profForm, dob: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {lang === 'ar' ? 'النوع' : 'Gender'}
                  </label>
                  <select
                    value={profForm.gender}
                    onChange={e => setProfForm({ ...profForm, gender: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-medium"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {lang === 'ar' ? 'المنطقة' : 'Area (Cairo)'}
                  </label>
                  <select
                    value={profForm.area}
                    onChange={e => setProfForm({ ...profForm, area: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-medium"
                  >
                    <option value="Sheikh Zayed">Sheikh Zayed</option>
                    <option value="New Cairo">New Cairo</option>
                    <option value="Maadi">Maadi</option>
                    <option value="Zamalek">Zamalek</option>
                    <option value="Heliopolis">Heliopolis</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700">
                    {lang === 'ar' ? 'اختر هواياتك ومستوى المهارة' : 'Select Hobbies & Skill Level'}
                  </label>
                  <span className="text-xs font-extrabold text-[#6B2FA0]">{profForm.interests.length} selected</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {hobbies.map(h => {
                    const selected = profForm.interests.find(x => x.hobbyId === h.id);
                    return (
                      <div
                        key={h.id}
                        onClick={() => {
                          if (selected) {
                            setProfForm({ ...profForm, interests: profForm.interests.filter(x => x.hobbyId !== h.id) });
                          } else {
                            setProfForm({ ...profForm, interests: [...profForm.interests, { hobbyId: h.id, skillLevel: 'Intermediate' }] });
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between ${
                          selected ? 'bg-purple-50 border-[#6B2FA0] text-[#2E1A6E] font-bold' : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{h.icon}</span>
                          <span className="truncate">{lang === 'ar' ? h.name_ar : h.name_en}</span>
                        </div>
                        {selected && (
                          <select
                            value={selected.skillLevel}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              setProfForm({
                                ...profForm,
                                interests: profForm.interests.map(x => x.hobbyId === h.id ? { ...x, skillLevel: e.target.value } : x)
                              });
                            }}
                            className="mt-1.5 text-[10px] bg-white border border-purple-200 rounded px-1 py-0.5 font-semibold"
                          >
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                {user?.full_name && (
                  <button
                    onClick={() => setAuthStep('authenticated')}
                    className="flex-1 py-3.5 rounded-2xl btn-cancel font-bold text-xs cursor-pointer transition shadow-xs"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                )}
                <button
                  onClick={handleSaveProfile}
                  className="flex-[2] py-3.5 rounded-2xl bg-[#2E1A6E] text-white font-extrabold text-xs shadow-lg cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ الملف الشخصي' : 'Save Profile & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KYC IDENTITY VERIFICATION WIZARD (UC-06) */}
        {authStep === 'kyc_wizard' && (
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-between max-w-xl mx-auto w-full">
            <div>
              <button onClick={() => setAuthStep('authenticated')} className="text-xs font-bold text-[#6B2FA0] mb-4 cursor-pointer">
                ← {lang === 'ar' ? 'رجوع للملف الشخصي' : 'Back to App'}
              </button>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 text-[#6B2FA0]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#6B2FA0]">
                  {lang === 'ar' ? 'توثيق الهوية (KYC)' : 'KYC Identity Verification'}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-[#1A1033] mb-1">
                {lang === 'ar' ? 'احصل على شارة التوثيق البنفسجية' : 'Get Your Verified Shield Badge'}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                {lang === 'ar'
                  ? 'التقط صوراً حية للبطاقة الشخصية (الأمام والخلف) وصورة سيلفي مباشرة بالكاميرا. تتم المراجعة خلال 48 ساعة.'
                  : 'Use your camera to capture your Egyptian National ID (Front & Back) + a Live Liveness Selfie. Reviewed within 48h.'}
              </p>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {lang === 'ar' ? 'الرقم القومي (14 رقماً - يُحفظ مشفراً SHA-256)' : '14-Digit National ID Number (Hashed with SHA-256)'}
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={kycDocNumber}
                  onChange={e => setKycDocNumber(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 bg-white font-mono text-xs font-bold"
                />
              </div>

              {/* Step progress bar */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[1, 2, 3].map(step => (
                  <button
                    key={step}
                    onClick={() => setKycStep(step as 1 | 2 | 3)}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      kycStep === step ? 'bg-[#2E1A6E] text-white border-[#2E1A6E]' : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {step === 1 ? (lang === 'ar' ? '1. وجه البطاقة' : '1. ID Front') :
                     step === 2 ? (lang === 'ar' ? '2. ظهر البطاقة' : '2. ID Back') :
                     (lang === 'ar' ? '3. سيلفي مباشر' : '3. Live Selfie')}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-3xl p-6 border-2 border-dashed border-purple-300 text-center space-y-4">
                {kycStep === 1 && (
                  <>
                    {kycFrontPhoto ? (
                      <img src={kycFrontPhoto} alt="ID Front" className="w-full h-44 object-cover rounded-2xl border border-emerald-400 mx-auto" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#2E1A6E] flex items-center justify-center mx-auto">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                    <h3 className="font-bold text-sm">
                      {lang === 'ar' ? 'الخطوة 1: تصوير الوجه الأمامي للبطاقة الشخصية' : 'Step 1: Capture National ID (Front Side)'}
                    </h3>
                    <button
                      onClick={() => setCameraTarget('kyc_front')}
                      className="px-5 py-2.5 rounded-xl bg-[#2E1A6E] text-white text-xs font-extrabold cursor-pointer"
                    >
                      {kycFrontPhoto ? (lang === 'ar' ? 'إعادة التقاط وجه البطاقة' : 'Retake ID Front') : (lang === 'ar' ? 'فتح الكاميرا لالتقاط وجه البطاقة' : 'Open Camera for ID Front')}
                    </button>
                  </>
                )}

                {kycStep === 2 && (
                  <>
                    {kycBackPhoto ? (
                      <img src={kycBackPhoto} alt="ID Back" className="w-full h-44 object-cover rounded-2xl border border-emerald-400 mx-auto" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#2E1A6E] flex items-center justify-center mx-auto">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                    <h3 className="font-bold text-sm">
                      {lang === 'ar' ? 'الخطوة 2: تصوير الوجه الخلفي للبطاقة الشخصية' : 'Step 2: Capture National ID (Back Side)'}
                    </h3>
                    <button
                      onClick={() => setCameraTarget('kyc_back')}
                      className="px-5 py-2.5 rounded-xl bg-[#2E1A6E] text-white text-xs font-extrabold cursor-pointer"
                    >
                      {kycBackPhoto ? (lang === 'ar' ? 'إعادة التقاط ظهر البطاقة' : 'Retake ID Back') : (lang === 'ar' ? 'فتح الكاميرا لالتقاط ظهر البطاقة' : 'Open Camera for ID Back')}
                    </button>
                  </>
                )}

                {kycStep === 3 && (
                  <>
                    {kycSelfiePhoto ? (
                      <img src={kycSelfiePhoto} alt="Live Selfie" className="w-40 h-40 object-cover rounded-full border-4 border-emerald-400 mx-auto" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-purple-50 text-[#2E1A6E] flex items-center justify-center mx-auto">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <h3 className="font-bold text-sm">
                      {lang === 'ar' ? 'الخطوة 3: التقاط صورة سيلفي حية للتحقق من الهوية' : 'Step 3: Live Liveness Selfie Check'}
                    </h3>
                    <button
                      onClick={() => setCameraTarget('kyc_selfie')}
                      className="px-5 py-2.5 rounded-xl bg-[#2E1A6E] text-white text-xs font-extrabold cursor-pointer"
                    >
                      {kycSelfiePhoto ? (lang === 'ar' ? 'إعادة التقاط السيلفي' : 'Retake Live Selfie') : (lang === 'ar' ? 'فتح الكاميرا الأمامية للسيلفي' : 'Open Front Camera for Selfie')}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-bold text-center">
                <div className={`p-2 rounded-xl border ${kycFrontPhoto ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  {kycFrontPhoto ? '✓ ID Front Captured' : '○ ID Front Pending'}
                </div>
                <div className={`p-2 rounded-xl border ${kycBackPhoto ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  {kycBackPhoto ? '✓ ID Back Captured' : '○ ID Back Pending'}
                </div>
                <div className={`p-2 rounded-xl border ${kycSelfiePhoto ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  {kycSelfiePhoto ? '✓ Live Selfie Captured' : '○ Live Selfie Pending'}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmitKyc}
              className="w-full py-4 rounded-2xl bg-[#2E1A6E] text-white font-extrabold text-sm shadow-lg cursor-pointer mt-6"
            >
              {lang === 'ar' ? 'إرسال المستندات للمراجعة' : 'Submit Encrypted KYC Package'}
            </button>
          </div>
        )}

        {/* PAID MEMBERSHIP SUBSCRIPTION & CHECKOUT SCREEN (UC-07 / UC-08) */}
        {authStep === 'subscribe' && (
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-between overflow-y-auto max-w-xl mx-auto w-full">
            <div>
              <button onClick={() => setAuthStep('authenticated')} className="text-xs font-bold text-[#6B2FA0] mb-4 cursor-pointer">
                ← {lang === 'ar' ? 'رجوع' : 'Back'}
              </button>
              <div
                style={{ background: 'linear-gradient(135deg, #2E1A6E 0%, #6B2FA0 48%, #A42A9B 100%)' }}
                className="bg-[#2E1A6E] squadly-gradient rounded-3xl p-5 text-white shadow-xl mb-5"
              >
                <span className="px-2.5 py-1 rounded-full bg-[#F5A524] text-[#1A1033] text-[10px] font-extrabold uppercase">
                  Squadly Annual Membership
                </span>
                <h2 className="text-2xl font-extrabold mt-2">
                  {params.subscription_price_egp || '250'} EGP <span className="text-xs font-normal text-white/75">/ year (VAT incl.)</span>
                </h2>
                <p className="text-xs text-white/80 mt-1">
                  {lang === 'ar' ? 'انضم وأنشئ أنشطة بلا حدود طوال العام، دردشة جماعية، وتوثيق كامل.' : 'Join & host unlimited verified activities all year, unlock group chat, and earn reliability badges.'}
                </p>
              </div>

              {/* Payment Method Selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {lang === 'ar' ? 'وسيلة الدفع (Paymob / Meeza / البطاقة البنكية)' : 'Payment Method (Paymob Gateway)'}
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { id: 'card', label: 'Visa / Mastercard' },
                    { id: 'meeza', label: 'Meeza Card' },
                    { id: 'apple_pay', label: 'Apple / Google Pay' }
                  ].map(pm => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as any)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        paymentMethod === pm.id ? 'bg-purple-50 border-[#2E1A6E] text-[#2E1A6E]' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {paymentMethod !== 'apple_pay' && (
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={e => setCardHolder(e.target.value)}
                        placeholder="YARA MOSTAFA"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={e => setCardNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1">Expiry Date</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={e => setCardExpiry(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1">CVV</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={e => setCardCvv(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Promo Code Input */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#A42A9B]" />
                  {lang === 'ar' ? 'هل لديك كود خصم؟' : 'Promo Code (e.g. SQUAD2027, CAIRO50, VIPFREE)'}
                </label>
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="SQUAD2027"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 font-mono text-xs font-bold uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSubscribe}
                className="w-full py-4 rounded-2xl bg-[#2E1A6E] text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-[#F5A524]" />
                {lang === 'ar' ? 'إتمام الدفع وتفعيل الاشتراك' : 'Authorize Payment & Activate Pass'}
              </button>
            </div>
          </div>
        )}

        {/* MAIN AUTHENTICATED MEMBER APP (PROTECTED ROUTE) */}
        {authStep === 'authenticated' && user && (
          <ProtectedRoute
            isAuthenticated={authStep === 'authenticated' && Boolean(user)}
            isProfileCompleted={Boolean(user?.full_name)}
            fallback={null}
          >
            <>
              {/* Top Member Header (Mobile-First Single-Line Layout) */}
            <header className="px-3.5 sm:px-6 md:px-8 py-3 bg-white/95 backdrop-blur border-b border-purple-100/80 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <img
                    src={user.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                    alt={user.display_name || user.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#6B2FA0]"
                  />
                  {user.verification_status === 'Approved' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6B2FA0] text-white flex items-center justify-center text-[9px] font-bold border border-white" title="KYC Verified">
                      ✓
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-extrabold text-sm text-[#1A1033] leading-tight whitespace-nowrap truncate">
                      {user.display_name || user.full_name}
                    </h2>
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 whitespace-nowrap truncate">
                    <MapPin className="w-3 h-3 text-[#A42A9B] shrink-0" />
                    <span className="truncate">{user.area}, {user.city}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* SOS Emergency Shield Button (UC-31) */}
                <button
                  onClick={() => setShowSosModal(true)}
                  className="sos-top-btn h-8 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-[#381014] dark:hover:bg-[#4E171C] text-[#D93B3B] dark:text-[#FF6B6B] border border-red-200 dark:border-[#E5484D]/60 text-[11px] font-black flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 shadow-xs transition"
                  title="Emergency SOS Alert"
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#D93B3B] dark:text-[#FF6B6B]" />
                  <span className="text-[#D93B3B] dark:text-[#FF6B6B]">SOS</span>
                </button>
              </div>
            </header>

            {/* Tier / Verification Quick Prompts */}
            {(user.subscription_status !== 'Active' || user.verification_status !== 'Approved') && (
              <div className="px-4 md:px-8 py-2.5 bg-gradient-to-r from-[#2E1A6E] to-[#A42A9B] text-white flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F5A524] shrink-0" />
                  <span className="font-semibold text-[11px]">
                    {user.verification_status !== 'Approved'
                      ? (lang === 'ar' ? 'وثق هويتك للحصول على شارة التوثيق والانضمام للأنشطة' : 'Verify your National ID (KYC) to join or host activities & earn your shield')
                      : (lang === 'ar' ? 'قم بالترقية للعضوية السنوية للانضمام لأنشطة غير محدودة' : 'Activate your Annual Membership (250 EGP/yr) for unlimited activities')}
                  </span>
                </div>
                <button
                  onClick={() => setAuthStep(user.verification_status !== 'Approved' ? 'kyc_wizard' : 'subscribe')}
                  className="px-2.5 py-1 rounded-lg bg-[#F5A524] text-[#1A1033] font-extrabold text-[10px] shrink-0 cursor-pointer"
                >
                  {user.verification_status !== 'Approved' ? (lang === 'ar' ? 'توثيق الهوية' : 'Verify ID') : (lang === 'ar' ? 'اشترك الآن' : 'Subscribe')}
                </button>
              </div>
            )}

            {/* Main Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto pb-24">
              {/* TAB 1: DISCOVER FEED (UC-13 to UC-17) */}
              {memberTab === 'discover' && (
                <div className="p-4 md:p-8 space-y-4">
                  {/* Search Input (UC-15) */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={lang === 'ar' ? 'ابحث عن نشاط، هواية، أو حي...' : 'Search activities, hobbies, or neighborhoods...'}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-200 text-xs font-medium shadow-sm focus:outline-none focus:border-[#6B2FA0]"
                    />
                  </div>

                  {/* Hobby Filter Pills (UC-14) */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => setFilterHobby('')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        filterHobby === '' ? 'bg-[#2E1A6E] text-white shadow' : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      {lang === 'ar' ? 'الكل' : 'All Hobbies'}
                    </button>
                    {hobbies.map(h => (
                      <button
                        key={h.id}
                        onClick={() => setFilterHobby(filterHobby === h.id ? '' : h.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
                          filterHobby === h.id ? 'bg-[#2E1A6E] text-white shadow' : 'bg-white text-gray-700 border border-gray-200'
                        }`}
                      >
                        <span>{h.icon}</span>
                        <span>{lang === 'ar' ? h.name_ar : h.name_en}</span>
                      </button>
                    ))}
                  </div>

                  {/* Secondary Filter Bar (UC-14) */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <select
                      value={filterDate}
                      onChange={e => setFilterDate(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-gray-200 font-semibold text-gray-700"
                    >
                      <option value="all">{lang === 'ar' ? 'كل التواريخ' : 'Any Date'}</option>
                      <option value="today">{lang === 'ar' ? 'اليوم' : 'Today'}</option>
                    </select>

                    <select
                      value={filterMaxFee}
                      onChange={e => setFilterMaxFee(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-gray-200 font-semibold text-gray-700"
                    >
                      <option value="">{lang === 'ar' ? 'أي سعر' : 'Any Cost'}</option>
                      <option value="0">{lang === 'ar' ? 'مجاني فقط' : 'Free Only (0 EGP)'}</option>
                      <option value="200">≤ 200 EGP</option>
                    </select>

                    <button
                      onClick={() => setFilterHasSpots(!filterHasSpots)}
                      className={`px-2.5 py-1.5 rounded-xl border font-semibold cursor-pointer ${
                        filterHasSpots ? 'bg-purple-100 border-[#6B2FA0] text-[#2E1A6E]' : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      {lang === 'ar' ? 'أماكن متاحة فقط' : 'Open Spots Only'}
                    </button>
                  </div>

                  {/* Activity Cards Grid */}
                  {filteredActivities.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 my-4">
                      <Compass className="w-10 h-10 text-[#A42A9B] mx-auto mb-2 opacity-60" />
                      <p className="font-bold text-sm text-gray-800">{lang === 'ar' ? 'لا توجد أنشطة مطابقة للبحث' : 'No matching activities found'}</p>
                      <button
                        onClick={() => { setFilterHobby(''); setSearchQuery(''); setFilterDate('all'); setFilterMaxFee(''); setFilterHasSpots(false); }}
                        className="mt-3 px-4 py-2 rounded-xl bg-purple-50 text-[#2E1A6E] text-xs font-bold cursor-pointer"
                      >
                        {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredActivities.map(act => (
                        <div
                          key={act.id}
                          onClick={() => setSelectedActivityId(act.id)}
                          className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer relative overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-xl">
                                  {act.hobby?.icon || '🎯'}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A42A9B]">
                                      {lang === 'ar' ? act.hobby?.name_ar : act.hobby?.name_en}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#6B2FA0] text-[9px] font-extrabold">
                                      {act.gender_type}
                                    </span>
                                  </div>
                                  <h3 className="font-extrabold text-base text-[#1A1033] leading-snug">{act.title}</h3>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="px-2.5 py-1 rounded-xl bg-[#FCF7F3] border border-purple-100 text-xs font-extrabold text-[#2E1A6E]">
                                  {!act.fee_required || act.fee_amount === 0 ? (lang === 'ar' ? 'مجاني' : 'Free') : `${act.fee_amount} EGP`}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 line-clamp-2 mb-3">{act.description}</p>

                            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 bg-[#FCF7F3] p-2.5 rounded-2xl mb-3">
                              <div className="flex items-center gap-1.5 truncate">
                                <Calendar className="w-3.5 h-3.5 text-[#6B2FA0] shrink-0" />
                                <span className="font-semibold">{act.date} • {act.start_time}</span>
                              </div>
                              <div className="flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 text-[#A42A9B] shrink-0" />
                                <span className="truncate">{act.venue?.name_en || act.area} ({act.distanceKm > 80 ? 3.4 : act.distanceKm} km)</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {act.organizerCard && (
                                <>
                                  <img src={act.organizerCard.photo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                                  <span className="text-xs font-bold text-gray-800 truncate">{act.organizerCard.displayName}</span>
                                  {act.organizerCard.verified && (
                                    <span className="text-[10px] bg-purple-100 text-[#6B2FA0] px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0">✓ KYC</span>
                                  )}
                                  {act.organizerCard.ratingAvg && (
                                    <span className="text-[11px] font-black text-amber-900 dark:text-[#FBBF24] flex items-center gap-1 bg-amber-50 dark:bg-[#382006] px-2 py-0.5 rounded-full border border-amber-200 dark:border-[#F5A524]/30 whitespace-nowrap shrink-0">
                                      <Star className="w-3 h-3 fill-[#F5A524] text-[#F5A524] shrink-0" /> {act.organizerCard.ratingAvg}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {act.viewerParticipation?.status === 'Confirmed' && (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-extrabold whitespace-nowrap">
                                  ✓ {lang === 'ar' ? 'منضم' : 'Joined'}
                                </span>
                              )}
                              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-xl whitespace-nowrap ${
                                act.confirmedCount >= act.total_slots ? 'bg-red-50 text-red-700' : 'bg-purple-50 text-[#2E1A6E]'
                              }`}>
                                {act.confirmedCount}/{act.total_slots} {lang === 'ar' ? 'مقاعد' : 'spots'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MY SQUADS & GROUP CHATS */}
              {memberTab === 'my_squads' && (
                <div className="p-4 md:p-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-[#1A1033]">
                      {lang === 'ar' ? 'أنشطتي ومحادثات المجموعات' : 'My Squads & Group Chats'}
                    </h2>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#2E1A6E] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 text-[#F5A524]" />
                      {lang === 'ar' ? 'إنشاء نشاط' : 'Host Activity'}
                    </button>
                  </div>

                  {activities.filter(a => a.viewerParticipation || a.organizer_id === user.id).length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-600">
                        {lang === 'ar' ? 'لم تنضم إلى أي نشاط بعد.' : 'You have not joined or hosted any activities yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activities.filter(a => a.viewerParticipation || a.organizer_id === user.id).map(act => (
                        <div key={act.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{act.hobby?.icon || '🎯'}</span>
                              <div>
                                <h3 className="font-extrabold text-sm text-[#1A1033]">{act.title}</h3>
                                <p className="text-[11px] text-gray-500">{act.date} • {act.start_time} • {act.venue?.name_en}</p>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              act.organizer_id === user.id ? 'bg-purple-100 text-[#2E1A6E]' :
                              act.viewerParticipation?.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {act.organizer_id === user.id ? 'Organizer' : act.viewerParticipation?.status}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedActivityId(act.id)}
                              className="flex-1 py-2.5 rounded-xl bg-[#2E1A6E] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#F5A524]" />
                              {lang === 'ar' ? 'التفاصيل، الدردشة و رمز QR' : 'Details, Group Chat & QR Check-In'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS CENTER (UC-35) */}
              {memberTab === 'notifications' && (
                <div className="p-4 md:p-8 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-[#1A1033]">
                      {lang === 'ar' ? 'مركز الإشعارات' : 'Notification Center'}
                    </h2>
                    <button
                      onClick={async () => {
                        await fetch('/api/notifications/read-all', {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${memberToken}` }
                        });
                        fetchBootstrap();
                      }}
                      className="text-xs font-bold text-[#6B2FA0] cursor-pointer"
                    >
                      {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center text-xs text-gray-500">
                      {lang === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet.'}
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                          n.is_read ? 'bg-white border-gray-100' : 'bg-purple-50/70 border-purple-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#2E1A6E] text-[#F5A524] flex items-center justify-center shrink-0 text-[10px] font-extrabold">
                          {n.code || '🔔'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-xs text-[#1A1033]">{lang === 'ar' ? n.title_ar : n.title_en}</h4>
                            <span className="text-[10px] text-gray-400">{n.created_at?.slice(0, 16)}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{lang === 'ar' ? n.body_ar : n.body_en}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: PROFILE, RELIABILITY, SUBSCRIPTION & PRIVACY */}
              {memberTab === 'profile' && (
                <div className="p-4 md:p-8 space-y-4">
                  {/* Profile Card */}
                  <div className="bg-white dark:bg-[#18102E] rounded-3xl p-5 border border-gray-100 dark:border-purple-900/30 shadow-sm space-y-4">
                    {/* Top Row: Avatar + Name & Verification + Edit Action */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={user.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                            alt=""
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-[#6B2FA0]"
                          />
                          <button
                            onClick={() => setCameraTarget('avatar')}
                            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2E1A6E] text-white flex items-center justify-center shadow cursor-pointer hover:scale-105 transition"
                            title="Update Avatar Photo"
                          >
                            <Camera className="w-3 h-3 text-[#F5A524]" />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-extrabold text-base md:text-lg text-[#1A1033] dark:text-[#F3EFFC] truncate leading-tight">
                              {user.full_name}
                            </h3>
                            {user.verification_status === 'Approved' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-[#6B2FA0] dark:text-[#D8B4FE] text-[10px] font-extrabold whitespace-nowrap">
                                ✓ KYC Verified
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                            @{user.display_name || user.full_name?.split(' ')[0]?.toLowerCase() || 'member'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAuthStep('profile_wizard')}
                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#251747] dark:hover:bg-[#321E5C] text-gray-700 dark:text-[#EDE8FA] border border-gray-200 dark:border-purple-800/40 cursor-pointer shrink-0 transition"
                        title="Edit Profile"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Member Details: Each detail in its own clean row */}
                    <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-purple-900/30 text-xs">
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FAF7FD] dark:bg-[#241644] text-[#1A1033] dark:text-[#EDE8FA] border border-purple-100/70 dark:border-purple-900/20">
                        <Phone className="w-4 h-4 text-[#6B2FA0] dark:text-[#C084FC] shrink-0" />
                        <span className="font-semibold truncate tracking-wide">{user.mobile || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FAF7FD] dark:bg-[#241644] text-[#1A1033] dark:text-[#EDE8FA] border border-purple-100/70 dark:border-purple-900/20">
                        <MapPin className="w-4 h-4 text-[#6B2FA0] dark:text-[#C084FC] shrink-0" />
                        <span className="font-semibold truncate">{user.area ? `${user.area}, ${user.city || 'Cairo'}` : 'Cairo'}</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FAF7FD] dark:bg-[#241644] text-[#1A1033] dark:text-[#EDE8FA] border border-purple-100/70 dark:border-purple-900/20">
                        <Mail className="w-4 h-4 text-[#6B2FA0] dark:text-[#C084FC] shrink-0" />
                        <span className="font-semibold truncate">{user.email || '—'}</span>
                      </div>
                    </div>

                    {/* Stats & Reliability Score */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-purple-900/30 text-center">
                      <div className="bg-[#FCF7F3] dark:bg-[#241644] py-2.5 px-1.5 rounded-2xl border border-purple-100/40 dark:border-purple-900/20 flex flex-col items-center justify-center h-full min-h-[72px]">
                        <span className="text-base font-extrabold text-[#2E1A6E] dark:text-[#F5A524] flex items-center justify-center gap-1 leading-tight">
                          ⭐ {Number(user.rating_avg || 5).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate mt-1">
                          {user.rating_count} {lang === 'ar' ? 'تقييم' : 'Ratings'}
                        </span>
                      </div>
                      <div className="bg-[#FCF7F3] dark:bg-[#241644] py-2.5 px-1.5 rounded-2xl border border-purple-100/40 dark:border-purple-900/20 flex flex-col items-center justify-center h-full min-h-[72px]">
                        <span className="text-base font-extrabold text-[#2E9E6A] dark:text-[#4ADE80] leading-tight">
                          {user.activities_attended}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate mt-1">
                          {lang === 'ar' ? 'أنشطة' : 'Attended'} • {user.participant_strikes}s
                        </span>
                      </div>
                      <div className="bg-[#FCF7F3] dark:bg-[#241644] py-2.5 px-1.5 rounded-2xl border border-purple-100/40 dark:border-purple-900/20 flex flex-col items-center justify-center h-full min-h-[72px]">
                        <span className="text-base font-extrabold text-[#A42A9B] dark:text-[#F472B6] truncate leading-tight">
                          {user.subscription_status || 'Active'}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate mt-1">
                          {lang === 'ar' ? 'العضوية' : 'Membership'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KYC Verification Status Card */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className={`w-6 h-6 ${user.verification_status === 'Approved' ? 'text-[#2E9E6A]' : 'text-[#F5A524]'}`} />
                      <div>
                        <h4 className="font-extrabold text-xs text-[#1A1033]">
                          {lang === 'ar' ? 'حالة توثيق الهوية (KYC)' : 'KYC Identity Verification'}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Status: {user.verification_status}
                        </p>
                      </div>
                    </div>
                    {user.verification_status !== 'Approved' && (
                      <button
                        onClick={() => setAuthStep('kyc_wizard')}
                        className="px-3 py-1.5 rounded-xl bg-[#2E1A6E] text-white text-xs font-bold cursor-pointer"
                      >
                        {lang === 'ar' ? 'توثيق الآن' : 'Verify ID'}
                      </button>
                    )}
                  </div>

                  {/* Subscription Management */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-xs text-[#1A1033]">
                          {lang === 'ar' ? 'إدارة العضوية السنوية' : 'Annual Subscription Pass'}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {user.subscription_status === 'Active'
                            ? `Active until ${user.subscription_end}`
                            : 'Free Tier (First activity free)'}
                        </p>
                      </div>
                      <button
                        onClick={() => setAuthStep('subscribe')}
                        className="px-3 py-1.5 rounded-xl bg-[#F5A524] text-[#1A1033] text-xs font-extrabold cursor-pointer"
                      >
                        {user.subscription_status === 'Active' ? (lang === 'ar' ? 'تجديد' : 'Renew Pass') : (lang === 'ar' ? 'ترقية (250 ج.م)' : 'Subscribe (250 EGP)')}
                      </button>
                    </div>
                  </div>

                  {/* Suggest a New Hobby */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-[#1A1033]">
                        {lang === 'ar' ? 'اقتراح هواية جديدة' : 'Suggest a New Hobby Category'}
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        {lang === 'ar' ? 'لا تجد هوايتك المفضلة؟ أرسلها لفريق الإدارة.' : 'Missing your favorite hobby? Submit it for Admin review.'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDialogConfig({
                          code: 'SUGGEST_HOBBY',
                          title: lang === 'ar' ? 'اقتراح هواية جديدة' : 'Suggest a New Hobby',
                          message: lang === 'ar' ? 'سيتم مراجعة اقتراحك من قِبل الإدارة وإضافته للقائمة.' : 'Our Operations team reviews new hobby suggestions weekly.',
                          inputPlaceholder: lang === 'ar' ? 'مثال: الشطرنج، التزلج، الخط العربي...' : 'e.g., Pottery, Kitesurfing, Stand-up Comedy...',
                          requireInput: true,
                          confirmLabel: lang === 'ar' ? 'إرسال الاقتراح' : 'Submit Suggestion',
                          onConfirm: async (name) => {
                            const res = await fetch('/api/hobbies/suggest', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${memberToken}`
                              },
                              body: JSON.stringify({ name, description: 'Suggested from member profile', typicalGroupSize: 6 })
                            });
                            const data = await res.json();
                            showToast(tMsg(data.code || 'INF-026', lang), res.ok ? 'success' : 'error');
                          }
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 text-[#2E1A6E] text-xs font-bold cursor-pointer"
                    >
                      {lang === 'ar' ? 'اقترح الآن' : 'Suggest'}
                    </button>
                  </div>

                  {/* Blocked Users List */}
                  {blocks.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
                      <h4 className="font-extrabold text-xs text-[#1A1033]">
                        {lang === 'ar' ? 'قائمة الحظر' : 'Blocked Members'}
                      </h4>
                      {blocks.map(b => (
                        <div key={b.id} className="flex items-center justify-between text-xs py-1">
                          <span>{b.display_name}</span>
                          <button
                            onClick={async () => {
                              await fetch(`/api/blocks/${b.id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${memberToken}` }
                              });
                              showToast(tMsg('INF-020', lang), 'info');
                              fetchBootstrap();
                            }}
                            className="text-[#6B2FA0] font-bold cursor-pointer"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preferences & Live Location Card (Language & GPS Sync) */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                    <h4 className="font-extrabold text-xs text-[#1A1033]">
                      {lang === 'ar' ? 'التفضيلات والموقع' : 'App Preferences & Location'}
                    </h4>

                    {/* Change Language */}
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#6B2FA0] flex items-center justify-center">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1A1033]">{lang === 'ar' ? 'لغة التطبيق' : 'App Language'}</p>
                          <p className="text-[10px] text-gray-500">{lang === 'ar' ? 'العربية (مصر)' : 'English (US)'}</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleLang}
                        className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-purple-100 text-[#2E1A6E] text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 text-[#F5A524]" />
                        <span>{lang === 'en' ? 'العربية' : 'English'}</span>
                      </button>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#6B2FA0] flex items-center justify-center">
                          {theme === 'dark' ? <Moon className="w-4 h-4 text-[#F5A524]" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1A1033]">{lang === 'ar' ? 'المظهر الداكن' : 'Dark Mode'}</p>
                          <p className="text-[10px] text-gray-500">
                            {theme === 'dark'
                              ? (lang === 'ar' ? 'مفعل (المظهر الليلي الداكن)' : 'Enabled (Night Mode)')
                              : (lang === 'ar' ? 'معطل (المظهر الفاتح)' : 'Disabled (Light Mode)')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-[#2E1A6E] text-white shadow-xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                      >
                        {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-[#F5A524]" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                        <span>{theme === 'dark' ? (lang === 'ar' ? 'داكن 🌙' : 'Dark 🌙') : (lang === 'ar' ? 'فاتح ☀️' : 'Light ☀️')}</span>
                      </button>
                    </div>

                    {/* Sync GPS Location */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          gpsStatus === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1A1033]">{lang === 'ar' ? 'مزامنة موقع GPS المباشر' : 'Live Browser GPS Sync'}</p>
                          <p className="text-[10px] text-gray-500">
                            {gpsStatus === 'active'
                              ? `${userCoords ? `${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}` : `${user.area}, ${user.city}`} (Active)`
                              : gpsStatus === 'locating'
                              ? (lang === 'ar' ? 'جارٍ تحديد الموقع...' : 'Detecting GPS coordinates...')
                              : `${user.area}, ${user.city} (Cached)`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={syncBrowserLocation}
                        disabled={gpsStatus === 'locating'}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                          gpsStatus === 'active'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-[#2E1A6E] hover:bg-[#3d248f] text-white shadow-xs'
                        }`}
                      >
                        <Navigation className={`w-3.5 h-3.5 ${gpsStatus === 'locating' ? 'animate-spin' : ''}`} />
                        <span>
                          {gpsStatus === 'locating'
                            ? (lang === 'ar' ? 'جارٍ التحديد...' : 'Locating...')
                            : gpsStatus === 'active'
                            ? (lang === 'ar' ? 'تم التحديث ✓' : 'Synced ✓')
                            : (lang === 'ar' ? 'مزامنة GPS' : 'Sync GPS')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Privacy Settings & Account Actions */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                    <h4 className="font-extrabold text-xs text-[#1A1033]">
                      {lang === 'ar' ? 'الخصوصية وإعدادات الحساب' : 'Privacy & Account Controls'}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleLogout}
                        className="py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> {lang === 'ar' ? 'تسجيل الخروج' : 'Log Out'}
                      </button>
                      <button
                        onClick={() => {
                          setDialogConfig({
                            code: 'CON-012',
                            title: lang === 'ar' ? 'حذف الحساب نهائياً' : 'Schedule Account Deletion',
                            message: lang === 'ar'
                              ? 'سيتم جدولة حسابك للحذف النهائي وفقاً للقانون المصري لحماية البيانات.'
                              : 'Your account will be scheduled for deletion under Egyptian PDPL.',
                            requireInput: false,
                            confirmLabel: lang === 'ar' ? 'تأكيد الحذف' : 'Delete Account',
                            danger: true,
                            onConfirm: async () => {
                              const res = await fetch('/api/account/delete', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${memberToken}` }
                              });
                              const data = await res.json();
                              showToast(tMsg(data.code || 'INF-033', lang), res.ok ? 'info' : 'error');
                              handleLogout();
                            }
                          });
                        }}
                        className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {lang === 'ar' ? 'حذف الحساب' : 'Delete Account'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* Bottom Member Navigation Bar (5-Column Native Mobile Layout) */}
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-5xl w-full bg-white/95 backdrop-blur-md border-t border-purple-100 px-2 pt-2 pb-4 sm:pb-3 grid grid-cols-5 items-end z-30 shadow-[0_-4px_20px_rgba(26,16,51,0.06)]">
              <button
                onClick={() => setMemberTab('discover')}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold cursor-pointer transition ${
                  memberTab === 'discover' ? 'text-[#2E1A6E]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Compass className={`w-5 h-5 ${memberTab === 'discover' ? 'text-[#6B2FA0]' : ''}`} />
                <span className="whitespace-nowrap leading-none">{lang === 'ar' ? 'استكشاف' : 'Discover'}</span>
              </button>

              <button
                onClick={() => setMemberTab('my_squads')}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold cursor-pointer transition ${
                  memberTab === 'my_squads' ? 'text-[#2E1A6E]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <MessageSquare className={`w-5 h-5 ${memberTab === 'my_squads' ? 'text-[#6B2FA0]' : ''}`} />
                <span className="whitespace-nowrap leading-none">{lang === 'ar' ? 'مجموعاتي' : 'My Squads'}</span>
              </button>

              {/* Center Host Activity Button with Aligned Baseline Label */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex flex-col items-center justify-center gap-1 cursor-pointer group"
                title="Host Activity"
              >
                <div
                  style={{ background: 'linear-gradient(135deg, #2E1A6E 0%, #6B2FA0 50%, #A42A9B 100%)' }}
                  className="w-11 h-11 -mt-5 rounded-2xl bg-[#2E1A6E] squadly-gradient text-white flex items-center justify-center shadow-md border-2 border-white group-hover:scale-105 transition"
                >
                  <PlusCircle className="w-5 h-5 text-[#F5A524]" />
                </div>
                <span className="text-[11px] font-extrabold text-[#2E1A6E] whitespace-nowrap leading-none">
                  {lang === 'ar' ? 'إنشاء' : 'Host'}
                </span>
              </button>

              <button
                onClick={() => setMemberTab('notifications')}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold cursor-pointer transition ${
                  memberTab === 'notifications' ? 'text-[#2E1A6E]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className="relative">
                  <Bell className={`w-5 h-5 ${memberTab === 'notifications' ? 'text-[#6B2FA0]' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#D93B3B] text-white text-[9px] font-extrabold flex items-center justify-center border border-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span className="whitespace-nowrap leading-none">{lang === 'ar' ? 'الإشعارات' : 'Alerts'}</span>
              </button>

              <button
                onClick={() => setMemberTab('profile')}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold cursor-pointer transition ${
                  memberTab === 'profile' ? 'text-[#2E1A6E]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <User className={`w-5 h-5 ${memberTab === 'profile' ? 'text-[#6B2FA0]' : ''}`} />
                <span className="whitespace-nowrap leading-none">{lang === 'ar' ? 'حسابي' : 'Profile'}</span>
              </button>
            </nav>
          </>
        </ProtectedRoute>
      )}

        {/* ACTIVITY DETAILS, GROUP CHAT, QR CHECK-IN, RATING & REPORT MODAL */}
        {selectedActivity && (
          <ActivityDetailModal
            lang={lang}
            token={memberToken}
            activity={selectedActivity}
            currentUser={user}
            onClose={() => setSelectedActivityId(null)}
            onRefresh={() => fetchBootstrap()}
            showToast={showToast}
            openDialog={(cfg) => setDialogConfig(cfg)}
            onRequireAuth={() => { setSelectedActivityId(null); setAuthStep('phone'); }}
            onRequireSubscription={() => { setSelectedActivityId(null); setAuthStep('subscribe'); }}
          />
        )}

        {/* CREATE ACTIVITY MODAL (UC-22) */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 my-auto border border-purple-200">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-lg text-[#1A1033]">
                  {lang === 'ar' ? 'إنشاء نشاط جديد' : 'Host a New Squad Activity'}
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-full bg-gray-100 text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {lang === 'ar'
                  ? 'مسموح بالأنشطة بين 06:00 صباحاً و 10:00 مساءً فقط للمنظمين الموثقين.'
                  : 'Allowed hours: 06:00–22:00. Minimum 3 participants to run.'}
              </p>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Hobby Category</label>
                    <select
                      value={createForm.hobbyId}
                      onChange={e => {
                        const h = hobbies.find(x => x.id === e.target.value);
                        setCreateForm({
                          ...createForm,
                          hobbyId: e.target.value,
                          totalSlots: h ? h.min_slots : createForm.totalSlots
                        });
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    >
                      {hobbies.map(h => (
                        <option key={h.id} value={h.id}>{h.icon} {h.name_en} ({h.min_slots}–{h.max_slots} slots)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Vetted Public Venue</label>
                    <select
                      value={createForm.venueId}
                      onChange={e => setCreateForm({ ...createForm, venueId: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    >
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name_en} ({v.area})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Activity Title (5–80 chars)</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g., Sunset Padel Doubles Mixer"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-purple-200 block mb-1">
                    {lang === 'ar' ? 'الوصف (بدون أرقام هواتف أو روابط)' : 'Description (No phone numbers or external links)'}
                  </label>
                  <textarea
                    rows={3}
                    value={createForm.description}
                    onChange={e => {
                      setCreateForm({ ...createForm, description: e.target.value });
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.max(e.target.scrollHeight, 84)}px`;
                    }}
                    placeholder="Describe skill expectations, equipment provided, and meeting point..."
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs leading-relaxed auto-expand-textarea"
                    style={{ minHeight: '84px', maxHeight: '280px', overflowY: 'auto' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      {lang === 'ar' ? 'التاريخ' : 'Date'}
                    </label>
                    <input
                      type="date"
                      value={createForm.date}
                      onChange={e => setCreateForm({ ...createForm, date: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-purple-900/40 px-3 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#18102E] text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      {lang === 'ar' ? 'الوقت (06:00-20:30)' : 'Time (06:00–20:30)'}
                    </label>
                    <input
                      type="time"
                      value={createForm.startTime}
                      onChange={e => setCreateForm({ ...createForm, startTime: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-purple-900/40 px-3 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#18102E] text-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      {lang === 'ar' ? 'عدد المقاعد (3-25)' : 'Total Slots (3–25)'}
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={25}
                      value={createForm.totalSlots}
                      onChange={e => setCreateForm({ ...createForm, totalSlots: Number(e.target.value) })}
                      className="w-full rounded-xl border border-gray-200 dark:border-purple-900/40 px-3 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#18102E] text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      {lang === 'ar' ? 'تكلفة المكان (ج.م)' : 'Cost Share (EGP)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.feeAmount}
                      onChange={e => setCreateForm({ ...createForm, feeAmount: Number(e.target.value), feeRequired: Number(e.target.value) > 0 })}
                      className="w-full rounded-xl border border-gray-200 dark:border-purple-900/40 px-3 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#18102E] text-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    {lang === 'ar' ? 'طريقة الانضمام' : 'Join Mode'}
                  </label>
                  <select
                    value={createForm.joinMode}
                    onChange={e => setCreateForm({ ...createForm, joinMode: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-purple-900/40 px-3 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#18102E] text-gray-800 dark:text-gray-100"
                  >
                    <option value="Instant">{lang === 'ar' ? 'انضمام فوري (Instant Join)' : 'Instant Join'}</option>
                    <option value="Approval">{lang === 'ar' ? 'بموافقة المنظم (Approval)' : 'Organizer Approval'}</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateActivity}
                className="w-full py-3.5 rounded-2xl bg-[#2E1A6E] text-white font-extrabold text-xs shadow-lg cursor-pointer"
              >
                {lang === 'ar' ? 'نشر النشاط' : 'Publish Activity'}
              </button>
            </div>
          </div>
        )}

        {/* Emergency SOS Modal (UC-31) */}
        {showSosModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#18102E] rounded-3xl max-w-sm w-full p-6 text-center space-y-4 border-2 border-[#D93B3B] shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-[#381014] text-[#D93B3B] dark:text-[#FF6B6B] flex items-center justify-center mx-auto animate-pulse">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-extrabold text-[#1A1033] dark:text-[#F3EFFC]">
                {lang === 'ar' ? 'نداء طوارئ SOS' : 'Emergency SOS Alert'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-[#DCD4F2] leading-relaxed">
                {lang === 'ar'
                  ? 'سيتم إرسال موقعك الجغرافي المباشر (GPS) وبيانات النشاط الحالي فوراً إلى فريق الأمان والعمليات في Squadly.'
                  : 'This immediately dispatches your live GPS coordinates, profile, and active activity details to the Squadly Trust & Safety Response Team.'}
              </p>
              <button
                onClick={handleTriggerSos}
                className="w-full py-3.5 rounded-2xl bg-[#D93B3B] hover:bg-red-700 text-white font-extrabold text-sm shadow-lg cursor-pointer"
              >
                🚨 {lang === 'ar' ? 'إرسال نداء استغاثة فوري' : 'SEND LIVE SOS ALERT NOW'}
              </button>
              <a
                href="tel:122"
                className="block w-full py-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-xs"
              >
                📞 {lang === 'ar' ? 'الاتصال بشرطة النجدة المصرية (122)' : 'Call Egyptian Emergency Police (122)'}
              </a>
              <button
                onClick={() => setShowSosModal(false)}
                className="w-full py-2.5 rounded-xl btn-cancel font-bold text-xs cursor-pointer transition"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Real Hardware Camera Capture Modal (UC-04 & UC-06) */}
        {cameraTarget && (
          <CameraCaptureModal
            title={
              cameraTarget === 'avatar' ? (lang === 'ar' ? 'التقاط الصورة الشخصية' : 'Capture Profile Photo') :
              cameraTarget === 'kyc_front' ? (lang === 'ar' ? 'تصوير وجه البطاقة الشخصية' : 'Capture National ID (Front)') :
              cameraTarget === 'kyc_back' ? (lang === 'ar' ? 'تصوير ظهر البطاقة الشخصية' : 'Capture National ID (Back)') :
              (lang === 'ar' ? 'التقاط صورة سيلفي مباشرة' : 'Capture Live Liveness Selfie')
            }
            subtitle={
              cameraTarget === 'kyc_front' || cameraTarget === 'kyc_back'
                ? (lang === 'ar' ? 'ضع البطاقة داخل الإطار وتأكد من وضوح البيانات' : 'Align your Egyptian National ID clearly inside the frame')
                : (lang === 'ar' ? 'انظر مباشرة إلى الكاميرا في إضاءة جيدة' : 'Look directly into the camera in good lighting')
            }
            mode={cameraTarget === 'kyc_front' || cameraTarget === 'kyc_back' ? 'document' : 'selfie'}
            allowGallery={cameraTarget === 'avatar'}
            onClose={() => setCameraTarget(null)}
            onCapture={async (base64) => {
              if (cameraTarget === 'avatar') {
                setProfForm(prev => ({ ...prev, profilePhoto: base64 }));
                if (user && authStep === 'authenticated') {
                  await fetch('/api/profile/save', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${memberToken}`
                    },
                    body: JSON.stringify({
                      ...profForm,
                      profilePhoto: base64
                    })
                  });
                  fetchBootstrap();
                  showToast(lang === 'ar' ? 'تم تحديث الصورة الشخصية!' : 'Profile photo updated!', 'success');
                }
              } else if (cameraTarget === 'kyc_front') {
                setKycFrontPhoto(base64);
                setKycStep(2);
              } else if (cameraTarget === 'kyc_back') {
                setKycBackPhoto(base64);
                setKycStep(3);
              } else if (cameraTarget === 'kyc_selfie') {
                setKycSelfiePhoto(base64);
              }
              setCameraTarget(null);
            }}
          />
        )}

        {/* Styled Action Dialog Modal */}
        <ActionDialogModal dialog={dialogConfig} onClose={() => setDialogConfig(null)} />
      </div>
    </div>
  );
}

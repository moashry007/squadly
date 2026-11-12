import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Sparkles,
  Download,
  Smartphone,
  Globe,
  ArrowRight,
  CheckCircle2,
  Calendar,
  MapPin,
  Star,
  AlertTriangle,
  Play,
  Heart,
  ChevronRight,
  ShieldAlert,
  Zap,
  Lock,
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';
import { Lang } from '../i18n/messages';

interface LandingPageProps {
  lang: Lang;
  onToggleLang: () => void;
  onLaunchApp: () => void;
  onOpenAdmin: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  lang,
  onToggleLang,
  onLaunchApp,
  onOpenAdmin,
  theme = 'light',
  onToggleTheme
}) => {
  const [selectedHobby, setSelectedHobby] = useState<string>('All');

  const hobbies = [
    { name: lang === 'ar' ? 'الكل' : 'All', key: 'All' },
    { name: lang === 'ar' ? 'بادل' : 'Padel', key: 'Padel', icon: '🎾', count: '14 squads' },
    { name: lang === 'ar' ? 'جري وماراثون' : 'Running', key: 'Running', icon: '🏃', count: '8 squads' },
    { name: lang === 'ar' ? 'ألعاب لوحية' : 'Board Games', key: 'Board Games', icon: '🎲', count: '11 squads' },
    { name: lang === 'ar' ? 'تنس أرضي' : 'Tennis', key: 'Tennis', icon: '🎾', count: '6 squads' },
    { name: lang === 'ar' ? 'كرة قدم' : 'Football', key: 'Football', icon: '⚽', count: '18 squads' },
    { name: lang === 'ar' ? 'برمجة وتقنية' : 'Coding & Tech', key: 'Coding', icon: '💻', count: '5 squads' },
  ];

  const sampleActivities = [
    {
      title: lang === 'ar' ? 'مباراة بادل مسائية للمستوى المتوسط' : 'Sunset Padel Match (Intermediate)',
      hobby: 'Padel',
      icon: '🎾',
      date: 'Today, 06:30 PM',
      venue: 'The Club Padel, Sheikh Zayed',
      confirmed: 4,
      total: 4,
      fee: '75 EGP',
      gender: 'Mixed',
      organizer: 'Yara M. (Verified ⭐ 4.9)'
    },
    {
      title: lang === 'ar' ? 'جلسة ألعاب لوحية استراتيجية كاجوال' : 'Catan & Board Games Game Night',
      hobby: 'Board Games',
      icon: '🎲',
      date: 'Tomorrow, 07:00 PM',
      venue: 'Sufi Lounge, Zamalek',
      confirmed: 5,
      total: 6,
      fee: 'Free',
      gender: 'Mixed',
      organizer: 'Omar H. (Verified ⭐ 4.8)'
    },
    {
      title: lang === 'ar' ? 'جري 5 كم صباحي في ممشى زايد' : 'Morning 5K Social Run & Coffee',
      hobby: 'Running',
      icon: '🏃',
      date: 'Friday, 07:00 AM',
      venue: 'Zayed Walkway, 6th of October',
      confirmed: 8,
      total: 10,
      fee: 'Free',
      gender: 'Mixed',
      organizer: 'Layla M. (Verified ⭐ 5.0)'
    }
  ];

  const filteredActivities =
    selectedHobby === 'All'
      ? sampleActivities
      : sampleActivities.filter(a => a.hobby.toLowerCase().includes(selectedHobby.toLowerCase()));

  return (
    <div className={`min-h-screen bg-[#FAF7FD] dark:bg-[#0D081D] text-[#1A1033] dark:text-[#F3EFFC] transition-colors duration-200 ${lang === 'ar' ? 'font-sans' : ''}`}>
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#120A24]/95 backdrop-blur-md border-b border-purple-100 dark:border-purple-900/40 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2E1A6E] via-[#6B2FA0] to-[#C4407A] flex items-center justify-center text-white font-black text-xl shadow-md">
              S<span className="text-[#F5A524]">.</span>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#1A1033] dark:text-white">
                Squadly<span className="text-[#F5A524]">.</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-[#251747] text-[#6B2FA0] dark:text-[#C084FC] border border-purple-100 dark:border-purple-800/40">
                Cairo &amp; Giza
              </span>
            </div>
          </div>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-gray-600 dark:text-gray-300">
            <a href="#features" className="hover:text-[#6B2FA0] dark:hover:text-[#C084FC] transition">
              {lang === 'ar' ? 'المميزات والأمان' : 'Safety & Features'}
            </a>
            <a href="#how-it-works" className="hover:text-[#6B2FA0] dark:hover:text-[#C084FC] transition">
              {lang === 'ar' ? 'كيف يعمل' : 'How It Works'}
            </a>
            <a href="#hobbies" className="hover:text-[#6B2FA0] dark:hover:text-[#C084FC] transition">
              {lang === 'ar' ? 'الهوايات والأنشطة' : 'Explore Squads'}
            </a>
            <a href="#download" className="hover:text-[#6B2FA0] dark:hover:text-[#C084FC] transition">
              {lang === 'ar' ? 'تحميل التطبيق' : 'Download Mobile App'}
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-full border border-purple-100 dark:border-purple-800/40 hover:bg-purple-50 dark:hover:bg-[#251747] text-gray-600 dark:text-amber-400 transition"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-[#F5A524]" /> : <Moon className="w-4 h-4 text-[#6B2FA0]" />}
              </button>
            )}

            {/* Language Toggle */}
            <button
              onClick={onToggleLang}
              className="p-2 sm:px-3 sm:py-2 rounded-full border border-purple-100 dark:border-purple-800/40 hover:bg-purple-50 dark:hover:bg-[#251747] text-xs font-bold text-[#6B2FA0] dark:text-[#C084FC] flex items-center gap-1.5 transition"
              title="Toggle Language"
            >
              <Globe className="w-4 h-4 text-[#F5A524]" />
              <span className="hidden sm:inline">{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {/* Launch App Button */}
            <button
              onClick={onLaunchApp}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-[#2E1A6E] via-[#6B2FA0] to-[#A42A9B] hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition active:scale-98"
            >
              <span>{lang === 'ar' ? 'تشغيل التطبيق' : 'Launch Web App'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-[#FAF7FD] via-[#F4EEFC] to-[#FAF7FD] dark:from-[#0D081D] dark:via-[#130B26] dark:to-[#0D081D] transition-colors">
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-[#6B2FA0]/10 dark:bg-[#6B2FA0]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-10 w-80 h-80 rounded-full bg-[#F5A524]/10 dark:bg-[#F5A524]/15 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headline & Action */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100/90 dark:bg-purple-900/40 border border-purple-200/70 dark:border-purple-800/50 text-[#6B2FA0] dark:text-[#D8B4FE] text-xs font-extrabold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#F5A524]" />
                {lang === 'ar' ? 'مجتمع الهوايات الموثق الأول في مصر' : "Egypt's #1 Verified Small-Group Hobby Community"}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1A1033] dark:text-white tracking-tight leading-[1.14]">
                {lang === 'ar' ? (
                  <>
                    ابحث عن مجموعتك. <br />
                    <span className="bg-gradient-to-r from-[#2E1A6E] via-[#6B2FA0] to-[#C4407A] dark:from-[#C084FC] dark:via-[#F472B6] dark:to-[#FB7185] bg-clip-text text-transparent">
                      عش شغفك بأمان وثقة.
                    </span>
                  </>
                ) : (
                  <>
                    Find Your Squad. <br />
                    <span className="bg-gradient-to-r from-[#2E1A6E] via-[#6B2FA0] to-[#C4407A] dark:from-[#C084FC] dark:via-[#F472B6] dark:to-[#FB7185] bg-clip-text text-transparent">
                      Play Together Safely.
                    </span>
                  </>
                )}
              </h1>

              <p className="text-base sm:text-lg text-gray-600 dark:text-[#BDB3D9] font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {lang === 'ar'
                  ? 'من مباريات البادل والجري الصباحي إلى الألعاب اللوحية والهاكاثون — مجموعات حقيقية صغيرة من 4 إلى 12 فرداً في القاهرة الكبرى. جميع الأعضاء والمنظمين موثقون بالبطاقة الشخصية والسيلفي المباشر.'
                  : 'From sunset Padel matches & morning 5K runs to strategy board games and tech meetups. Curated small groups across Cairo & Giza — 100% verified with Egyptian National ID and live biometric selfie.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <button
                  onClick={onLaunchApp}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#2E1A6E] via-[#6B2FA0] to-[#A42A9B] hover:opacity-95 text-white font-extrabold text-sm sm:text-base shadow-xl flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer"
                >
                  <Zap className="w-5 h-5 text-[#F5A524]" />
                  <span>{lang === 'ar' ? 'ابدأ الاستخدام فوراً (Web App)' : 'Launch Web App Now'}</span>
                </button>

                <a
                  href="https://squadly-api-rpe6.onrender.com/api/download/apk"
                  download="squadly-v1.1-debug.apk"
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white dark:bg-[#1B1035] hover:bg-gray-50 dark:hover:bg-[#251747] border border-purple-200 dark:border-purple-800/40 text-[#1A1033] dark:text-white font-bold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2.5 transition"
                >
                  <Download className="w-5 h-5 text-[#6B2FA0] dark:text-[#C084FC]" />
                  <span>{lang === 'ar' ? 'تحميل تطبيق أندرويد (APK)' : 'Download Android App (APK)'}</span>
                </a>
              </div>

              {/* Trust Badges Bar */}
              <div className="pt-6 border-t border-purple-100/80 dark:border-purple-900/40 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-gray-500 dark:text-[#A396C2] font-semibold">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2E9E6A] dark:text-[#4ADE80]" />
                  <span>{lang === 'ar' ? 'توثيق هوية كامل (KYC)' : '100% KYC ID Verified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#D93B3B] dark:text-[#FF6B6B]" />
                  <span>{lang === 'ar' ? 'زر نداء طوارئ SOS فوري' : 'Live SOS Emergency Shield'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#F5A524] fill-[#F5A524]" />
                  <span>{lang === 'ar' ? 'تقييم متبادل وتصنيف ثقة' : 'Mutual Rating System'}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive App Preview Frame */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm rounded-[36px] bg-[#18102E] p-3 shadow-2xl border-4 border-purple-900/40">
                {/* Phone Top Notch */}
                <div className="w-36 h-4 bg-black rounded-b-xl mx-auto mb-2" />

                {/* Inner Screen */}
                <div className="bg-[#FAF7FD] dark:bg-[#120A24] rounded-[26px] overflow-hidden p-4 space-y-3.5 border border-purple-100 dark:border-purple-900/30">
                  {/* Mock App Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6B2FA0] to-[#C4407A] text-white flex items-center justify-center font-bold text-xs">
                        YM
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-[#1A1033] dark:text-white flex items-center gap-1">
                          Yara Mostafa <CheckCircle2 className="w-3 h-3 text-[#2E9E6A] dark:text-[#4ADE80]" />
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Sheikh Zayed, Cairo</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-red-50 dark:bg-[#381014] text-[#D93B3B] dark:text-[#FF6B6B] text-[10px] font-black border border-red-200 dark:border-[#E5484D]/40">
                      SOS Active
                    </span>
                  </div>

                  {/* Mock Card */}
                  <div className="rounded-2xl p-3.5 bg-gradient-to-br from-[#2E1A6E] via-[#6B2FA0] to-[#A42A9B] text-white shadow-md">
                    <div className="flex items-center justify-between text-xs mb-1.5 opacity-90">
                      <span>🎾 Padel Social Match</span>
                      <span className="font-bold text-[#F5A524]">Confirmed</span>
                    </div>
                    <div className="font-black text-sm mb-2">The Club Padel — Court #3</div>
                    <div className="flex items-center justify-between text-[11px] opacity-90 pt-2 border-t border-white/15">
                      <span>Today • 06:30 PM</span>
                      <span>4 / 4 Confirmed</span>
                    </div>
                  </div>

                  {/* Fast Action CTA inside preview */}
                  <button
                    onClick={onLaunchApp}
                    className="w-full py-2.5 rounded-xl bg-[#2E1A6E] hover:bg-[#3D228A] text-white text-xs font-black shadow flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>{lang === 'ar' ? 'افتح التطبيق وتصفح الأنشطة' : 'Explore Cairo Activities'}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SAFETY & TRUST PILLARS */}
      <section id="features" className="py-20 bg-white dark:bg-[#120A24] border-y border-purple-100 dark:border-purple-900/40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#6B2FA0] dark:text-[#D8B4FE] bg-purple-50 dark:bg-purple-900/40 px-3.5 py-1.5 rounded-full border border-purple-100 dark:border-purple-800/40">
              {lang === 'ar' ? 'الأمان والثقة في المقام الأول' : 'Trust, Safety & Peace of Mind'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1A1033] dark:text-white mt-3">
              {lang === 'ar' ? 'لماذا سكوادلي مجتمع آمن وموثوق؟' : 'Why Squadly is Built Different.'}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-[#BDB3D9] mt-2">
              {lang === 'ar'
                ? 'أنشأنا نظام أمان متعدد الطبقات لضمان راحة وسلامة كل مشارك، خاصة السيدات والمنظمين.'
                : 'Every feature is designed from the ground up for safety, respect, and reliable small groups.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="rounded-3xl p-6 bg-[#FAF7FD] dark:bg-[#1B1035] border border-purple-100 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg transition">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E1A6E] to-[#6B2FA0] text-white flex items-center justify-center mb-5 shadow">
                <ShieldCheck className="w-6 h-6 text-[#F5A524]" />
              </div>
              <h3 className="text-lg font-black text-[#1A1033] dark:text-white mb-2">
                {lang === 'ar' ? 'توثيق الهوية والسيلفي الحي' : '100% Mandatory KYC'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#C5BADB] leading-relaxed">
                {lang === 'ar'
                  ? 'لا حسابات وهمية أو مجهولة. يُطلب من كل عضو مسح البطاقة الشخصية المصرية وسيلفي حي معتمد قبل الانضمام لأي نشاط.'
                  : 'Zero anonymous users. Every member must verify their Egyptian National ID and live biometric selfie before participating in any squad.'}
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-3xl p-6 bg-[#FAF7FD] dark:bg-[#1B1035] border border-purple-100 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg transition">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D93B3B] to-[#991B1B] text-white flex items-center justify-center mb-5 shadow">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-black text-[#1A1033] dark:text-white mb-2">
                {lang === 'ar' ? 'حماية الطوارئ الحية SOS' : 'Live SOS Emergency Shield'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#C5BADB] leading-relaxed">
                {lang === 'ar'
                  ? 'زر أمان مخصص طوال مدة النشاط ينقل فوراً إحداثيات GPS المباشرة ويُرسل رسالة SMS تلقائية لجهة اتصال الطوارئ وفريق الدعم.'
                  : 'A dedicated SOS button during every activity dispatches live GPS coordinates to moderators and your emergency contact via automated SMS.'}
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-3xl p-6 bg-[#FAF7FD] dark:bg-[#1B1035] border border-purple-100 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg transition">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E9E6A] to-[#15803D] text-white flex items-center justify-center mb-5 shadow">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-black text-[#1A1033] dark:text-white mb-2">
                {lang === 'ar' ? 'حضور بـ QR وتقييم متبادل' : 'Dynamic QR & Mutual Ratings'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#C5BADB] leading-relaxed">
                {lang === 'ar'
                  ? 'تأكيد الحضور برمز QR ديناميكي يتغير كل 60 ثانية. بعد انتهاء النشاط، يقيّم الأعضاء بعضهم بشكل مجهول للحفاظ على الاحترام.'
                  : 'Check-in is verified on-site via 60-second rotating QR codes. Post-event anonymous ratings ensure members maintain high reliability scores.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS (3 Simple Steps) */}
      <section id="how-it-works" className="py-20 bg-[#FAF7FD] dark:bg-[#0D081D] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#6B2FA0] dark:text-[#D8B4FE] bg-purple-100/70 dark:bg-purple-900/40 px-3.5 py-1.5 rounded-full border border-purple-200 dark:border-purple-800/40">
              {lang === 'ar' ? 'خطوات بسيطة' : 'Simple & Seamless'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1A1033] dark:text-white mt-3">
              {lang === 'ar' ? 'كيف تبدأ في 3 خطوات؟' : 'How Squadly Works in 3 Steps'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
            <div className="bg-white dark:bg-[#1B1035] rounded-3xl p-8 border border-purple-100 dark:border-purple-800/40 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#2E1A6E] text-white font-black text-lg flex items-center justify-center mx-auto shadow-sm">
                1
              </div>
              <h3 className="font-extrabold text-base text-[#1A1033] dark:text-white">
                {lang === 'ar' ? 'سجّل ووثّق هويتك' : 'Register & Verify'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-[#C5BADB] leading-relaxed">
                {lang === 'ar'
                  ? 'سجّل برقم موبايلك المصري ثم التقط صورة البطاقة وسيلفي حي لتحصل على شارة التوثيق البنفسجية.'
                  : 'Sign in with your Egyptian mobile, upload your National ID & quick selfie to receive the purple verified badge.'}
              </p>
            </div>

            <div className="bg-white dark:bg-[#1B1035] rounded-3xl p-8 border border-purple-100 dark:border-purple-800/40 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#6B2FA0] text-white font-black text-lg flex items-center justify-center mx-auto shadow-sm">
                2
              </div>
              <h3 className="font-extrabold text-base text-[#1A1033] dark:text-white">
                {lang === 'ar' ? 'اختر مجموعتك أو استضف' : 'Find or Host a Squad'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-[#C5BADB] leading-relaxed">
                {lang === 'ar'
                  ? 'تصفح أنشطة البادل أو الجري أو الشطرنج القريبة في منطقتك، أو انشر نشاطك الخاص وحدد العدد.'
                  : 'Browse padel matches, 5K runs, or board game sessions near you, or host your own curated small group.'}
              </p>
            </div>

            <div className="bg-white dark:bg-[#1B1035] rounded-3xl p-8 border border-purple-100 dark:border-purple-800/40 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#A42A9B] text-white font-black text-lg flex items-center justify-center mx-auto shadow-sm">
                3
              </div>
              <h3 className="font-extrabold text-base text-[#1A1033] dark:text-white">
                {lang === 'ar' ? 'التقِ واستمتع بالنشاط' : 'Show Up & Play'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-[#C5BADB] leading-relaxed">
                {lang === 'ar'
                  ? 'سجّل الحضور عبر مسح الـ QR عند الوصول، وتواصل مع مجموعتك بكل أمان وراحة.'
                  : 'Scan the dynamic QR check-in on-site, play together, make new hobby friends, and share ratings.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. EXPLORE HOBBIES & LIVE SQUADS */}
      <section id="hobbies" className="py-20 bg-white dark:bg-[#120A24] border-t border-purple-100 dark:border-purple-900/40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
            <div>
              <h2 className="text-3xl font-black text-[#1A1033] dark:text-white">
                {lang === 'ar' ? 'أنشطة ومجموعات مباشرة' : 'Live Curated Squads'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-[#BDB3D9] mt-1">
                {lang === 'ar' ? 'استكشف بعض الأنشطة المتاحة حالياً في القاهرة والجيزة' : 'A sample of squads happening this week in Greater Cairo'}
              </p>
            </div>

            <button
              onClick={onLaunchApp}
              className="px-5 py-2.5 rounded-full bg-purple-50 dark:bg-[#1B1035] hover:bg-purple-100 dark:hover:bg-[#251747] text-[#6B2FA0] dark:text-[#C084FC] border border-purple-100 dark:border-purple-800/40 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span>{lang === 'ar' ? 'عرض كل الأنشطة في التطبيق' : 'See All Squads in App'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
            {hobbies.map(h => (
              <button
                key={h.key}
                onClick={() => setSelectedHobby(h.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  selectedHobby === h.key
                    ? 'bg-[#2E1A6E] dark:bg-[#6B2FA0] text-white shadow-md'
                    : 'bg-gray-100 dark:bg-[#1B1035] hover:bg-gray-200 dark:hover:bg-[#251747] text-gray-700 dark:text-[#DCD4F2] border border-transparent dark:border-purple-900/30'
                }`}
              >
                <span>{h.icon || ''}</span>
                <span>{h.name}</span>
              </button>
            ))}
          </div>

          {/* Sample Activity Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredActivities.map((act, i) => (
              <div key={i} className="rounded-3xl p-5 bg-[#FAF7FD] dark:bg-[#1B1035] border border-purple-100 dark:border-purple-800/40 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-600 transition shadow-xs">
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-bold text-[#6B2FA0] dark:text-[#C084FC] flex items-center gap-1">
                      {act.icon} {act.hobby}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-[#2E1A6E] dark:text-[#D8B4FE] font-extrabold text-[10px]">
                      {act.gender}
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-[#1A1033] dark:text-white mb-2">{act.title}</h4>
                  <div className="space-y-1.5 text-xs text-gray-500 dark:text-[#A396C2] mb-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-purple-400" />
                      <span>{act.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-purple-400" />
                      <span className="truncate">{act.venue}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-purple-100/70 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-400 block font-semibold">{lang === 'ar' ? 'التكلفة' : 'Cost'}</span>
                    <span className="text-xs font-black text-[#2E9E6A] dark:text-[#4ADE80]">{act.fee}</span>
                  </div>
                  <button
                    onClick={onLaunchApp}
                    className="px-4 py-2 rounded-full bg-[#2E1A6E] dark:bg-[#6B2FA0] hover:bg-[#3D228A] dark:hover:bg-[#7D38BC] text-white text-xs font-bold transition cursor-pointer"
                  >
                    {lang === 'ar' ? 'انضم للمجموعة' : 'Join Squad'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. DOWNLOAD & LAUNCH SECTION */}
      <section id="download" className="py-20 bg-gradient-to-br from-[#1B1035] via-[#2E1A6E] to-[#6B2FA0] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C4407A]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#F5A524] bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20">
            {lang === 'ar' ? 'جاهز للانطلاق؟' : 'Ready to find your squad?'}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mt-4 max-w-2xl mx-auto leading-tight">
            {lang === 'ar' ? 'ابدأ تجربتك الآن على الويب أو الأندرويد' : 'Start Playing Today on Web or Android'}
          </h2>
          <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto mt-3">
            {lang === 'ar'
              ? 'تطبيق الويب وتطبيق الأندرويد متصلان بنفس قاعدة البيانات السحابية الحية.'
              : 'Our Web App and native Android App share the exact same live cloud database and verified network.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#F5A524] hover:bg-[#E0941B] text-[#1A1033] font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
            >
              <Zap className="w-5 h-5" />
              <span>{lang === 'ar' ? 'افتح تطبيق الويب (مباشرة بالمتصفح)' : 'Open Web App (In Browser)'}</span>
            </button>

            <a
              href="https://squadly-api-rpe6.onrender.com/api/download/apk"
              download="squadly-v1.1-debug.apk"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-base flex items-center justify-center gap-2 transition"
            >
              <Download className="w-5 h-5 text-[#F5A524]" />
              <span>{lang === 'ar' ? 'تحميل تطبيق الأندرويد (APK)' : 'Download Android App (APK)'}</span>
            </a>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="bg-[#0B0617] text-gray-400 py-12 border-t border-purple-900/40 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-purple-900/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E1A6E] to-[#C4407A] flex items-center justify-center text-white font-black text-sm">
                S<span className="text-[#F5A524]">.</span>
              </div>
              <span className="text-white font-black text-lg">Squadly<span className="text-[#F5A524]">.</span></span>
              <span className="text-gray-500 text-xs">Find your squad. Play together.</span>
            </div>

            <div className="flex items-center gap-6">
              <button onClick={onLaunchApp} className="hover:text-white transition">
                {lang === 'ar' ? 'تشغيل التطبيق' : 'Launch App'}
              </button>
              <button onClick={onOpenAdmin} className="hover:text-white transition">
                {lang === 'ar' ? 'بوابة الإدارة (Admin)' : 'Admin Portal'}
              </button>
              <a href="tel:122" className="hover:text-red-400 transition text-red-400/90 font-bold">
                Police 122
              </a>
              <a href="tel:123" className="hover:text-red-400 transition text-red-400/90 font-bold">
                Ambulance 123
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-gray-500 text-[11px]">
            <div>
              &copy; {new Date().getFullYear()} Squadly Inc. Greater Cairo &amp; Giza, Egypt. All rights reserved.
            </div>
            <div>
              Designed for verified sports, social hobbies &amp; community safety.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

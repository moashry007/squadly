export type Lang = 'en' | 'ar';

export const MESSAGE_REGISTRY: Record<string, { en: string; ar: string }> = {
  // Error Messages (Section 10.1)
  'ERR-001': {
    en: 'Enter a valid Egyptian mobile number (e.g. 010 1234 5678).',
    ar: 'أدخل رقم هاتف مصري صحيح (مثال: 01012345678).',
  },
  'ERR-002': {
    en: 'The code is incorrect. Please check and try again.',
    ar: 'الرمز غير صحيح. يرجى التحقق والمحاولة مرة أخرى.',
  },
  'ERR-003': {
    en: 'This code has expired. Request a new one.',
    ar: 'انتهت صلاحية هذا الرمز. اطلب رمزاً جديداً.',
  },
  'ERR-004': {
    en: 'Too many attempts. Try again in 30 minutes.',
    ar: 'محاولات كثيرة جداً. حاول مرة أخرى بعد 30 دقيقة.',
  },
  'ERR-005': {
    en: 'This number is already registered. Log in instead.',
    ar: 'هذا الرقم مسجل بالفعل. قم بتسجيل الدخول بدلاً من ذلك.',
  },
  'ERR-006': {
    en: 'Squadly is for adults 18 and over.',
    ar: 'تطبيق Squadly مخصص للبالغين 18 عاماً فأكثر فقط.',
  },
  'ERR-007': {
    en: 'This field is required.',
    ar: 'هذا الحقل مطلوب.',
  },
  'ERR-008': {
    en: 'Enter a valid email address.',
    ar: 'أدخل عنوان بريد إلكتروني صحيح.',
  },
  'ERR-009': {
    en: 'This email is already used by another account.',
    ar: 'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.',
  },
  'ERR-010': {
    en: 'Use a clear photo showing only your face.',
    ar: 'استخدم صورة واضحة يظهر فيها وجهك فقط بدون فلاتر أو أشخاص آخرين.',
  },
  'ERR-011': {
    en: 'This document is already linked to another account. Contact support if this is a mistake.',
    ar: 'وثيقة الهوية هذه مرتبطة بحساب آخر بالفعل. تواصل مع الدعم إذا كان هناك خطأ.',
  },
  'ERR-012': {
    en: "You've reached the maximum verification attempts. Our team will review your case.",
    ar: 'لقد وصلت للحد الأقصى لمحاولات التوثيق. سيقوم فريقنا بمراجعة حالتك.',
  },
  'ERR-013': {
    en: "Payment didn't go through. You were not charged. Please try again.",
    ar: 'لم تتم عملية الدفع ولم يتم خصم أي مبلغ. يرجى المحاولة مرة أخرى.',
  },
  'ERR-014': {
    en: 'This promo code is invalid or expired.',
    ar: 'كود الخصم غير صالح أو منتهي الصلاحية.',
  },
  'ERR-016': {
    en: 'Verify your identity first to do this.',
    ar: 'يرجى توثيق هويتك أولاً للقيام بذلك.',
  },
  'ERR-017': {
    en: 'You need an active membership to join or create activities.',
    ar: 'تحتاج إلى عضوية سنوية نشطة للانضمام للأنشطة أو تنظيمها.',
  },
  'ERR-018': {
    en: 'This activity is restricted by gender type.',
    ar: 'هذا النشاط مخصص لفئة محددة فقط.',
  },
  'ERR-019': {
    en: 'Your age is outside the age range set for this activity.',
    ar: 'عمرك خارج الفئة العمرية المحددة لهذا النشاط.',
  },
  'ERR-020': {
    en: "This clashes with another activity you're part of (30-min buffer required).",
    ar: 'يتعارض هذا الموعد مع نشاط آخر تشارك فيه (يلزم فاصل 30 دقيقة).',
  },
  'ERR-021': {
    en: 'You can hold up to 5 upcoming bookings at a time.',
    ar: 'يمكنك الاحتفاظ بـ 5 حجوزات قادمة كحد أقصى في نفس الوقت.',
  },
  'ERR-023': {
    en: 'This activity is no longer available.',
    ar: 'هذا النشاط لم يعد متاحاً.',
  },
  'ERR-024': {
    en: 'Your account is suspended. You can browse but not join or organize.',
    ar: 'حسابك معلق مؤقتاً. يمكنك التصفح فقط دون الانضمام أو التنظيم.',
  },
  'ERR-025': {
    en: 'Your organizing rights are currently suspended.',
    ar: 'صلاحية تنظيم الأنشطة معلقة حالياً لحسابك.',
  },
  'ERR-026': {
    en: 'You can have up to 3 active activities at a time.',
    ar: 'يمكنك تنظيم 3 أنشطة نشطة كحد أقصى في نفس الوقت.',
  },
  'ERR-027': {
    en: 'Activities must start between 2 hours and 30 days from now.',
    ar: 'يجب أن يبدأ النشاط بين ساعتين و30 يوماً من الآن.',
  },
  'ERR-028': {
    en: 'Activities must start after 6:00 AM and end by 10:00 PM.',
    ar: 'يجب أن تبدأ الأنشطة بعد 6:00 صباحاً وتنتهي قبل 10:00 مساءً (طوال العام).',
  },
  'ERR-029': {
    en: 'Total slots must be within the hobby minimum and maximum range.',
    ar: 'عدد الأماكن يجب أن يكون ضمن الحد الأدنى والأقصى المسموح للهواية.',
  },
  'ERR-030': {
    en: "You can't create an activity of this gender type.",
    ar: 'لا يمكنك إنشاء نشاط من هذا النوع.',
  },
  'ERR-031': {
    en: "Changes aren't allowed less than 3 hours before the start. You can cancel instead.",
    ar: 'لا يُسمح بالتعديلات قبل أقل من 3 ساعات من البداية. يمكنك الإلغاء بدلاً من ذلك.',
  },
  'ERR-032': {
    en: "Slots can't be fewer than the people already confirmed.",
    ar: 'لا يمكن تقليل الأماكن لأقل من عدد المؤكدين حالياً.',
  },
  'ERR-033': {
    en: "For everyone's safety, phone numbers, emails, social handles and links aren't allowed.",
    ar: 'لسلامة الجميع، يُمنع مشاركة أرقام الهواتف أو الإيميلات أو حسابات التواصل أو الروابط.',
  },
  'ERR-034': {
    en: 'This chat is closed.',
    ar: 'هذه المحادثة مغلقة.',
  },
  'ERR-037': {
    en: 'Please describe the issue.',
    ar: 'يرجى كتابة تفاصيل المشكلة.',
  },
  'ERR-042': {
    en: 'No account found with this number. Create one?',
    ar: 'لا يوجد حساب مسجل بهذا الرقم. هل ترغب في إنشاء حساب؟',
  },
  'ERR-043': {
    en: "This account can't be used. Contact support for details.",
    ar: 'لا يمكن استخدام هذا الحساب. تواصل مع الدعم للتفاصيل.',
  },
  'ERR-044': {
    en: 'This activity is being updated. Try again shortly.',
    ar: 'يتم تحديث تفاصيل هذا النشاط حالياً. حاول بعد قليل.',
  },
  'ERR-048': {
    en: 'Voice notes can be up to 60 seconds.',
    ar: 'الرسائل الصوتية بحد أقصى 60 ثانية.',
  },
  'ERR-049': {
    en: "You can't send a request for this activity.",
    ar: 'لا يمكنك إرسال طلب انضمام لهذا النشاط.',
  },
  'ERR-050': {
    en: "Minimum slots can't be less than 3.",
    ar: 'الحد الأدنى للأماكن لا يمكن أن يقل عن 3 أشخاص أبداً.',
  },
  'ERR-051': {
    en: 'Fee must be between 1 and 5,000 EGP.',
    ar: 'رسوم النشاط يجب أن تكون بين 1 و 5000 جنيه.',
  },
  'ERR-054': {
    en: 'Emergency contact must have a different number from yours.',
    ar: 'يجب أن يكون رقم الطوارئ مختلفاً عن رقم هاتفك الشخصي.',
  },
  'ERR-056': {
    en: 'Verify your email first.',
    ar: 'يرجى تأكيد بريدك الإلكتروني أولاً.',
  },
  'ERR-057': {
    en: 'Your membership ends before this activity. Renew to continue.',
    ar: 'عضويتك تنتهي قبل موعد هذا النشاط. يرجى التجديد للمتابعة.',
  },
  'ERR-058': {
    en: "This activity isn't available to you.",
    ar: 'هذا النشاط غير متاح لك.',
  },
  'ERR-059': {
    en: 'The waitlist is full.',
    ar: 'قائمة الانتظار ممتلئة.',
  },
  'ERR-061': {
    en: 'Minimum to run must be at least 3 and not more than total slots.',
    ar: 'الحد الأدنى لإقامة النشاط يجب أن يكون 3 على الأقل ولا يتجاوز إجمالي الأماكن.',
  },
  'ERR-062': {
    en: 'The activity is full now. You can join the waitlist.',
    ar: 'النشاط مكتمل العدد الآن. يمكنك الانضمام لقائمة الانتظار.',
  },
  'ERR-064': {
    en: 'Squadly hobbies need groups of at least 3 people.',
    ar: 'هوايات Squadly تتطلب مجموعات من 3 أشخاص على الأقل.',
  },

  // Information Messages (Section 10.3)
  'INF-001': {
    en: 'Create an account to see details and join activities.',
    ar: 'أنشئ حساباً لعرض كافة التفاصيل والانضمام للأنشطة.',
  },
  'INF-002': {
    en: 'We sent a 6-digit verification code to your mobile (Demo OTP: 123456).',
    ar: 'أرسلنا رمز تحقق مكون من 6 أرقام لهاتفك (رمز التجربة: 123456).',
  },
  'INF-003': {
    en: "Thanks! We're reviewing your identity — usually within 48 hours.",
    ar: 'شكراً لك! نقوم بمراجعة توثيق هويتك — عادةً خلال 48 ساعة.',
  },
  'INF-005': {
    en: 'Welcome to Squadly! Your annual membership is now active.',
    ar: 'مرحباً بك في Squadly! عضويتك السنوية مفعلة الآن.',
  },
  'INF-006': {
    en: 'Your first activity is on us — no membership needed!',
    ar: 'نشاطك الأول مجاني علينا — لا يلزم اشتراك للنشاط الأول!',
  },
  'INF-007': {
    en: "Squadly isn't in your city yet (Release 1 serves Greater Cairo). You've been added to the city waitlist!",
    ar: 'خدمة Squadly متاحة حالياً في القاهرة الكبرى فقط. تمت إضافتك لقائمة انتظار مدينتك!',
  },
  'INF-008': {
    en: 'Request sent! The organizer will respond soon.',
    ar: 'تم إرسال طلبك! سيرد المنظم قريباً.',
  },
  'INF-009': {
    en: "You're in! See you at the venue.",
    ar: 'أنت معنا! نراك في مكان النشاط.',
  },
  'INF-010': {
    en: "You've been added to the waitlist.",
    ar: 'تمت إضافتك إلى قائمة الانتظار.',
  },
  'INF-011': {
    en: 'Submitted for Moderator review (probation activity for new organizers — SLA 24h).',
    ar: 'تم إرسال النشاط لمراجعة المشرفين (أول 3 أنشطة للمنظمين الجدد — خلال 24 ساعة).',
  },
  'INF-012': {
    en: 'Your activity is live!',
    ar: 'نشاطك متاح ومباشر الآن!',
  },
  'INF-013': {
    en: 'The group chat opens automatically when at least 3 people are confirmed.',
    ar: 'تُفتح المحادثة الجماعية تلقائياً عند تأكيد 3 مشاركين على الأقل.',
  },
  'INF-017': {
    en: 'Report received. Thank you for keeping Squadly safe.',
    ar: 'تم استلام البلاغ. شكراً لحرصك على أمان مجتمع Squadly.',
  },
  'INF-018': {
    en: 'Thanks for rating your squad!',
    ar: 'شكراً لتقييمك!',
  },
  'INF-019': {
    en: 'Waiting for confirmed participants to respond to your changes.',
    ar: 'في انتظار موافقة المشاركين المؤكدين على التعديلات المقترحة.',
  },
  'INF-022': {
    en: 'Safety first: group meetups only (min 3). Personal numbers stay private — chat opens after you join.',
    ar: 'السلامة أولاً: لقاءات جماعية فقط (3 على الأقل). الأرقام الشخصية تظل خاصة وتُفتح المحادثة بعد الانضمام.',
  },
  'INF-024': {
    en: 'Full name, date of birth and gender are locked after verification. Contact support to change them.',
    ar: 'الاسم الكامل وتاريخ الميلاد والنوع مقفلة بعد التوثيق. تواصل مع الدعم لتعديلها.',
  },
  'INF-025': {
    en: 'Venue submitted for Moderator review (usually within 48 hours).',
    ar: 'تم إرسال المكان المقترح للمراجعة (خلال 48 ساعة).',
  },
  'INF-026': {
    en: 'Thanks for your hobby suggestion! Sent to Super Admin inbox.',
    ar: 'شكراً لاقتراحك! تم إرسال الهواية المقترحة للإدارة.',
  },
  'INF-027': {
    en: 'Checked in! Identity verified at the venue. Have a great game!',
    ar: 'تم تسجيل الحضور ومطابقة الهوية بنجاح! وقتاً ممتعاً!',
  },
  'INF-028': {
    en: "Squadly Moderators and your emergency contact have been alerted with your live location. If you're in immediate danger, call 122.",
    ar: 'تم إرسال تنبيه عاجل لمشرفي Squadly وجهة اتصال الطوارئ مع موقعك المباشر. في حالة الخطر الفوري اتصل بـ 122.',
  },
  'INF-032': {
    en: "Dispute sent. We'll reply within 72 hours.",
    ar: 'تم إرسال الاعتراض. سنرد عليك خلال 72 ساعة.',
  },
  'INF-033': {
    en: 'Your account has been scheduled for deletion.',
    ar: 'تم حذف حسابك بنجاح.',
  },
  'INF-034': {
    en: 'Profile saved and email verified.',
    ar: 'تم حفظ الملف الشخصي وتأكيد البريد الإلكتروني.',
  },
  'INF-035': {
    en: "The fee is paid in cash at the venue. Squadly doesn't collect or refund activity fees in Release 1.",
    ar: 'تُدفع رسوم النشاط نقداً في المكان. لا يقوم Squadly بتحصيل أو استرداد رسوم الأنشطة في الإصدار الأول.',
  },
};

export function tMsg(code: string, lang: Lang = 'en', params?: Record<string, string | number>): string {
  const entry = MESSAGE_REGISTRY[code];
  if (!entry) return code;
  let str = entry[lang] || entry.en;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}

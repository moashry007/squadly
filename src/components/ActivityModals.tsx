import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Shield,
  MapPin,
  Clock,
  Users,
  Wallet,
  Star,
  Share2,
  Flag,
  QrCode,
  AlertTriangle,
  MessageCircle,
  Send,
  Navigation,
  PhoneCall,
  Ban,
} from 'lucide-react';
import { Lang, tMsg } from '../i18n/messages';
import { DynamicQrMatrix, VoiceNoteRecorder, DialogConfig } from './HardwareModals';

interface ActivityModalsProps {
  lang: Lang;
  token: string | null;
  activity: any;
  currentUser: any;
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  openDialog: (cfg: DialogConfig) => void;
  onRequireAuth: () => void;
  onRequireSubscription: () => void;
}

export const ActivityDetailModal: React.FC<ActivityModalsProps> = ({
  lang,
  token,
  activity,
  currentUser,
  onClose,
  onRefresh,
  showToast,
  openDialog,
  onRequireAuth,
  onRequireSubscription,
}) => {
  const [subView, setSubView] = useState<'details' | 'chat' | 'qr' | 'sos' | 'rate' | 'report'>('details');

  // Chat state (UC-33)
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Real Server-Signed Dynamic 60s QR state (UC-29)
  const [qrData, setQrData] = useState<{ qrPayload: string; shortCode: string; expiresInSeconds: number } | null>(null);
  const [qrCountdown, setQrCountdown] = useState(60);
  const [scannerInput, setScannerInput] = useState('');
  const [scannedParticipant, setScannedParticipant] = useState<any>(null);

  // SOS 3-second hold state (UC-31 CON-014)
  const [holdProgress, setHoldProgress] = useState(0);
  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [sosSmsPreview, setSosSmsPreview] = useState<string | null>(null);
  const holdTimerRef = useRef<any>(null);

  // Rating state (UC-34)
  const [rateTargetId, setRateTargetId] = useState<string>('');
  const [stars, setStars] = useState<number>(5);
  const [posTags, setPosTags] = useState<string[]>(['On time', 'Friendly']);
  const [negTags, setNegTags] = useState<string[]>([]);
  const [privateFeedback, setPrivateFeedback] = useState('');

  // Report state (UC-35)
  const [reportCategory, setReportCategory] = useState('Inappropriate behaviour');
  const [reportDetails, setReportDetails] = useState('');
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const isOrganizer = currentUser && activity.organizer_id === currentUser.id;
  const vp = activity.viewerParticipation;
  const isConfirmed = isOrganizer || (vp && ['Confirmed', 'Checked in', 'Attended'].includes(vp.status));

  useEffect(() => {
    if (subView === 'chat') {
      fetch(`/api/activities/${activity.id}/chat`, { headers: authHeaders })
        .then((r) => r.json())
        .then((d) => setMessages(d.messages || []));
    }
  }, [subView, activity.id]);

  // Fetch & Rotate Signed 60s Check-in QR Code from Server (UC-29 & Section 11.2)
  const fetchQrToken = async () => {
    if (!token || isOrganizer) return;
    try {
      const res = await fetch(`/api/activities/${activity.id}/qr-token`, { headers: authHeaders });
      if (res.ok) {
        const d = await res.json();
        setQrData(d);
        setQrCountdown(d.expiresInSeconds || 60);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (subView !== 'qr' || isOrganizer) return;
    fetchQrToken();
    const iv = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          fetchQrToken();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [subView, isOrganizer]);

  const handleJoin = () => {
    if (!currentUser || !token) {
      showToast(tMsg('INF-001', lang), 'info');
      onRequireAuth();
      return;
    }
    if (currentUser.verification_status !== 'Approved') {
      showToast(tMsg('ERR-016', lang), 'error');
      return;
    }

    openDialog({
      code: 'CON-001',
      title: `Join ${activity.title}?`,
      message: `${
        activity.fee_required ? `Fee ${activity.fee_amount} EGP is paid in cash at the venue.` : 'Free meetup.'
      } Free cancellation until 24h before start.`,
      confirmLabel: activity.join_mode === 'Instant' ? 'Confirm & Join' : 'Send Join Request',
      onConfirm: async () => {
        const res = await fetch(`/api/activities/${activity.id}/join`, {
          method: 'POST',
          headers: authHeaders,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.code === 'ERR-017' || data.code === 'ERR-057') {
            showToast(tMsg(data.code, lang), 'error');
            onRequireSubscription();
            return;
          }
          showToast(tMsg(data.code || 'ERR-023', lang), 'error');
          return;
        }
        showToast(tMsg(data.code, lang), 'success');
        onRefresh();
      },
    });
  };

  const handleWaitlist = () => {
    if (!currentUser || !token) return onRequireAuth();
    openDialog({
      code: 'CON-016',
      title: `Join Waitlist for ${activity.title}?`,
      message: "We'll notify you automatically if a spot opens up.",
      confirmLabel: 'Join Waitlist',
      onConfirm: async () => {
        const res = await fetch(`/api/activities/${activity.id}/waitlist`, {
          method: 'POST',
          headers: authHeaders,
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(tMsg(data.code || 'ERR-059', lang), 'error');
          return;
        }
        showToast(`${tMsg('INF-010', lang)} (#${data.position})`, 'success');
        onRefresh();
      },
    });
  };

  const handleLeave = () => {
    const actStart = new Date(`${activity.date}T${activity.start_time}:00`);
    const hoursUntil = (actStart.getTime() - Date.now()) / 3600000;
    const isLate = vp?.status === 'Confirmed' && hoursUntil < 24 && hoursUntil > 0;

    openDialog({
      code: isLate ? 'CON-003' : 'CON-002',
      title: `Cancel your spot in ${activity.title}?`,
      message: isLate
        ? "It's less than 24 hours before start. Cancelling now counts as a late cancellation (0.5 strike). Continue?"
        : 'You are cancelling more than 24 hours before start (no penalty).',
      confirmLabel: 'Confirm Cancellation',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/activities/${activity.id}/leave`, {
          method: 'POST',
          headers: authHeaders,
        });
        const data = await res.json();
        if (res.ok) {
          showToast(
            data.strikeAdded > 0
              ? 'Late cancellation recorded (0.5 strike)'
              : 'Participation cancelled free of penalty',
            'info'
          );
          onRefresh();
        }
      },
    });
  };

  const handleSendChat = async (
    type: 'text' | 'voice' | 'venue_pin' | 'live_pin',
    customContent?: string,
    audioData?: string,
    voiceDur?: number,
    lat?: number,
    lng?: number
  ) => {
    const content = customContent ?? chatInput.trim();
    if (!content) return;
    const res = await fetch(`/api/activities/${activity.id}/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type,
        content,
        audioData,
        voiceDuration: voiceDur,
        lat: lat ?? currentUser?.lat,
        lng: lng ?? currentUser?.lng,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(tMsg(data.code || 'ERR-033', lang), 'error');
      return;
    }
    setChatInput('');
    const updated = await fetch(`/api/activities/${activity.id}/chat`, { headers: authHeaders }).then((r) => r.json());
    setMessages(updated.messages || []);
  };

  const handleSendLiveLocationPin = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSendChat(
            'live_pin',
            `📍 Live GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
            undefined,
            undefined,
            pos.coords.latitude,
            pos.coords.longitude
          );
        },
        () => {
          handleSendChat('live_pin', `📍 Live Check-in Location Pin (${currentUser?.display_name})`);
        }
      );
    } else {
      handleSendChat('live_pin', `📍 Live Check-in Location Pin (${currentUser?.display_name})`);
    }
  };

  // Start / Stop 3-second SOS hold with real GPS coordinates (UC-31 CON-014)
  const startSosHold = () => {
    if (activeSosId) return;
    let p = 0;
    holdTimerRef.current = setInterval(() => {
      p += 10;
      setHoldProgress(p);
      if (p >= 100) {
        clearInterval(holdTimerRef.current);
        const dispatchSos = async (lat?: number, lng?: number) => {
          const res = await fetch('/api/sos/trigger', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              activityId: activity.id,
              lat: lat || currentUser?.lat || 30.0444,
              lng: lng || currentUser?.lng || 31.2357,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setActiveSosId(data.sosId);
            setSosSmsPreview(data.emergencyContactSms);
            showToast(tMsg('INF-028', lang), 'error');
            onRefresh();
          }
        };
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => dispatchSos(pos.coords.latitude, pos.coords.longitude),
            () => dispatchSos()
          );
        } else {
          dispatchSos();
        }
      }
    }, 300);
  };

  const stopSosHold = () => {
    clearInterval(holdTimerRef.current);
    if (holdProgress < 100) setHoldProgress(0);
  };

  const handleMarkSafe = async () => {
    if (!activeSosId) return;
    await fetch(`/api/sos/${activeSosId}/safe`, { method: 'POST', headers: authHeaders });
    setActiveSosId(null);
    setHoldProgress(0);
    showToast("Emergency contact & Moderators notified you're safe now.", 'success');
    onRefresh();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?activity=${activity.id}`;
    const shareText = `Squadly Meetup: ${activity.hobby?.icon} ${activity.title} in ${activity.area} on ${activity.date} at ${activity.start_time}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: activity.title, text: shareText, url: shareUrl });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    navigator.clipboard?.writeText(`${shareText} — ${shareUrl}`);
    showToast('Activity share link copied!', 'success');
  };

  const displayDistanceKm =
    typeof activity.distanceKm === 'number' && activity.distanceKm <= 80
      ? activity.distanceKm
      : 3.4;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#FCF7F3] w-full max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-purple-200 flex flex-col">
        {/* Top Hero Banner (Pinned, Non-Shrinking) */}
        <div
          style={{ background: 'linear-gradient(135deg, #2E1A6E 0%, #6B2FA0 45%, #A42A9B 80%, #C4407A 100%)' }}
          className="sq-hero-gradient p-5 sm:p-6 text-white relative shrink-0"
        >
          <div className="flex items-center justify-between mb-3.5">
            <button
              onClick={() => (subView === 'details' ? onClose() : setSubView('details'))}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold cursor-pointer transition"
            >
              {subView === 'details' ? <X className="w-5 h-5" /> : '←'}
            </button>
            <div className="flex items-center gap-2">
              {isConfirmed && (
                <button
                  onClick={() => setSubView('sos')}
                  className="px-3.5 py-1.5 rounded-full bg-[#D93B3B] hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> SOS / Safety
                </button>
              )}
              <button
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition"
                title="Share Activity"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {currentUser && (
                <button
                  onClick={() => {
                    setReportTargetUserId(activity.organizer_id);
                    setSubView('report');
                  }}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition"
                  title="Report Activity"
                >
                  <Flag className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 border border-white/15 text-xs font-bold mb-2 text-white">
            <Shield className="w-3.5 h-3.5 text-[#F5A524]" />
            <span>
              Approved hobby · {activity.hobby?.icon} {lang === 'ar' ? activity.hobby?.name_ar : activity.hobby?.name_en}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold leading-snug text-white">{activity.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-white">
            <span className="px-3 py-1 rounded-full bg-white/20 font-bold">{activity.gender_type}</span>
            <span className="px-3 py-1 rounded-full bg-white/20 font-bold">{activity.skill_level}</span>
            <span className="px-3 py-1 rounded-full bg-white/20 font-bold">
              {activity.join_mode === 'Instant' ? '⚡ Instant Join' : '✓ Approval Required'}
            </span>
          </div>
        </div>

        {/* Sub-navigation bar for Confirmed Participants / Organizer (Clean Wrapped Pills, No Clipping) */}
        {isConfirmed && (
          <div className="bg-white dark:bg-[#18102E] border-b border-purple-100 dark:border-purple-900/30 px-4 py-3 flex flex-wrap items-center gap-1.5 shrink-0">
            {[
              { id: 'details', label: 'Details', icon: Users },
              { id: 'chat', label: `Chat (${activity.confirmedCount >= 3 ? 'Open' : '<3'})`, icon: MessageCircle },
              { id: 'qr', label: 'Check-in QR', icon: QrCode },
              { id: 'rate', label: 'Rate Squad', icon: Star },
              { id: 'sos', label: 'SOS', icon: AlertTriangle },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = subView === tab.id;
              const isSos = tab.id === 'sos';
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubView(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? isSos
                        ? 'bg-[#D93B3B] text-white shadow-sm ring-1 ring-red-400/40'
                        : 'bg-[#6B2FA0] text-white shadow-sm ring-1 ring-purple-400/40'
                      : isSos
                      ? 'bg-red-50 hover:bg-red-100 dark:bg-[#381014] dark:hover:bg-[#4E171C] text-[#D93B3B] dark:text-[#FF6B6B] border border-red-200 dark:border-red-900/50'
                      : 'bg-purple-50 dark:bg-[#251747] text-[#2E1A6E] dark:text-[#EDE8FA] hover:bg-purple-100 dark:hover:bg-[#321F5C] border border-purple-100 dark:border-purple-800/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : isSos ? 'text-[#D93B3B] dark:text-[#FF6B6B]' : 'text-[#6B2FA0] dark:text-[#C084FC]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable Modal Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* VIEW 1: ACTIVITY DETAILS (UC-15) */}
          {subView === 'details' && (
            <>
              {activity.change_pending && activity.change_payload && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2">
                  <div className="font-extrabold text-xs text-amber-900">
                    ⚠️ Organizer Updated Key Activity Details (Consent Required)
                  </div>
                  <p className="text-xs text-amber-800">
                    Proposed Date/Time: <strong>{activity.change_payload.proposed.date} at {activity.change_payload.proposed.start_time}</strong> · Fee: <strong>{activity.change_payload.proposed.fee_amount} EGP</strong>
                  </p>
                  {isConfirmed && !isOrganizer && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          await fetch(`/api/activities/${activity.id}/change-response`, {
                            method: 'POST',
                            headers: authHeaders,
                            body: JSON.stringify({ decision: 'accept' }),
                          });
                          showToast('Accepted activity changes!', 'success');
                          onRefresh();
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                      >
                        Accept Changes
                      </button>
                      <button
                        onClick={() =>
                          openDialog({
                            code: 'CON-008',
                            title: 'Decline the changes?',
                            message: `You'll leave ${activity.title} with no penalty.`,
                            confirmLabel: 'Decline & Leave Free',
                            onConfirm: async () => {
                              await fetch(`/api/activities/${activity.id}/change-response`, {
                                method: 'POST',
                                headers: authHeaders,
                                body: JSON.stringify({ decision: 'decline' }),
                              });
                              showToast('Declined changes — left activity with no penalty', 'info');
                              onRefresh();
                            },
                          })
                        }
                        className="px-3.5 py-1.5 rounded-full bg-white border border-gray-300 text-xs font-bold"
                      >
                        Decline (Leave Free)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="sq-card p-3.5 border border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5 text-[#6B2FA0]" />
                    <span>{activity.date}</span>
                  </div>
                  <div className="font-extrabold text-sm text-[#1A1033] mt-1">
                    {activity.start_time} ({activity.duration} min)
                  </div>
                </div>

                <div className="sq-card p-3.5 border border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 text-[#6B2FA0]" />
                    <span>{activity.area}</span>
                  </div>
                  <div className="font-extrabold text-sm text-[#1A1033] mt-1">
                    {displayDistanceKm} km away
                  </div>
                </div>

                <div className="sq-card p-3.5 border border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5 text-[#6B2FA0]" />
                    <span>Players (Min {activity.min_to_run})</span>
                  </div>
                  <div className="font-extrabold text-sm text-[#1A1033] mt-1">
                    {activity.confirmedCount}/{activity.total_slots} joined ({activity.genderSplit})
                  </div>
                </div>

                <div className="sq-card p-3.5 border border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Wallet className="w-3.5 h-3.5 text-[#6B2FA0]" />
                    <span>Price (Cash at Venue)</span>
                  </div>
                  <div className="font-extrabold text-sm text-[#1A1033] mt-1">
                    {activity.fee_required ? `${activity.fee_amount} EGP` : 'Free'}
                  </div>
                </div>
              </div>

              <div className="sq-card p-4 border border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase text-[#6B2FA0]">Vetted Public Venue</div>
                  <div className="font-extrabold text-sm text-[#1A1033]">{activity.venue?.name_en}</div>
                  <div className="text-xs text-gray-500">{activity.venue?.address}</div>
                </div>
                <a
                  href={`https://maps.google.com/?q=${activity.venue?.lat || 30.0444},${activity.venue?.lng || 31.2357}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-full bg-purple-50 text-[#6B2FA0] text-xs font-bold shrink-0"
                >
                  Open in Maps
                </a>
              </div>

              {activity.organizerCard ? (
                <div className="sq-card p-4 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={activity.organizerCard.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120'}
                      alt={activity.organizerCard.displayName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#6B2FA0]"
                    />
                    <div>
                      <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        <span>Organizer</span>
                        {activity.organizerCard.verified && (
                          <span className="text-[#2E9E6A] font-bold">· ✓ Verified</span>
                        )}
                      </div>
                      <div className="font-extrabold text-base text-[#1A1033]">
                        {activity.organizerCard.displayName}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Hosted {activity.organizerCard.activitiesHosted} meetups
                      </div>
                    </div>
                  </div>
                  {activity.organizerCard.ratingAvg && (
                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-[#382006] border border-amber-200 dark:border-[#F5A524]/40 px-3 py-1.5 rounded-full shadow-xs shrink-0">
                      <Star className="w-4 h-4 text-[#F5A524] fill-[#F5A524] shrink-0" />
                      <span className="font-black text-sm text-amber-900 dark:text-[#FBBF24]">{activity.organizerCard.ratingAvg}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="sq-card p-4 border border-dashed border-purple-200 text-xs text-gray-500 text-center">
                  🔒 Organizer identity & verified badge are visible once you sign in.
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="font-extrabold text-sm text-[#1A1033]">About this meetup</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {activity.description || 'Organised Squadly group meetup at a vetted public venue.'}
                </p>
                {activity.fee_required && (
                  <p className="text-[11px] text-gray-500 pt-1">
                    <strong>Fee covers:</strong> {activity.fee_covers || 'Court & equipment'} · <em>{tMsg('INF-035', lang)}</em>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-extrabold text-sm text-[#1A1033]">
                  Players ({activity.confirmedCount}/{activity.total_slots}) · Gender Split: {activity.genderSplit}
                </h3>
                {isConfirmed ? (
                  <div className="flex flex-wrap gap-2">
                    {(activity.roster || []).map((p: any) => (
                      <div
                        key={p.userId}
                        className="flex items-center gap-2 bg-white border border-purple-100 px-3 py-1.5 rounded-full shadow-xs"
                      >
                        <img src={p.photo} alt={p.displayName} className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-xs font-bold text-[#1A1033]">{p.displayName}</span>
                        {p.isOrganizer && (
                          <span className="text-[10px] bg-purple-100 text-[#6B2FA0] px-1.5 py-0.5 rounded-full font-bold">
                            Host
                          </span>
                        )}
                        {currentUser && p.userId !== currentUser.id && (
                          <button
                            onClick={() =>
                              openDialog({
                                code: 'BLOCK_USER',
                                title: `Block ${p.displayName}?`,
                                message: "You won't see each other in any activity.",
                                confirmLabel: 'Block Member',
                                danger: true,
                                onConfirm: async () => {
                                  await fetch('/api/blocks', {
                                    method: 'POST',
                                    headers: authHeaders,
                                    body: JSON.stringify({ blockedId: p.userId }),
                                  });
                                  showToast(`Blocked ${p.displayName}`, 'info');
                                  onRefresh();
                                },
                              })
                            }
                            className="text-gray-400 hover:text-[#D93B3B]"
                            title="Block User"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100 text-xs text-gray-600">
                    🔒 Participant photos & display names are visible only to confirmed members of this activity. Current split: <strong>{activity.genderSplit}</strong>.
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#6B2FA0] shrink-0 mt-0.5" />
                <div className="text-xs text-[#1A1033]">
                  <div className="font-extrabold">Safety first</div>
                  <p className="text-gray-600 mt-0.5">{tMsg('INF-022', lang)}</p>
                </div>
              </div>
            </>
          )}

          {/* VIEW 2: GROUP CHAT WITH REAL VOICE NOTES & GPS PINS */}
          {subView === 'chat' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-[#2E1A6E]">Activity Group Chat</span>
                  <p className="text-[11px] text-gray-500">
                    Group only. Phone numbers, emails, handles & links are automatically blocked.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    activity.chatWritable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {activity.chatWritable ? 'Writable (3+ Confirmed)' : 'Read-Only (<3 Players)'}
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-3.5 h-64 overflow-y-auto space-y-2.5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-2xl text-xs ${
                      m.type === 'system'
                        ? 'bg-purple-50 text-[#6B2FA0] text-center font-semibold'
                        : m.sender_id === currentUser?.id
                        ? 'bg-[#6B2FA0] text-white ml-8'
                        : 'bg-gray-100 text-[#1A1033] mr-8'
                    }`}
                  >
                    {m.type !== 'system' && (
                      <div className="font-bold text-[10px] opacity-80 mb-0.5 flex items-center justify-between">
                        <span>{m.display_name || 'Member'}</span>
                        <span>{m.created_at?.slice(11, 16)}</span>
                      </div>
                    )}
                    {m.type === 'voice' ? (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold">🎤 Voice Note ({m.voice_duration || 5}s)</div>
                        {m.audio_data && (
                          <audio controls src={m.audio_data} className="w-full h-8 mt-1" />
                        )}
                      </div>
                    ) : m.type === 'venue_pin' || m.type === 'live_pin' ? (
                      <a
                        href={`https://maps.google.com/?q=${m.lat || 30.0444},${m.lng || 31.2357}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 font-semibold underline"
                      >
                        <MapPin className="w-4 h-4" /> {m.content}
                      </a>
                    ) : (
                      <div>{m.content}</div>
                    )}
                  </div>
                ))}
              </div>

              {activity.chatWritable ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Write a message to your squad (no phone numbers/links)..."
                      className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#6B2FA0]"
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat('text')}
                    />
                    <button
                      onClick={() => handleSendChat('text')}
                      className="w-10 h-10 rounded-full sq-btn-gradient text-white flex items-center justify-center shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <VoiceNoteRecorder
                      onSendVoiceNote={(audioDataUrl, dur) =>
                        handleSendChat('voice', `Voice note (${dur}s)`, audioDataUrl, dur)
                      }
                      onError={(err) => showToast(err, 'error')}
                    />
                    <button
                      onClick={() =>
                        handleSendChat(
                          'venue_pin',
                          `📍 Venue Pin: ${activity.venue?.name_en} (${activity.area})`,
                          undefined,
                          undefined,
                          activity.venue?.lat,
                          activity.venue?.lng
                        )
                      }
                      className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-bold flex items-center gap-1 text-[#1A1033] hover:bg-purple-50"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#6B2FA0]" /> Share Venue Pin
                    </button>
                    <button
                      onClick={handleSendLiveLocationPin}
                      className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-bold flex items-center gap-1 text-[#1A1033] hover:bg-purple-50"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#2E9E6A]" /> Share Live GPS Pin
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-900 text-xs font-semibold text-center">
                  {tMsg('INF-013', lang)}
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: DYNAMIC 60s SIGNED QR CODE & ORGANIZER SCANNER (UC-29 & UC-30) */}
          {subView === 'qr' && (
            <div className="space-y-4">
              {!isOrganizer ? (
                <div className="sq-card p-5 border border-purple-100 text-center space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-[#6B2FA0] text-xs font-bold">
                    <QrCode className="w-4 h-4" /> Signed Dynamic Check-in QR
                  </div>
                  <p className="text-xs text-gray-500">
                    Show this QR code to the organizer at the venue (30m before to 30m after start). Rotates every 60 seconds to prevent screenshots.
                  </p>
                  <div className="inline-flex flex-col items-center p-4 rounded-3xl sq-hero-gradient text-white shadow-lg">
                    <DynamicQrMatrix value={qrData?.qrPayload || `squadly:${activity.id}`} size={168} />
                    <span className="font-mono text-sm font-black tracking-widest mt-2.5">
                      CODE: {qrData?.shortCode || '------'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#A42A9B]">
                    Cryptographic signature rotates in {qrCountdown}s
                  </div>

                  {/* Step 2: Participant confirms Organizer matches photo */}
                  <div className="pt-3 border-t border-gray-100 text-left space-y-2">
                    <div className="text-xs font-extrabold text-[#1A1033]">
                      Step 2: Is the organizer ({activity.organizerCard?.displayName}) here and do they match their verified photo?
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={activity.organizerCard?.photo}
                        alt="Organizer"
                        className="w-11 h-11 rounded-full object-cover border-2 border-[#6B2FA0]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await fetch(`/api/activities/${activity.id}/checkin`, {
                              method: 'POST',
                              headers: authHeaders,
                              body: JSON.stringify({ organizerConfirmMatch: true }),
                            });
                            showToast(tMsg('INF-027', lang), 'success');
                            onRefresh();
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                        >
                          Yes, Matches Photo
                        </button>
                        <button
                          onClick={() =>
                            openDialog({
                              code: 'CON-018',
                              title: 'Report Organizer Photo Mismatch?',
                              message: "Report that the organizer isn't here or doesn't match their photo? Squadly Moderators will be alerted right away.",
                              confirmLabel: 'Alert Squadly Now',
                              danger: true,
                              onConfirm: async () => {
                                await fetch(`/api/activities/${activity.id}/checkin`, {
                                  method: 'POST',
                                  headers: authHeaders,
                                  body: JSON.stringify({ organizerConfirmMatch: false }),
                                });
                                showToast('High-priority alert sent to Moderators! Opening SOS options.', 'error');
                                setSubView('sos');
                              },
                            })
                          }
                          className="px-3.5 py-1.5 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                        >
                          No / Mismatch
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sq-card p-5 border border-purple-100 space-y-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1A1033]">
                      Organizer QR Scanner & Roster Verification
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Scan or enter a participant&apos;s rotating 6-character QR code to verify their cryptographic token and compare their face to their verified photo.
                    </p>
                  </div>

                  {/* Cryptographic QR Token Verifier */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      placeholder="Enter participant's 6-char QR code or URI..."
                      className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch(`/api/activities/${activity.id}/scan-qr`, {
                          method: 'POST',
                          headers: authHeaders,
                          body: JSON.stringify({ scannedCode: scannerInput }),
                        });
                        const d = await res.json();
                        if (!res.ok) {
                          showToast(tMsg(d.code || 'ERR-039', lang), 'error');
                          return;
                        }
                        setScannedParticipant(d.participant);
                      }}
                      className="px-4 py-2 rounded-xl sq-btn-gradient text-white text-xs font-extrabold"
                    >
                      Verify QR
                    </button>
                  </div>

                  {scannedParticipant && (
                    <div className="p-4 rounded-2xl bg-purple-50 border-2 border-[#6B2FA0] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={scannedParticipant.profile_photo}
                          alt={scannedParticipant.display_name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#6B2FA0]"
                        />
                        <div>
                          <div className="text-xs font-black text-[#1A1033]">
                            QR Verified: {scannedParticipant.display_name}
                          </div>
                          <div className="text-[11px] text-gray-600">Does the person in front of you match this photo?</div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={async () => {
                            await fetch(`/api/activities/${activity.id}/checkin`, {
                              method: 'POST',
                              headers: authHeaders,
                              body: JSON.stringify({ participantUserId: scannedParticipant.id, matches: true }),
                            });
                            setScannedParticipant(null);
                            setScannerInput('');
                            showToast(tMsg('INF-027', lang), 'success');
                            onRefresh();
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#2E9E6A] text-white text-xs font-bold"
                        >
                          Matches
                        </button>
                        <button
                          onClick={async () => {
                            await fetch(`/api/activities/${activity.id}/checkin`, {
                              method: 'POST',
                              headers: authHeaders,
                              body: JSON.stringify({ participantUserId: scannedParticipant.id, matches: false }),
                            });
                            setScannedParticipant(null);
                            showToast('Mismatch alert sent to Moderators!', 'error');
                            onRefresh();
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#D93B3B] text-white text-xs font-bold"
                        >
                          Mismatch
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5 pt-2 border-t border-gray-100">
                    {(activity.roster || [])
                      .filter((p: any) => !p.isOrganizer)
                      .map((p: any) => (
                        <div key={p.userId} className="p-3 rounded-2xl bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <img src={p.photo} alt={p.displayName} className="w-10 h-10 rounded-full object-cover" />
                            <div>
                              <div className="font-bold text-xs text-[#1A1033]">{p.displayName}</div>
                              <div className="text-[11px] text-gray-500">Status: {p.status}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={async () => {
                                await fetch(`/api/activities/${activity.id}/checkin`, {
                                  method: 'POST',
                                  headers: authHeaders,
                                  body: JSON.stringify({ participantUserId: p.userId, matches: true }),
                                });
                                showToast(`${p.displayName} Checked In!`, 'success');
                                onRefresh();
                              }}
                              className="px-2.5 py-1 rounded-full bg-[#2E9E6A] text-white text-[11px] font-bold"
                            >
                              ✓ Check In
                            </button>
                            <button
                              onClick={() =>
                                openDialog({
                                  code: 'CON-015',
                                  title: `Mark ${p.displayName} as a no-show?`,
                                  message: "They'll receive 1 strike and be able to dispute it within 48 hours.",
                                  confirmLabel: 'Mark No-Show',
                                  danger: true,
                                  onConfirm: async () => {
                                    await fetch(`/api/activities/${activity.id}/attendance`, {
                                      method: 'POST',
                                      headers: authHeaders,
                                      body: JSON.stringify({ targetUserId: p.userId, status: 'No-show' }),
                                    });
                                    showToast(`Marked ${p.displayName} as No-show`, 'info');
                                    onRefresh();
                                  },
                                })
                              }
                              className="px-2.5 py-1 rounded-full bg-[#D93B3B] text-white text-[11px] font-bold"
                            >
                              Mark No-Show
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: SOS / SAFETY ALERT (UC-31) */}
          {subView === 'sos' && (
            <div className="sq-card p-5 border-2 border-[#D93B3B] space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 text-[#D93B3B] flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-[#1A1033]">SOS & Emergency Safety Center</h3>
              <p className="text-xs text-gray-600">
                Available from check-in window start until 1 hour after the activity ends. Moderators acknowledge alerts within 5 minutes (05:30–23:00).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href="tel:122"
                  className="py-3 rounded-2xl bg-red-50 border border-red-200 text-[#D93B3B] font-extrabold text-xs flex items-center justify-center gap-1.5"
                >
                  <PhoneCall className="w-4 h-4" /> Call Police (122)
                </a>
                <a
                  href="tel:123"
                  className="py-3 rounded-2xl bg-red-50 border border-red-200 text-[#D93B3B] font-extrabold text-xs flex items-center justify-center gap-1.5"
                >
                  <PhoneCall className="w-4 h-4" /> Call Ambulance (123)
                </a>
              </div>

              {!activeSosId ? (
                <div className="space-y-2 pt-2">
                  <button
                    onMouseDown={startSosHold}
                    onMouseUp={stopSosHold}
                    onMouseLeave={stopSosHold}
                    onTouchStart={startSosHold}
                    onTouchEnd={stopSosHold}
                    className="w-full py-4 rounded-full bg-[#D93B3B] text-white font-black text-sm shadow-lg relative overflow-hidden select-none"
                  >
                    <span className="relative z-10">
                      {holdProgress > 0
                        ? `Holding... ${Math.min(3, Math.ceil((holdProgress / 100) * 3))}s`
                        : 'HOLD 3 SECONDS: Alert Squadly & Emergency Contact'}
                    </span>
                    <div
                      className="absolute inset-y-0 left-0 bg-black/25 transition-all"
                      style={{ width: `${holdProgress}%` }}
                    />
                  </button>
                  <p className="text-[11px] text-gray-500">
                    Captures your live GPS coordinates, alerts Moderators, and sends an SMS to {currentUser?.emergency_name || 'your Emergency Contact'} ({currentUser?.emergency_mobile}).
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-3 text-left">
                  <div className="text-xs font-extrabold text-[#D93B3B]">
                    ✓ Squadly & Your Emergency Contact Have Been Alerted!
                  </div>
                  {sosSmsPreview && (
                    <div className="p-2.5 rounded-xl bg-white text-[11px] font-mono text-gray-700 border border-red-100">
                      <strong>SMS Dispatched:</strong> {sosSmsPreview}
                    </div>
                  )}
                  <button
                    onClick={handleMarkSafe}
                    className="w-full py-3 rounded-full bg-[#2E9E6A] text-white font-extrabold text-xs"
                  >
                    I&apos;m Safe Now (Send All-Clear)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 5: ANONYMOUS POST-ACTIVITY RATING */}
          {subView === 'rate' && (
            <div className="sq-card p-5 border border-purple-100 space-y-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#1A1033]">Rate & Review Your Squad</h3>
                <p className="text-xs text-gray-500">
                  Ratings are anonymous. Negative tags & private text are visible to Admins only.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Select Attendee to Rate</label>
                <select
                  value={rateTargetId}
                  onChange={(e) => setRateTargetId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs"
                >
                  <option value="">-- Pick squad member --</option>
                  {(activity.roster || [])
                    .filter((p: any) => p.userId !== currentUser?.id)
                    .map((p: any) => (
                      <option key={p.userId} value={p.userId}>
                        {p.displayName} {p.isOrganizer ? '(Organizer)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-purple-200 mb-1.5">
                  Star Rating (1–5)
                </label>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const isSelected = stars >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStars(n)}
                        className={`star-rating-btn p-2.5 rounded-2xl border transition-all flex items-center justify-center ${
                          isSelected
                            ? 'star-active bg-amber-50 dark:bg-[#382006] border-[#F5A524] text-[#F5A524] shadow-sm'
                            : 'star-inactive bg-gray-50 dark:bg-[#1E1238] border-gray-200 dark:border-purple-900/50 text-gray-300 dark:text-purple-400/40 hover:border-amber-300'
                        }`}
                      >
                        <Star
                          className="w-6 h-6 transition-transform hover:scale-110"
                          style={{
                            fill: isSelected ? '#F5A524' : 'none',
                            color: isSelected ? '#F5A524' : '#6B5B88',
                            strokeWidth: 2,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-purple-200 mb-1.5">
                  Positive Tags (Public)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['On time', 'Friendly', 'Skilled', 'Good sport', 'Well organized'].map((tag) => {
                    const active = posTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setPosTags(active ? posTags.filter((t) => t !== tag) : [...posTags, tag])
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                          active
                            ? 'bg-[#2E9E6A] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 dark:bg-[#251747] dark:text-[#EDE8FA] dark:border dark:border-purple-900/40 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-purple-200 mb-1.5">
                  Negative Tags (Admins Only)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Late', 'Rude', 'Unsafe behavior', 'Misleading activity'].map((tag) => {
                    const active = negTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setNegTags(active ? negTags.filter((t) => t !== tag) : [...negTags, tag])
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                          active
                            ? 'bg-[#D93B3B] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 dark:bg-[#251747] dark:text-[#EDE8FA] dark:border dark:border-purple-900/40 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                rows={3}
                placeholder="Private feedback for Squadly Admins only (up to 500 characters)..."
                value={privateFeedback}
                onChange={(e) => {
                  setPrivateFeedback(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.max(e.target.scrollHeight, 80)}px`;
                }}
                className="w-full rounded-xl border border-gray-200 p-3 text-xs leading-relaxed auto-expand-textarea"
                style={{ minHeight: '80px', maxHeight: '240px', overflowY: 'auto' }}
              />

              <button
                onClick={async () => {
                  const target = rateTargetId || activity.organizer_id;
                  await fetch(`/api/activities/${activity.id}/rate`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                      toUserId: target,
                      stars,
                      positiveTags: posTags,
                      negativeTags: negTags,
                      privateFeedback,
                    }),
                  });
                  showToast(tMsg('INF-018', lang), 'success');
                  setSubView('details');
                  onRefresh();
                }}
                className="w-full py-3 rounded-full sq-btn-gradient text-white font-extrabold text-xs"
              >
                Submit Anonymous Rating
              </button>
            </div>
          )}

          {/* VIEW 6: REPORT USER / ACTIVITY */}
          {subView === 'report' && (
            <div className="sq-card p-5 border border-purple-100 space-y-3">
              <h3 className="font-extrabold text-sm text-[#1A1033]">Report Safety or Policy Issue</h3>
              <p className="text-xs text-gray-500">
                Our Trust & Safety team will review your report confidentially. Severe categories immediately suspend the reported user pending Moderator review.
              </p>

              <label className="block text-xs font-bold text-gray-600">Category</label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs"
              >
                <optgroup label="Severe Categories (Immediate Suspension)">
                  <option value="Harassment / Sexual harassment">Harassment / Sexual harassment</option>
                  <option value="Threats or violence">Threats or violence</option>
                  <option value="Impersonation / fake profile">Impersonation / fake profile</option>
                  <option value="Hate speech">Hate speech</option>
                </optgroup>
                <optgroup label="Standard Categories">
                  <option value="Inappropriate behaviour">Inappropriate behaviour</option>
                  <option value="Sharing contact details">Sharing contact details</option>
                  <option value="Spam / scam">Spam / scam</option>
                  <option value="No-show">No-show</option>
                  <option value="Non-payment">Non-payment</option>
                  <option value="Unsafe venue">Unsafe venue</option>
                  <option value="Misleading activity">Misleading activity</option>
                  <option value="Other">Other</option>
                </optgroup>
              </select>

              <textarea
                rows={3}
                placeholder="Describe what happened (evidence & recent chat context attached automatically)..."
                value={reportDetails}
                onChange={(e) => {
                  setReportDetails(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.max(e.target.scrollHeight, 96)}px`;
                }}
                className="w-full rounded-xl border border-gray-200 p-3 text-xs leading-relaxed auto-expand-textarea"
                style={{ minHeight: '96px', maxHeight: '260px', overflowY: 'auto' }}
              />

              <button
                onClick={async () => {
                  const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                      targetType: 'Activity',
                      targetUserId: reportTargetUserId || activity.organizer_id,
                      activityId: activity.id,
                      category: reportCategory,
                      details: reportDetails,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    showToast(tMsg(data.code || 'ERR-037', lang), 'error');
                    return;
                  }
                  showToast(
                    data.autoSuspended
                      ? `${tMsg('INF-017', lang)} (Target user temporarily suspended pending review)`
                      : tMsg('INF-017', lang),
                    'success'
                  );
                  setSubView('details');
                  onRefresh();
                }}
                className="w-full py-3 rounded-full bg-[#D93B3B] text-white font-extrabold text-xs"
              >
                Send Confidential Report
              </button>
            </div>
          )}
        </div>

        {/* Sticky Pinned Action Footer for Details View */}
        {subView === 'details' && (
          <div className="shrink-0 bg-white dark:bg-[#18102E] border-t border-purple-100 dark:border-purple-900/40 px-5 py-3.5">
            {isOrganizer ? (
              <button
                onClick={() => setSubView('qr')}
                className="w-full py-3.5 rounded-2xl sq-btn-gradient text-white font-extrabold text-sm shadow-md cursor-pointer"
              >
                Open Check-in QR Scanner & Roster
              </button>
            ) : vp?.status === 'Confirmed' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setSubView('chat')}
                  className="flex-1 py-3.5 rounded-2xl sq-btn-gradient text-white font-extrabold text-sm shadow-md cursor-pointer"
                >
                  You&apos;re in! · Open Group Chat
                </button>
                <button
                  onClick={handleLeave}
                  className="btn-danger-outline px-4 py-3.5 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-[#381014] dark:hover:bg-[#4E171C] text-[#D93B3B] dark:text-[#FF6B6B] border border-red-200 dark:border-[#E5484D]/60 font-black text-xs cursor-pointer transition shadow-xs whitespace-nowrap"
                >
                  Cancel Spot
                </button>
              </div>
            ) : vp?.status === 'Requested' ? (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-[#382006] border border-amber-200 dark:border-[#F5A524]/40 rounded-2xl px-5 py-3">
                <span className="text-xs font-extrabold text-amber-900 dark:text-[#FBBF24]">⏳ Request Sent — Waiting for Organizer</span>
                <button onClick={handleLeave} className="text-xs font-bold text-[#D93B3B] dark:text-[#FF6B6B] hover:underline cursor-pointer">
                  Withdraw
                </button>
              </div>
            ) : vp?.status === 'Waitlisted' ? (
              <div className="flex items-center justify-between bg-purple-50 dark:bg-[#251747] border border-purple-200 dark:border-purple-900/50 rounded-2xl px-5 py-3">
                <span className="text-xs font-extrabold text-[#6B2FA0] dark:text-[#C084FC]">
                  Waitlisted (#{vp.waitlist_pos || 1})
                </span>
                <button onClick={handleLeave} className="text-xs font-bold text-[#D93B3B] dark:text-[#FF6B6B] hover:underline cursor-pointer">
                  Leave Waitlist
                </button>
              </div>
            ) : activity.confirmedCount >= activity.total_slots ? (
              <button
                onClick={handleWaitlist}
                className="w-full py-3.5 rounded-2xl bg-[#F5A524] text-[#1A1033] font-extrabold text-sm shadow-md cursor-pointer"
              >
                Full · Join Waitlist ({activity.waitlistCount}/{activity.total_slots})
              </button>
            ) : (
              <button
                onClick={handleJoin}
                className="w-full py-3.5 rounded-2xl sq-btn-gradient text-white font-extrabold text-sm shadow-md cursor-pointer"
              >
                {activity.join_mode === 'Instant' ? 'Join Activity' : 'Request to join'} ·{' '}
                {activity.fee_required ? `${activity.fee_amount} EGP` : 'Free'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

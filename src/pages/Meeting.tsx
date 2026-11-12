import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth, getStoredSession } from "@/contexts/AuthContext";
import { saveMeetingRedirect, clearMeetingRedirect, buildMeetingLoginUrl } from "@/utils/meetingRedirect";
import { bookingsService } from "@/services/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, User, Clock, ArrowLeft, AlertCircle, Copy, Check, Link2, Maximize, Minimize, Settings, Users, X, Calendar, RotateCcw, ShieldAlert, AlertTriangle, Bell, CheckCircle, MessageSquare, Disc, CircleDot, StopCircle, Pause, Play, Download, CheckSquare, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/PageLoader";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WebRTCService, ChatMessage } from "@/services/webrtcService";
import { meetingService, MeetingAccessResponse } from "@/services/meetingService";
import { meetingTrackingService } from "@/services/meetingTracking";
import { hasParticipantJoinedLocal, recordParticipantJoinLocal, getMeetingActionLabel } from "@/utils/meetingRejoin";
import MeetingChatPanel from "@/components/meeting/MeetingChatPanel";
import MeetingNotesPanel from "@/components/meeting/MeetingNotesPanel";
import { meetingNotesService } from "@/services/meetingNotesService";
import MeetingRecordingModal from "@/components/meeting/MeetingRecordingModal";
import { MeetingRecorder, RecordingResult, RecordingStatus } from "@/utils/meetingRecorder";
import { supabase } from "@/lib/supabase";
import { agoraService, AGORA_CONFIG } from "@/services/agora";
import { parseBookingDateTime, getCountdownTargetMs } from "@/utils/timeSlots";

export type PresenceStatus = 'Online' | 'Away';

export interface WaitingRoomParticipant {
  userId: string;
  name: string;
  role?: string;
  email?: string;
  enteredAt?: string;
  inCall?: boolean;
  status?: PresenceStatus;
}

interface BookingWithConsultant {
  id: string;
  user_id: string;
  consultant_id: string;
  date: string;
  time: string;
  session_duration: number | null;
  status: string;
  meeting_room_id: string | null;
  name: string;
  consultants?: { name: string; title: string; user_id: string };
}

interface RemoteParticipant {
  id: string;
  stream: MediaStream;
}

/**
 * Remote Video Component
 * Handles binding remote stream to video element, track detection, and autoplay policy
 */
function RemoteVideo({ stream, name, className }: { stream: MediaStream; name: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(true);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) return;

    console.log(`[RemoteVideo] Attaching remote stream to video element for ${name}. Stream ID: ${stream.id}`);
    
    videoEl.srcObject = stream;

    const checkTracks = () => {
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      const activeVideo = vTracks.some(t => t.enabled && t.readyState === 'live');
      const activeAudio = aTracks.some(t => t.enabled && t.readyState === 'live');
      console.log(`[RemoteVideo] ${name} has ${vTracks.length} video track(s) (active: ${activeVideo}) and ${aTracks.length} audio track(s) (active: ${activeAudio})`);
      setHasVideo(activeVideo);
      setHasAudio(activeAudio);
    };

    checkTracks();

    const playVideo = () => {
      videoEl.play().catch((err) => {
        console.warn(`[RemoteVideo] Autoplay warning for ${name}:`, err);
      });
    };

    playVideo();

    const handleAddTrack = (e: MediaStreamTrackEvent) => {
      console.log(`[RemoteVideo] Track added for ${name}: kind=${e.track.kind}, id=${e.track.id}`);
      checkTracks();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        playVideo();
      }
    };

    const handleRemoveTrack = (e: MediaStreamTrackEvent) => {
      console.log(`[RemoteVideo] Track removed for ${name}: kind=${e.track.kind}, id=${e.track.id}`);
      checkTracks();
    };

    stream.addEventListener('addtrack', handleAddTrack);
    stream.addEventListener('removetrack', handleRemoveTrack);

    return () => {
      stream.removeEventListener('addtrack', handleAddTrack);
      stream.removeEventListener('removetrack', handleRemoveTrack);
    };
  }, [stream, name]);

  return (
    <div className="relative w-full h-full bg-secondary overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={className || "w-full h-full object-contain"}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-200 z-10 p-4 space-y-2">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-md">
            <VideoOff className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm font-medium">Camera not available</p>
        </div>
      )}
      {!hasAudio && (
        <div className="absolute top-3 left-3 bg-red-500/90 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 z-20 shadow-sm">
          <MicOff className="h-3.5 w-3.5" />
          <span>Microphone not available</span>
        </div>
      )}
    </div>
  );
}

/**
 * Local Video Component
 * Handles binding local stream to muted video element with real webcam verification
 */
function LocalVideo({ stream, videoOff, className }: { stream: MediaStream | null; videoOff: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasRealCamera, setHasRealCamera] = useState(false);
  const [hasRealMic, setHasRealMic] = useState(true);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!stream) {
      setHasRealCamera(false);
      setHasRealMic(false);
      return;
    }

    const checkLocalTracks = () => {
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      const isCameraLive = vTracks.some(t => t.readyState === 'live');
      const isMicLive = aTracks.some(t => t.readyState === 'live');
      setHasRealCamera(isCameraLive);
      setHasRealMic(isMicLive);
    };

    checkLocalTracks();

    if (videoEl) {
      console.log(`[LocalVideo] Attaching real local stream to video element. Stream ID: ${stream.id}`);
      videoEl.srcObject = stream;
      videoEl.muted = true; // Local video MUST be muted to prevent feedback loop
      videoEl.play().catch((err) => console.warn('[LocalVideo] Autoplay warning:', err));
    }

    const handleTrackEvent = () => checkLocalTracks();
    stream.addEventListener('addtrack', handleTrackEvent);
    stream.addEventListener('removetrack', handleTrackEvent);

    return () => {
      stream.removeEventListener('addtrack', handleTrackEvent);
      stream.removeEventListener('removetrack', handleTrackEvent);
    };
  }, [stream]);

  const showCameraUnavailable = !hasRealCamera || videoOff;

  return (
    <div className="relative w-full h-full bg-secondary overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={className || "w-full h-full object-contain"}
      />
      {showCameraUnavailable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-200 z-10 p-4 space-y-2">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-md">
            <VideoOff className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm font-medium">
            {videoOff ? "Camera turned off" : "Camera not available"}
          </p>
        </div>
      )}
      {!hasRealMic && (
        <div className="absolute top-3 left-3 bg-red-500/90 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 z-20 shadow-sm">
          <MicOff className="h-3.5 w-3.5" />
          <span>Microphone not available</span>
        </div>
      )}
    </div>
  );
}

/**
 * Real-time Online / Away Presence Badge component for participant status
 */
function PresenceBadge({
  status,
  label,
  className = "",
}: {
  status: PresenceStatus | 'Offline';
  label?: string;
  className?: string;
}) {
  const isOnline = status === 'Online';
  const isAway = status === 'Away';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
        isOnline
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : isAway
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "bg-muted text-muted-foreground border border-border"
      } ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? "bg-emerald-500" : isAway ? "bg-amber-400" : "bg-slate-400"
          }`}
        />
      </span>
      <span>
        {label ? `${label}: ` : ""}
        {status}
      </span>
    </div>
  );
}

/**
 * Compact Presence Dot for in-video overlays
 */
function PresenceDot({
  status,
  showLabel = true,
}: {
  status: PresenceStatus | 'Offline';
  showLabel?: boolean;
}) {
  const isOnline = status === 'Online';
  const isAway = status === 'Away';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? "bg-emerald-500" : isAway ? "bg-amber-400" : "bg-slate-400"
          }`}
        />
      </span>
      {showLabel && (
        <span
          className={`text-[11px] font-medium ${
            isOnline ? "text-emerald-400" : isAway ? "text-amber-400" : "text-muted-foreground"
          }`}
        >
          {status}
        </span>
      )}
    </span>
  );
}

function formatBookingDateDisplay(dateStr?: string | null, format: 'short' | 'long' = 'long'): string {
  if (!dateStr) return '';
  try {
    if (dateStr.includes('T')) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return format === 'short'
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const localDate = new Date(y, m, d);
      if (!isNaN(localDate.getTime())) {
        return format === 'short'
          ? localDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : localDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getMeetingStatus(date: string, time: string, duration: number): "upcoming" | "live" | "completed" | "missed" {
  const start = parseBookingDateTime(date, time);
  if (!start || isNaN(start.getTime())) {
    return "upcoming";
  }
  const now = new Date();
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const joinWindow = new Date(start.getTime() - 5 * 60 * 1000);
  
  if (now < joinWindow) return "upcoming";
  if (now >= joinWindow && now <= end) return "live";
  if (now > end) return "missed";
  return "completed";
}

function canJoinMeeting(date: string, time: string, duration: number): boolean {
  const start = parseBookingDateTime(date, time);
  if (!start || isNaN(start.getTime())) {
    return false;
  }
  const now = new Date();
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const joinWindow = new Date(start.getTime() - 5 * 60 * 1000);
  
  // Can join 5 minutes before until meeting ends
  return now >= joinWindow && now <= end;
}

function Countdown({
  targetDate,
  targetTime,
  onTargetReached,
}: {
  targetDate: string;
  targetTime: string;
  onTargetReached?: () => void;
}) {
  const [diff, setDiff] = useState<number | null>(() => {
    try {
      const { targetMs, isValid } = getCountdownTargetMs(targetDate, targetTime);
      return isValid && targetMs !== null ? Math.max(0, targetMs - Date.now()) : null;
    } catch {
      return null;
    }
  });
  const [isPendingTime, setIsPendingTime] = useState(false);
  const reachedTriggeredRef = useRef(false);

  useEffect(() => {
    let targetMs: number | null = null;
    try {
      const result = getCountdownTargetMs(targetDate, targetTime);
      if (!result.isValid || result.targetMs === null) {
        setIsPendingTime(true);
        return;
      }
      targetMs = result.targetMs;
    } catch {
      setIsPendingTime(true);
      return;
    }

    setIsPendingTime(false);

    const tick = () => {
      const remaining = Math.max(0, targetMs! - Date.now());
      setDiff(remaining);
      if (remaining === 0 && !reachedTriggeredRef.current) {
        reachedTriggeredRef.current = true;
        if (onTargetReached) {
          onTargetReached();
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, targetTime, onTargetReached]);

  if (isPendingTime) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center max-w-md mx-auto space-y-2">
        <div className="flex items-center justify-center gap-2 text-amber-500 text-sm font-semibold">
          <AlertCircle className="h-4 w-4" />
          <span>Scheduled Start Time Pending</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This consultation was scheduled without a fixed time slot ({targetTime || "Flexible"}). Please coordinate with your consultant or administrator to confirm the exact session start time.
        </p>
      </div>
    );
  }

  const safeDiff = diff === null || isNaN(diff) || !isFinite(diff) ? 0 : Math.max(0, diff);
  const days = Math.floor(safeDiff / 86400000);
  const hours = Math.floor((safeDiff % 86400000) / 3600000);
  const minutes = Math.floor((safeDiff % 3600000) / 60000);
  const seconds = Math.floor((safeDiff % 60000) / 1000);

  const units = days > 0
    ? [
        { v: days, l: days === 1 ? "Day" : "Days" },
        { v: hours, l: "Hours" },
        { v: minutes, l: "Minutes" },
        { v: seconds, l: "Seconds" },
      ]
    : [
        { v: hours, l: "Hours" },
        { v: minutes, l: "Minutes" },
        { v: seconds, l: "Seconds" },
      ];

  return (
    <div className="flex items-center gap-2 sm:gap-3 justify-center flex-wrap">
      {units.map(({ v, l }) => (
        <div
          key={l}
          className="flex flex-col items-center bg-secondary border border-border rounded-xl px-3 sm:px-5 py-2.5 sm:py-3 min-w-[62px] sm:min-w-[70px]"
        >
          <span className="font-display text-2xl sm:text-3xl font-bold text-primary">
            {String(isNaN(v) ? 0 : v).padStart(2, "0")}
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  live: "bg-green-500/15 text-green-400 border-green-500/30",
  rejoin_eligible: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  missed: "bg-red-500/15 text-red-400 border-red-500/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
};
const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  live: "Live Now",
  rejoin_eligible: "7-Day Rejoin Active",
  completed: "Completed",
  missed: "Missed",
  expired: "Rejoin Expired",
};

function getCanonicalRoomId(currentRoomId?: string, currentBooking?: any): string {
  if (currentBooking?.meeting_room_id && typeof currentBooking.meeting_room_id === 'string' && currentBooking.meeting_room_id.trim()) {
    return currentBooking.meeting_room_id.trim();
  }
  if (currentBooking?.id) {
    const rawId = String(currentBooking.id).trim();
    return rawId.startsWith('foundarly-') ? rawId : `foundarly-${rawId}`;
  }
  if (currentRoomId) {
    const clean = currentRoomId.trim().replace(/^.*\/meeting\//, '').split('?')[0].split('#')[0].replace(/\/+$/, '');
    return clean.startsWith('foundarly-') ? clean : `foundarly-${clean}`;
  }
  return 'default-room';
}

export default function MeetingPage() {
  const { roomId, bookingId } = useParams<{ roomId?: string; bookingId?: string }>();
  const effectiveRoomId = (roomId || bookingId || "").trim();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin, loading: authLoading } = useAuth();

  const dashboardPath = isAdmin ? '/admin' : (profile?.role === 'consultant' || profile?.is_consultant) ? '/consultant/dashboard' : '/my-bookings';

  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  // Guards against duplicate / concurrent Start Meeting clicks initializing
  // multiple WebRTC/Agora clients or joining the signaling channel more than once.
  const startCallInFlightRef = useRef(false);
  const meetingContainerRef = useRef<HTMLDivElement | null>(null);

  const [booking, setBooking] = useState<BookingWithConsultant | null>(null);
  const [loading, setLoading] = useState(true);
  const [callStarted, setCallStarted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [status, setStatus] = useState<"upcoming" | "live" | "rejoin_eligible" | "completed" | "missed" | "expired">("upcoming");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualRoomId, setManualRoomId] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  // 7-Day Rejoin & Server Access Control States
  const [accessError, setAccessError] = useState<{
    title: string;
    message: string;
    code?: string;
    rejoinDeadline?: string;
  } | null>(null);
  const [hasJoinedBefore, setHasJoinedBefore] = useState(false);
  const [isRejoinSession, setIsRejoinSession] = useState(false);
  const [canJoin, setCanJoin] = useState(false);
  const [rejoinDaysRemaining, setRejoinDaysRemaining] = useState<number | null>(null);
  const [rejoinDeadline, setRejoinDeadline] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'client' | 'consultant' | 'admin' | null>(null);
  const [followUp, setFollowUp] = useState<any | null>(null);
  
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [presenceCount, setPresenceCount] = useState<number>(1);
  const [presenceParticipants, setPresenceParticipants] = useState<Array<{ id: string; name?: string; email?: string }>>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Real-time Waiting Room Notification & Presence States
  const [waitingRoomParticipants, setWaitingRoomParticipants] = useState<WaitingRoomParticipant[]>([]);
  const [myPresenceStatus, setMyPresenceStatus] = useState<PresenceStatus>('Online');
  const [participantPresenceMap, setParticipantPresenceMap] = useState<Map<string, { status: PresenceStatus; lastSeen: number }>>(new Map());
  const lastWaitingAlertRef = useRef<Map<string, number>>(new Map());
  const waitingRoomChannelRef = useRef<any>(null);
  const [isAdmitted, setIsAdmitted] = useState<boolean>(false);
  const startCallRef = useRef<() => Promise<void>>(async () => {});

  // Agora Network Stability & Packet Loss States
  const [isNetworkUnstable, setIsNetworkUnstable] = useState<boolean>(false);
  const [packetLossRate, setPacketLossRate] = useState<number | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // In-Meeting Real-time Meeting Notes & Action Items States
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesActiveTab, setNotesActiveTab] = useState<"action_items" | "shared_notes" | "private_notes">("action_items");

  // In-Meeting Real-time Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const canonical = effectiveRoomId ? `foundarly_chat_${effectiveRoomId.replace(/^foundarly-/, '')}` : 'foundarly_chat_default';
      const cached = sessionStorage.getItem(canonical);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // In-Meeting Recording Engine States
  const [recorder] = useState(() => new MeetingRecorder());
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [recordingDurationFormatted, setRecordingDurationFormatted] = useState("00:00");
  const [recordingResult, setRecordingResult] = useState<RecordingResult | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);

  // Load cached messages when room changes
  useEffect(() => {
    const canonicalRoom = getCanonicalRoomId(effectiveRoomId, booking);
    if (!canonicalRoom) return;
    try {
      const cached = sessionStorage.getItem(`foundarly_chat_${canonicalRoom}`);
      if (cached) {
        setChatMessages(JSON.parse(cached));
      }
    } catch (_err) {
      // Ignore storage errors
    }
  }, [effectiveRoomId, booking]);

  // Hook recorder events
  useEffect(() => {
    recorder.onStatusChange = (newStatus) => {
      setRecordingStatus(newStatus);
      if (newStatus === 'recording') {
        toast.success("Meeting recording started");
      } else if (newStatus === 'paused') {
        toast.info("Recording paused");
      } else if (newStatus === 'stopped') {
        toast.info("Recording stopped");
      }
    };

    recorder.onTimeUpdate = (_sec, formatted) => {
      setRecordingDurationFormatted(formatted);
    };

    recorder.onRecordingComplete = (res) => {
      setRecordingResult(res);
      setShowRecordingModal(true);
      toast.success("Consultation recording ready! You can now preview and save.");
    };

    recorder.onError = (err) => {
      console.error("[MeetingRecorder] Error:", err);
      toast.error(err.message || "Recording error occurred");
    };

    return () => {
      recorder.cleanup();
    };
  }, [recorder]);

  // Recording controls
  const handleToggleRecording = async () => {
    if (recordingStatus === 'idle' || recordingStatus === 'stopped') {
      try {
        const sessionTitle = booking?.consultants?.name 
          ? `Foundarly - Consultation with ${booking.consultants.name}` 
          : "Foundarly Consultation Session";
        await recorder.startRecording({
          localMicStream: localStream,
          sessionTitle,
        });
      } catch (err: any) {
        console.error("Start recording failed:", err);
        if (err.name !== 'NotAllowedError') {
          toast.error("Could not start recording: " + (err.message || "Unknown error"));
        }
      }
    } else if (recordingStatus === 'recording') {
      recorder.pauseRecording();
    } else if (recordingStatus === 'paused') {
      recorder.resumeRecording();
    }
  };

  const handleStopRecording = () => {
    if (recorder.isRecording()) {
      recorder.stopRecording();
    }
  };

  const handleSendChatMessage = async (text: string) => {
    const canonicalRoom = getCanonicalRoomId(effectiveRoomId, booking);
    const senderName = profile?.full_name || 
                       (userRole === 'consultant' ? booking?.consultants?.name : booking?.name) || 
                       user?.email?.split('@')[0] || 
                       'Participant';
    const roleLabel = userRole === 'consultant' 
      ? 'Consultant' 
      : (userRole === 'admin' ? 'Admin' : 'Client');

    const sent = await webrtcServiceRef.current?.sendChatMessage(text, roleLabel, senderName);
    if (sent) {
      setChatMessages((prev) => {
        const updated = [...prev, sent];
        try {
          sessionStorage.setItem(`foundarly_chat_${canonicalRoom}`, JSON.stringify(updated));
        } catch (_err) {
          // Ignore storage errors
        }
        return updated;
      });
    } else {
      toast.error("Could not deliver chat message");
    }
  };

  const toggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadChatCount(0);
        setIsNotesOpen(false);
        setShowParticipants(false);
        setShowSettings(false);
      }
      return next;
    });
  };

  const toggleNotes = (tab?: "action_items" | "shared_notes" | "private_notes") => {
    if (tab) {
      setNotesActiveTab(tab);
    }
    setIsNotesOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsChatOpen(false);
        setShowParticipants(false);
        setShowSettings(false);
      }
      return next;
    });
  };

  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const [waitingNotificationSent, setWaitingNotificationSent] = useState(false);
  const [waitingNotificationSending, setWaitingNotificationSending] = useState(false);
  const hasTriggeredNotificationRef = useRef(false);

  const handleManualNotifyWaiting = useCallback(async () => {
    const canonicalRoom = getCanonicalRoomId(effectiveRoomId, booking);
    if (!canonicalRoom) return;
    setWaitingNotificationSending(true);
    try {
      const res = await meetingService.notifyWaiting(canonicalRoom);
      if (res.success) {
        setWaitingNotificationSent(true);
        if (res.throttled) {
          toast.info("A notification was already sent recently.");
        } else {
          toast.success("Notification sent to the other participant!");
        }
      } else {
        toast.error(res.error || "Failed to send notification.");
      }
    } catch {
      toast.error("Network error sending notification.");
    } finally {
      setWaitingNotificationSending(false);
    }
  }, [effectiveRoomId, booking]);

  // Copy meeting link to clipboard
  const copyMeetingLink = () => {
    const canonicalRoom = getCanonicalRoomId(effectiveRoomId, booking);
    const meetingUrl = `${window.location.origin}/meeting/${canonicalRoom}`;
    navigator.clipboard.writeText(meetingUrl).then(() => {
      setLinkCopied(true);
      toast.success("Meeting link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  // Periodic refresh of server-validated session access
  const loadMeetingAccess = useCallback(async () => {
    if (!effectiveRoomId) return;
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Meeting session verification timed out')), 8000)
      );
      const accessResult = await Promise.race([
        meetingService.validateAccess(effectiveRoomId),
        timeoutPromise,
      ]);

      if (!accessResult.success || !accessResult.authorized) {
        if (accessResult.code === 'UNAUTHENTICATED') {
          const currentFullUrl = `${location.pathname}${location.search}${location.hash}`;
          const targetMeetingUrl = currentFullUrl.startsWith('/meeting/') ? currentFullUrl : `/meeting/${effectiveRoomId}`;
          saveMeetingRedirect(targetMeetingUrl);
          navigate(buildMeetingLoginUrl(targetMeetingUrl), {
            replace: true,
            state: { from: targetMeetingUrl }
          });
          return;
        }

        setAccessError({
          title: accessResult.code === 'REJOIN_EXPIRED' ? '7-Day Follow-Up Window Expired' :
                 accessResult.code === 'ROOM_NOT_FOUND' ? 'Meeting Session Not Found' :
                 accessResult.code === 'BOOKING_CANCELLED' ? 'Consultation Cancelled' :
                 accessResult.code === 'BOOKING_PENDING' ? 'Consultation Pending Verification' :
                 'Access Denied',
          message: accessResult.error || 'You are not authorized to access this meeting session.',
          code: accessResult.code || 'ACCESS_DENIED',
          rejoinDeadline: accessResult.timing?.rejoinDeadline,
        });
        setCanJoin(false);
        setIsRejoinSession(false);
        setBooking(accessResult.booking || null);
        setStatus(accessResult.sessionStatus as any || 'expired');
        return;
      }

      // Successfully authorized into meeting room - clear redirect storage
      clearMeetingRedirect();
      setAccessError(null);
      setBooking(accessResult.booking);
      
      const bookingId = accessResult.booking?.id || '';
      const joinedBefore = Boolean(
        accessResult.hasJoined ||
        (bookingId && hasParticipantJoinedLocal(bookingId, user?.id, user?.email, accessResult.role))
      );
      setHasJoinedBefore(joinedBefore);
      // Evaluate live session status from both server eligibility and local IST booking timing
      let effectiveCanJoin = Boolean(accessResult.canJoin);
      let effectiveStatus = accessResult.sessionStatus as any;

      if (accessResult.booking?.date && accessResult.booking?.time && accessResult.booking?.status === 'confirmed' && accessResult.booking?.payment_status === 'paid') {
        const localStatus = getMeetingStatus(accessResult.booking.date, accessResult.booking.time, accessResult.booking.session_duration || 60);
        if (localStatus === 'live') {
          effectiveCanJoin = true;
          effectiveStatus = 'live';
        }
      }

      setCanJoin(effectiveCanJoin);
      setStatus(effectiveStatus);
      setUserRole(accessResult.role || null);
      setFollowUp(accessResult.followUp || null);

      const canonicalRoom = getCanonicalRoomId(effectiveRoomId, accessResult.booking);
      if (effectiveRoomId && effectiveRoomId !== canonicalRoom) {
        console.log(`[Meeting] Canonicalizing room URL from ${effectiveRoomId} to ${canonicalRoom}`);
        window.history.replaceState(null, '', `/meeting/${canonicalRoom}`);
      }

      if (accessResult.timing) {
        setRejoinDeadline(accessResult.timing.rejoinDeadline);
        setRejoinDaysRemaining(accessResult.timing.rejoinDaysRemaining);
      }
    } catch (err: any) {
      console.error("[Meeting] Validation failed:", err);
      setAccessError({
        title: 'Connection Issue',
        message: 'Unable to reach the server to verify meeting authorization. Please check your network and retry.',
        code: 'NETWORK_ERROR',
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveRoomId, user?.id, user?.email, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Check if session is stored and being restored
      const stored = getStoredSession();
      if (stored?.user) {
        return;
      }
      const currentFullUrl = `${location.pathname}${location.search}${location.hash}`;
      const targetMeetingUrl = currentFullUrl.startsWith('/meeting/') ? currentFullUrl : `/meeting/${effectiveRoomId}`;
      saveMeetingRedirect(targetMeetingUrl);
      navigate(buildMeetingLoginUrl(targetMeetingUrl), {
        replace: true,
        state: { from: targetMeetingUrl }
      });
      return;
    }

    if (!effectiveRoomId) { 
      setManualEntry(true); 
      setLoading(false); 
      return; 
    }
    
    loadMeetingAccess();
    const interval = setInterval(loadMeetingAccess, 45000);
    return () => clearInterval(interval);
  }, [user, effectiveRoomId, navigate, location.pathname, location.search, location.hash, authLoading, loadMeetingAccess]);

  // Real-time notification system in the Meeting component using Supabase Realtime
  // to alert the consultant and client when the other party enters the waiting room.
  useEffect(() => {
    const canonicalRoom = getCanonicalRoomId(effectiveRoomId, booking);
    if (!canonicalRoom || !user || accessError || loading) return;

    const myName = profile?.full_name || 
                   (userRole === 'consultant' ? booking?.consultants?.name : booking?.name) || 
                   user?.email?.split('@')[0] || 
                   'Participant';
    const myRole = userRole || (profile?.role === 'consultant' || profile?.is_consultant ? 'consultant' : 'client');

    const channelName = `waiting_room_${canonicalRoom}`;
    console.log(`[Meeting Realtime] Subscribing to waiting room channel: ${channelName}`);

    const waitingChannel = supabase.channel(channelName, {
      config: {
        presence: { key: user.id },
        broadcast: { self: false },
      },
    });
    waitingRoomChannelRef.current = waitingChannel;

    const triggerWaitingRoomAlert = (participant: WaitingRoomParticipant) => {
      if (!participant || !participant.userId || participant.userId === user.id) return;

      const now = Date.now();
      const lastAlert = lastWaitingAlertRef.current.get(participant.userId) || 0;
      if (now - lastAlert < 12000) {
        return; // Suppress duplicate alert within 12 seconds
      }
      lastWaitingAlertRef.current.set(participant.userId, now);

      const isEnteringConsultant = participant.role === 'consultant';
      const isEnteringClient = participant.role === 'client';
      const isMeConsultant = myRole === 'consultant';
      const isMeClient = myRole === 'client';

      let alertTitle = `${participant.name || 'Participant'} has entered the waiting room!`;
      let alertDescription = "You can click 'Join Meeting' to enter the consultation.";

      if (isMeClient && (isEnteringConsultant || participant.role !== 'client')) {
        alertTitle = `${participant.name || booking?.consultants?.name || 'Your consultant'} has entered the waiting room!`;
        alertDescription = "Your consultant is now present. Click 'Join Meeting' to connect.";
      } else if (isMeConsultant && (isEnteringClient || participant.role !== 'consultant')) {
        alertTitle = `${participant.name || booking?.name || 'The client'} has entered the waiting room!`;
        alertDescription = "The client is waiting for you. Click 'Join Meeting' to begin the consultation.";
      }

      toast.success(alertTitle, {
        id: `waiting-alert-${participant.userId}`,
        duration: 8000,
        description: alertDescription,
      });
    };

    // 1. Listen for instant broadcast announcement when a participant opens the waiting room
    waitingChannel.on('broadcast', { event: 'waiting_room_enter' }, ({ payload }) => {
      console.log('[Meeting Realtime] Broadcast waiting_room_enter received:', payload);
      if (payload && payload.userId && payload.userId !== user.id) {
        const participantWithStatus: WaitingRoomParticipant = {
          ...payload,
          status: payload.status || 'Online',
        };
        setParticipantPresenceMap((prev) => {
          const next = new Map(prev);
          next.set(payload.userId, { status: payload.status || 'Online', lastSeen: Date.now() });
          return next;
        });
        setWaitingRoomParticipants((prev) => {
          const filtered = prev.filter((p) => p.userId !== payload.userId);
          return [...filtered, participantWithStatus];
        });
        triggerWaitingRoomAlert(participantWithStatus);
      }
    });

    // 2. Listen for real-time presence status change broadcasts (Online <-> Away)
    waitingChannel.on('broadcast', { event: 'presence_status_change' }, ({ payload }) => {
      console.log('[Meeting Realtime] Participant presence status changed:', payload);
      if (payload && payload.userId && payload.userId !== user.id) {
        const newStatus: PresenceStatus = payload.status === 'Away' ? 'Away' : 'Online';
        setParticipantPresenceMap((prev) => {
          const next = new Map(prev);
          next.set(payload.userId, { status: newStatus, lastSeen: Date.now() });
          return next;
        });
        setWaitingRoomParticipants((prev) =>
          prev.map((p) => (p.userId === payload.userId ? { ...p, status: newStatus } : p))
        );
      }
    });

    // 3. Listen for admission broadcast from host/consultant
    waitingChannel.on('broadcast', { event: 'meeting_admit' }, ({ payload }) => {
      console.log('[Meeting Realtime] Admission broadcast received from host:', payload);
      setIsAdmitted(true);
      toast.success("Host has admitted you to the consultation!", {
        duration: 5000,
        description: "Connecting to the live meeting room now..."
      });
      startCallRef.current?.();
    });

    // 4. Listen for Realtime presence state synchronization
    waitingChannel.on('presence', { event: 'sync' }, () => {
      const state = waitingChannel.presenceState();
      console.log('[Meeting Realtime] Waiting room presence sync:', state);
      const active: WaitingRoomParticipant[] = [];
      const presenceStatusUpdates = new Map<string, { status: PresenceStatus; lastSeen: number }>();

      Object.entries(state).forEach(([_key, presences]: [string, any]) => {
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p?.userId && p.userId !== user.id) {
              const status: PresenceStatus = p.status === 'Away' ? 'Away' : 'Online';
              active.push({ ...p, status });
              presenceStatusUpdates.set(p.userId, { status, lastSeen: Date.now() });
            }
          });
        }
      });

      setParticipantPresenceMap((prev) => {
        const next = new Map(prev);
        presenceStatusUpdates.forEach((val, k) => next.set(k, val));
        return next;
      });
      setWaitingRoomParticipants(active);
    });

    // 4. Listen for presence joins
    waitingChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
      console.log('[Meeting Realtime] Waiting room presence join:', newPresences);
      if (Array.isArray(newPresences)) {
        newPresences.forEach((p: any) => {
          if (p?.userId && p.userId !== user.id) {
            const status: PresenceStatus = p.status === 'Away' ? 'Away' : 'Online';
            setParticipantPresenceMap((prev) => {
              const next = new Map(prev);
              next.set(p.userId, { status, lastSeen: Date.now() });
              return next;
            });
            triggerWaitingRoomAlert({ ...p, status });
          }
        });
      }
    });

    // 5. Listen for presence leaves
    waitingChannel.on('presence', { event: 'leave' }, ({ key }) => {
      console.log('[Meeting Realtime] Waiting room presence leave:', key);
      setParticipantPresenceMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setWaitingRoomParticipants((prev) => prev.filter((p) => p.userId !== key));
    });

    // 6. Subscribe to channel, track presence, and broadcast arrival
    waitingChannel.subscribe(async (subStatus) => {
      if (subStatus === 'SUBSCRIBED') {
        console.log('[Meeting Realtime] Subscribed to waiting room channel successfully');
        const selfData: WaitingRoomParticipant = {
          userId: user.id,
          name: myName,
          role: myRole,
          email: user.email,
          enteredAt: new Date().toISOString(),
          inCall: callStarted,
          status: myPresenceStatus,
        };
        selfDataRef.current = selfData;

        try {
          await waitingChannel.track(selfData);
          await waitingChannel.send({
            type: 'broadcast',
            event: 'waiting_room_enter',
            payload: selfData,
          });
        } catch (trackErr) {
          console.warn('[Meeting Realtime] Waiting room presence track warning:', trackErr);
        }
      }
    });

    // 7. Dynamic Online / Away presence transition based on page visibility and window focus
    const updatePresenceStatus = (newStatus: PresenceStatus) => {
      setMyPresenceStatus(newStatus);
      if (waitingRoomChannelRef.current && selfDataRef.current) {
        const updatedSelf = { ...selfDataRef.current, status: newStatus };
        selfDataRef.current = updatedSelf;
        waitingRoomChannelRef.current.track(updatedSelf).catch(() => {});
        waitingRoomChannelRef.current.send({
          type: 'broadcast',
          event: 'presence_status_change',
          payload: { userId: user.id, status: newStatus },
        }).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === 'hidden';
      updatePresenceStatus(isHidden ? 'Away' : 'Online');
    };

    const handleWindowBlur = () => {
      updatePresenceStatus('Away');
    };

    const handleWindowFocus = () => {
      updatePresenceStatus('Online');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      console.log('[Meeting Realtime] Cleaning up waiting room channel subscription & presence listeners');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      supabase.removeChannel(waitingChannel);
      waitingRoomChannelRef.current = null;
    };
  }, [effectiveRoomId, booking, user, userRole, profile, accessError, loading, callStarted]);

  // Automatic reconnection logic for Agora RTC stream & Network Quality Monitoring
  // Shows a 'Reconnecting...' toast notification whenever stream connection is interrupted
  // and maintains packet loss threshold evaluation for the 'Network unstable' badge
  useEffect(() => {
    // Monitor network quality and packet loss for 'Network unstable' warning badge
    agoraService.onNetworkQualityChange = (stats) => {
      console.log(`[Meeting Agora RTC] Network quality update: isUnstable=${stats.isUnstable}, loss=${stats.packetLossRate}%`);
      setIsNetworkUnstable(stats.isUnstable);
      setPacketLossRate(stats.packetLossRate ?? null);
    };

    agoraService.onConnectionStateChange = (curState, revState, reason) => {
      console.log(`[Meeting Agora RTC] Connection state change: ${revState} -> ${curState} (${reason || 'normal'})`);
      if (curState === "RECONNECTING") {
        setIsNetworkUnstable(true);
        toast.loading("Reconnecting...", {
          id: "agora-reconnect",
          description: "Restoring Agora RTC video stream...",
        });
      } else if (curState === "CONNECTED" && revState === "RECONNECTING") {
        setIsNetworkUnstable(agoraService.getIsNetworkUnstable());
        toast.success("Reconnected!", {
          id: "agora-reconnect",
          description: "Agora RTC stream connection restored successfully.",
        });
      }
    };

    agoraService.onReconnecting = (attempt) => {
      console.log(`[Meeting Agora RTC] Automatic reconnection attempt #${attempt}`);
      setIsNetworkUnstable(true);
      toast.loading("Reconnecting...", {
        id: "agora-reconnect",
        description: `Restoring video stream (attempt ${attempt})...`,
      });
    };

    agoraService.onReconnected = () => {
      console.log("[Meeting Agora RTC] Stream successfully reconnected!");
      setIsNetworkUnstable(agoraService.getIsNetworkUnstable());
      toast.success("Reconnected!", {
        id: "agora-reconnect",
        description: "Your video stream has been restored.",
      });
    };

    agoraService.onReconnectFailed = () => {
      console.warn("[Meeting Agora RTC] Automatic reconnection failed after retries.");
      setIsNetworkUnstable(true);
      toast.error("Stream Connection Lost", {
        id: "agora-reconnect",
        description: "Could not restore the video stream automatically. Please refresh or rejoin.",
      });
    };

    return () => {
      toast.dismiss("agora-reconnect");
    };
  }, []);

  // Timer countdown during active call
  useEffect(() => {
    if (!callStarted || callEnded || !booking || !callStartTime) return;

    const duration = (booking.session_duration || 60) * 60;
    
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
      const remaining = duration - elapsed;
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        toast.warning(isRejoinSession ? "Follow-up session completed" : "Session time has ended");
        endCall();
      } else {
        setTimeRemaining(remaining);
        
        if (remaining === 300) {
          toast.warning("5 minutes remaining in your session");
        } else if (remaining === 60) {
          toast.warning("1 minute remaining in your session");
        } else if (remaining === 30) {
          toast.warning("30 seconds remaining!");
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [callStarted, callEnded, booking, callStartTime, isRejoinSession]);

  const startCall = useCallback(async () => {
    console.log("=== START CALL FUNCTION CALLED ===");
    
    if (!booking) {
      toast.error("Booking information missing");
      return;
    }

    const isHost = userRole === 'consultant' || profile?.role === 'consultant' || profile?.is_consultant;
    if (!canJoin && !isRejoinSession && !isAdmitted && status !== 'live' && status !== 'rejoin_eligible') {
      const isCurrentlyLive = Boolean(booking?.date && booking?.time && getMeetingStatus(booking.date, booking.time, booking.session_duration || 60) === 'live');
      if (!isCurrentlyLive && !isHost && !isAdmitted) {
        toast.error("Meeting can only be joined during the active session or 7-day follow-up window.");
        return;
      }
    }

    // Prevent duplicate / concurrent Start Meeting clicks from initializing
    // multiple WebRTC/Agora clients or joining the signaling channel more than once.
    if (startCallInFlightRef.current || callStarted || webrtcServiceRef.current) {
      toast.info("Meeting is already starting or in progress.");
      return;
    }
    startCallInFlightRef.current = true;

    // Invocation-scoped handle to the stream created during THIS start attempt,
    // so failure cleanup can stop the tracks even if React state is stale.
    let activeStream: MediaStream | null = null;

    try {
      setCallStarted(true);
      setCallStartTime(new Date());
      toast.info(hasJoinedBefore 
        ? "Rejoining video call..." 
        : "Connecting to real-time video consultation..."
      );

      const canonicalRoom = getCanonicalRoomId(effectiveRoomId, booking);

      // Record participant join locally and on server
      if (booking) {
        const participantId = user?.id || user?.email || 'unknown';
        recordParticipantJoinLocal(booking.id, user?.id, user?.email, userRole || undefined);
        setHasJoinedBefore(true);
        setIsRejoinSession(true);
        meetingTrackingService.recordJoin(
          booking.id,
          participantId,
          userRole || undefined,
          canonicalRoom,
          user?.email
        ).catch(console.warn);
      }

      const userId = user?.id || `user_${Math.random().toString(36).substring(2, 9)}`;
      const userName = user?.email?.split('@')[0] || 'Participant';

      const service = new WebRTCService(userId, {
        name: userName,
        email: user?.email || ''
      });
      webrtcServiceRef.current = service;

      // Event handlers for WebRTC
      service.onRemoteStream = (stream, remoteUserId) => {
        console.log(`[Meeting] Remote stream updated for ${remoteUserId}. Stream ID: ${stream.id}`);
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, { id: remoteUserId, stream });
          return next;
        });
        toast.success("Participant connected!");
      };

      service.onRemoteUserLeft = (remoteUserId) => {
        console.log(`[Meeting] Participant left: ${remoteUserId}`);
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
        toast.info("Participant left the meeting");
      };

      service.onPresenceUpdate = (count, participants) => {
        console.log(`[Meeting] Presence updated. Count: ${count}`, participants);
        setPresenceCount(count);
        setPresenceParticipants(participants);
      };

      // Connection State Listener with Reconnecting Toast
      service.onConnectionStateChange = (pcState, remoteUserId) => {
        console.log(`[Meeting] Connection state changed for ${remoteUserId}: ${pcState}`);
        if (pcState === 'disconnected') {
          toast.loading("Reconnecting...", {
            id: "agora-reconnect",
            description: "Connection interrupted. Restoring stream...",
          });
        } else if (pcState === 'connected') {
          toast.success("Reconnected!", {
            id: "agora-reconnect",
            description: "Stream connection restored successfully.",
          });
        } else if (pcState === 'failed') {
          toast.loading("Reconnecting...", {
            id: "agora-reconnect",
            description: "Re-establishing stream connection...",
          });
        }
      };

      // In-Meeting Chat Message Listener
      service.onChatMessage = (msg) => {
        setChatMessages((prev) => {
          const updated = [...prev, msg];
          try {
            sessionStorage.setItem(`foundarly_chat_${canonicalRoom}`, JSON.stringify(updated));
          } catch (_err) {
            // Ignore storage errors
          }
          return updated;
        });
        setIsChatOpen((open) => {
          if (!open) {
            setUnreadChatCount((c) => c + 1);
            toast.info(`New message from ${msg.senderName}: "${msg.text.slice(0, 30)}${msg.text.length > 30 ? '...' : ''}"`);
          }
          return open;
        });
      };

      // 1. Initialize local stream
      const stream = await service.initLocalStream(!videoOff, !muted);
      setLocalStream(stream);
      activeStream = stream;

      // 2. Join signaling channel using canonical room ID
      console.log(`[Meeting] Joining signaling channel with canonical room ID: ${canonicalRoom}`);
      await service.joinRoom(canonicalRoom);

      // 3. Connect to Agora RTC stream if configured and bind remote tracks
      if (AGORA_CONFIG.appId && AGORA_CONFIG.appId !== "your_agora_app_id_here") {
        console.log(`[Meeting] Initializing Agora RTC stream for room: ${canonicalRoom}`);

        agoraService.onRemoteUserPublished = (remoteUser, mediaType) => {
          console.log(`[Meeting Agora] Remote user published ${mediaType}:`, remoteUser.uid);
          const remoteUidStr = String(remoteUser.uid);
          setRemoteParticipants((prev) => {
            const next = new Map(prev);
            const existing = next.get(remoteUidStr);
            let mediaStream = existing?.stream;
            if (!mediaStream) {
              mediaStream = new MediaStream();
            }
            if (mediaType === "video" && remoteUser.videoTrack) {
              try {
                const videoTrack = remoteUser.videoTrack.getMediaStreamTrack();
                if (!mediaStream.getTrackById(videoTrack.id)) {
                  mediaStream.addTrack(videoTrack);
                }
              } catch (e) {
                console.warn("[Meeting Agora] Failed to attach video track:", e);
              }
            }
            if (mediaType === "audio" && remoteUser.audioTrack) {
              try {
                const audioTrack = remoteUser.audioTrack.getMediaStreamTrack();
                if (!mediaStream.getTrackById(audioTrack.id)) {
                  mediaStream.addTrack(audioTrack);
                }
              } catch (e) {
                console.warn("[Meeting Agora] Failed to attach audio track:", e);
              }
            }
            next.set(remoteUidStr, { id: remoteUidStr, stream: mediaStream });
            return next;
          });
          toast.success("Participant media connected via Agora!");
        };

        agoraService.onRemoteUserUnpublished = (remoteUser, mediaType) => {
          console.log(`[Meeting Agora] Remote user unpublished ${mediaType}:`, remoteUser.uid);
          const remoteUidStr = String(remoteUser.uid);
          setRemoteParticipants((prev) => {
            const next = new Map(prev);
            const existing = next.get(remoteUidStr);
            if (existing && existing.stream) {
              if (mediaType === "video") {
                existing.stream.getVideoTracks().forEach((t) => existing.stream.removeTrack(t));
              }
              if (mediaType === "audio") {
                existing.stream.getAudioTracks().forEach((t) => existing.stream.removeTrack(t));
              }
              if (existing.stream.getTracks().length === 0) {
                next.delete(remoteUidStr);
              }
            }
            return next;
          });
        };

        agoraService.onRemoteUserLeft = (remoteUser) => {
          console.log(`[Meeting Agora] Remote user left:`, remoteUser.uid);
          const remoteUidStr = String(remoteUser.uid);
          setRemoteParticipants((prev) => {
            const next = new Map(prev);
            next.delete(remoteUidStr);
            return next;
          });
          toast.info("Participant left the meeting");
        };

        agoraService.join({
          appId: AGORA_CONFIG.appId,
          channel: canonicalRoom,
          uid: user?.id,
        }, stream).then(() => {
          console.log("[Meeting] Agora RTC stream connected successfully");
        }).catch((agoraErr: any) => {
          console.warn("[Meeting] Agora RTC stream join note:", agoraErr?.message);
        });
      }

      if (stream.getTracks().length === 0) {
        toast.info("Connected to meeting room in listener mode (camera/mic unavailable).");
      } else {
        toast.success("Connected to meeting room!");
      }

      // 3. Automatically notify the other participant if they are not yet present in the room
      if (!hasTriggeredNotificationRef.current && canonicalRoom) {
        hasTriggeredNotificationRef.current = true;
        setWaitingNotificationSending(true);
        meetingService.notifyWaiting(canonicalRoom).then((res) => {
          setWaitingNotificationSending(false);
          if (res.success) {
            setWaitingNotificationSent(true);
            const otherParty = userRole === 'client'
              ? (booking?.consultants?.name || 'your consultant')
              : (booking?.name || 'the client');
            if (!res.throttled) {
              toast.info(`Email notification sent to ${otherParty} that you're waiting in the meeting room.`);
            }
          }
        }).catch((err) => {
          setWaitingNotificationSending(false);
          console.warn("[Meeting] Waiting notification warning:", err);
        });
      }
    } catch (error: any) {
      console.error("❌ ERROR in startCall:", error);
      console.log(error);
      console.log(error?.stack);
      console.dir(error);

      const errName = error?.name || "";
      const errMsg = error?.message || "Unknown error";
      toast.error(`Failed to start video call [${errName || 'Error'}]: ${errMsg}`);
      setCallStarted(false);
      setCallStartTime(null);

      // --- Comprehensive cleanup: stop any local tracks, leave channels,
      //     and reset all in-flight resources so a failed start cannot leave
      //     dangling WebRTC clients, open microphone/camera tracks, or a
      //     half-joined signaling channel behind.
      //
      //     Each step is wrapped to prevent one cleanup failure from masking
      //     another or from propagating an unhandled error out of this catch.

      // 1. Leave and reset WebRTC service
      if (webrtcServiceRef.current) {
        try {
          await webrtcServiceRef.current.leave();
        } catch (e) {
          console.warn("[startCall cleanup] WebRTC leave error:", e);
        } finally {
          webrtcServiceRef.current = null;
        }
      }

      // 2. Stop any local tracks that were initialized during this attempt
      if (activeStream) {
        try {
          activeStream.getTracks().forEach((track) => {
            try { track.stop(); } catch (e) { /* ignore */ }
          });
        } catch (e) {
          console.warn("[startCall cleanup] track.stop error:", e);
        }
      }
      setLocalStream(null);

      // 3. Leave Agora channel if we joined one
      try {
        if (agoraService?.isInChannel()) {
          await agoraService.leave().catch(console.warn);
        }
      } catch (e) {
        console.warn("[startCall cleanup] Agora leave error:", e);
      }

      // 4. Drain any remaining track references as a safety net
      if (activeStream) {
        activeStream = null;
      }
    } finally {
      startCallInFlightRef.current = false;
    }
  }, [booking, effectiveRoomId, user, videoOff, muted, canJoin, isRejoinSession, isAdmitted, status, userRole, profile, callStarted]);

  useEffect(() => {
    startCallRef.current = startCall;
  }, [startCall]);

  const handleAdmitAndJoin = useCallback(async () => {
    console.log("=== ADMIT CLIENT & START MEETING ===");
    toast.info("Admitting participant and starting meeting...");
    if (waitingRoomChannelRef.current) {
      try {
        await waitingRoomChannelRef.current.send({
          type: 'broadcast',
          event: 'meeting_admit',
          payload: {
            admittedBy: user?.id,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.warn("[Meeting] Error broadcasting admission:", err);
      }
    }
    setIsAdmitted(true);
    await startCall();
  }, [user?.id, startCall]);

  const endCall = async () => {
    try {
      const activeDurationMinutes = callStartTime 
        ? (new Date().getTime() - callStartTime.getTime()) / (1000 * 60)
        : 0;
      const effectiveParticipantCount = Math.max(presenceCount, remoteParticipants.size + 1);

      if (recorder.isRecording()) {
        recorder.stopRecording();
      }

      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.leave();
        webrtcServiceRef.current = null;
      }
      if (agoraService.isInChannel() || agoraService.isCurrentlyReconnecting()) {
        await agoraService.leave().catch(console.warn);
      }
      toast.dismiss("agora-reconnect");
      setCallStarted(false);
      setCallEnded(true);
      setCallStartTime(null);
      setTimeRemaining(null);
      setRemoteParticipants(new Map());
      setLocalStream(null);
      
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      // If call genuinely took place, record meeting completion and send post-session email
      if (booking?.id && activeDurationMinutes > 0) {
        meetingTrackingService.endMeeting(booking.id, effectiveParticipantCount, activeDurationMinutes);
      }
    } catch (error) {
      console.error("Error ending call:", error);
      agoraService.leave().catch(console.warn);
      toast.dismiss("agora-reconnect");
      setCallStarted(false);
      setCallEnded(true);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await meetingContainerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
      toast.error("Fullscreen not supported");
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Screen sharing functionality
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        if (webrtcServiceRef.current) {
          const screenTrack = await webrtcServiceRef.current.startScreenShare();
          setIsScreenSharing(true);
          toast.success("Screen sharing started");

          screenTrack.onended = () => {
            webrtcServiceRef.current?.stopScreenShare();
            setIsScreenSharing(false);
            toast.info("Screen sharing stopped");
          };
        }
      } else {
        if (webrtcServiceRef.current) {
          await webrtcServiceRef.current.stopScreenShare();
        }
        setIsScreenSharing(false);
        toast.success("Screen sharing stopped");
      }
    } catch (error: any) {
      console.error("Screen share error:", error);
      toast.error("Failed to start screen sharing");
    }
  };

  useEffect(() => {
    if (callEnded && booking) setTimeout(() => navigate(`/review/${booking.id}`), 1500);
  }, [callEnded, booking]);

  useEffect(() => {
    return () => {
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leave().catch(console.error);
      }
      agoraService.leave().catch(console.warn);
      toast.dismiss("agora-reconnect");
    };
  }, []);

  const handleManualJoin = () => {
    if (!manualRoomId.trim()) {
      toast.error("Please enter a meeting ID");
      return;
    }
    navigate(`/meeting/${manualRoomId.trim()}`);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Please select both date and time");
      return;
    }

    if (!booking) {
      toast.error("Booking information missing");
      return;
    }

    setRescheduling(true);
    try {
      await bookingsService.reschedule(booking.id, rescheduleDate, rescheduleTime);
      
      setBooking({
        ...booking,
        date: rescheduleDate,
        time: rescheduleTime,
        status: 'confirmed'
      });
      
      setStatus(getMeetingStatus(rescheduleDate, rescheduleTime, booking.session_duration || 60));
      setShowRescheduleDialog(false);
      toast.success("Meeting rescheduled successfully!");
      
      setRescheduleDate("");
      setRescheduleTime("");
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error("Failed to reschedule meeting");
    } finally {
      setRescheduling(false);
    }
  };

  if (authLoading || loading) return <PageLoader text="Loading your session..." />;

  // Access Denied / 7-Day Expired / Invalid Session Error Screen
  if (accessError) {
    const isExpired = accessError.code === "REJOIN_EXPIRED";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-gradient-card border border-border rounded-2xl p-8 space-y-6 text-center shadow-lg">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
              isExpired ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}>
              {isExpired ? (
                <Clock className="h-8 w-8 text-amber-500" />
              ) : (
                <ShieldAlert className="h-8 w-8 text-destructive" />
              )}
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {accessError.title}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {accessError.message}
              </p>
            </div>

            {isExpired && accessError.rejoinDeadline && (
              <div className="bg-secondary/60 border border-border rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">7-Day Clarification Window Concluded</p>
                <p>Eligible until: {new Date(accessError.rejoinDeadline).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}</p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {accessError.code === "NETWORK_ERROR" && (
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={() => {
                    setLoading(true);
                    setAccessError(null);
                    loadMeetingAccess();
                  }}
                >
                  Retry Connection
                </Button>
              )}
              <Button
                className="w-full glow-gold"
                variant={accessError.code === "NETWORK_ERROR" ? "outline" : "default"}
                onClick={() => navigate(dashboardPath)}
              >
                Return to Bookings
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => navigate("/consultants")}
              >
                Book a New Consultation
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Manual Entry Screen
  if (manualEntry) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-gradient-card border border-border rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold">Join Meeting</h1>
              <p className="text-sm text-muted-foreground">
                Enter your meeting ID to join the video call
              </p>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="foundarly-xxxxx"
                value={manualRoomId}
                onChange={(e) => setManualRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualJoin()}
                className="bg-background border-border text-center font-mono"
              />
              <Button className="w-full glow-gold" onClick={handleManualJoin}>
                Join Meeting
              </Button>
            </div>

            <div className="pt-4 border-t border-border text-center">
              <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
  
  if (!booking) return null;

  const remoteUsersList = Array.from(remoteParticipants.values());

  // Determine other participant's real-time Online / Away presence status
  const otherPartyUserId = userRole === 'client'
    ? (booking.consultants?.user_id || booking.consultant_id)
    : booking.user_id;

  let otherPartyPresenceStatus: PresenceStatus | 'Offline' = 'Offline';
  if (otherPartyUserId && participantPresenceMap.has(otherPartyUserId)) {
    otherPartyPresenceStatus = participantPresenceMap.get(otherPartyUserId)!.status;
  } else {
    const matchedWaiting = waitingRoomParticipants.find((p) => {
      if (otherPartyUserId && p.userId === otherPartyUserId) return true;
      if (userRole === 'client' && p.role === 'consultant') return true;
      if (userRole === 'consultant' && p.role === 'client') return true;
      return false;
    });
    if (matchedWaiting) {
      otherPartyPresenceStatus = matchedWaiting.status || 'Online';
    }
  }

  const otherPartyRoleLabel = userRole === 'client' ? 'Consultant' : 'Client';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Consultation Meeting Room - Foundarly"
        description="Private, encrypted video meeting room for 1-on-1 business consultations."
        noindex={true}
      />
      {/* Top bar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <span className="font-display font-bold text-gradient-gold text-lg hidden sm:inline">Foundarly</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{booking.consultants?.name || "Consultant"}</span>
              <span className="text-xs text-muted-foreground">{booking.consultants?.title || "Professional"}</span>
            </div>
          </div>
          {/* Real-time Presence Status for other party and self */}
          <PresenceBadge status={otherPartyPresenceStatus} label={otherPartyRoleLabel} />
          <PresenceBadge status={myPresenceStatus} label="You" />
          <div className="h-5 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">{formatBookingDateDisplay(booking.date, 'short')}</span>
            <span>{booking.time}</span>
            <span className="text-xs">({booking.session_duration || 60} min)</span>
          </div>
          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[status]}`}>
            {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse inline-block" />}
            {STATUS_LABELS[status]}
          </Badge>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {callEnded && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <PhoneOff className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="font-display text-2xl font-bold">Call Ended</h2>
            <p className="text-muted-foreground">Redirecting you to leave a review...</p>
          </div>
        )}

        {callStarted && !callEnded && (
          <div ref={meetingContainerRef} className="fixed inset-0 bg-black z-50">
            {/* Main Video Area */}
            <div className="relative w-full h-full flex">
              {/* Main Video Display */}
              <div className="flex-1 relative">
                {/* Subtle Network Unstable Warning Badge next to the video feed */}
                <AnimatePresence>
                  {isNetworkUnstable && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md shadow-lg"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
                      <span>Network unstable</span>
                      {typeof packetLossRate === 'number' && packetLossRate > 0 && (
                        <span className="text-[11px] text-amber-200/80 font-mono font-normal">
                          ({Math.round(packetLossRate)}% loss)
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {remoteUsersList.length > 0 ? (
                  <div className="w-full h-full relative">
                    <RemoteVideo 
                      stream={remoteUsersList[0].stream} 
                      name={booking?.consultants?.name || 'Participant'} 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-6 left-6 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full z-10 flex items-center gap-2 border border-white/10 shadow-lg">
                      <span className="text-sm font-medium text-white">
                        {booking?.consultants?.name || `Participant`}
                      </span>
                      <PresenceDot status={otherPartyPresenceStatus} />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <LocalVideo 
                      stream={localStream} 
                      videoOff={videoOff} 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-6 left-6 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full z-10 flex items-center gap-2 border border-white/10 shadow-lg">
                      <span className="text-sm font-medium text-white">You</span>
                      <PresenceDot status={myPresenceStatus} />
                    </div>

                    {/* Waiting Screen Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center p-6 z-10 pointer-events-none">
                      <div className="bg-background/90 backdrop-blur-md border border-amber-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4 pointer-events-auto">
                        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                          <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                            <Clock className="w-7 h-7 text-amber-500 animate-pulse" />
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-foreground">
                            Waiting for the other participant to join...
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {userRole === 'client'
                              ? `You have joined the meeting room. Waiting for your consultant (${booking?.consultants?.name || 'Consultant'}) to connect.`
                              : `You have joined the meeting room. Waiting for the client (${booking?.name || 'Client'}) to connect.`}
                          </p>
                        </div>

                        {followUp && followUp.status === 'confirmed' && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-400 text-left space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-emerald-500">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>Confirmed Follow-Up Consultation</span>
                            </div>
                            <p className="text-muted-foreground">
                              Scheduled: {followUp.confirmed_date} at {followUp.confirmed_time}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              Clarification / Topic: {followUp.reason}
                            </p>
                          </div>
                        )}

                        {/* Participant Notification Status Banner */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs space-y-2 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-primary font-medium text-xs">
                              <Bell className="h-3.5 w-3.5" />
                              <span>{waitingNotificationSent ? "Email Alert Dispatched" : "Participant Notification"}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={waitingNotificationSending}
                              onClick={handleManualNotifyWaiting}
                              className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                            >
                              {waitingNotificationSending ? "Sending..." : "Resend Alert"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-normal">
                            An email notification with the meeting room link has been dispatched to {userRole === 'client' ? (booking?.consultants?.name || 'your consultant') : (booking?.name || 'the client')} inviting them to connect.
                          </p>
                        </div>

                        {waitingRoomParticipants.length > 0 && (
                          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-left space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              <span>{waitingRoomParticipants.map((p) => p.name).join(", ")} is in the waiting room!</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Connecting audio and video streams automatically...
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground bg-secondary/60 rounded-full py-1.5 px-3">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span>Connected to room • Auto-connecting upon entry</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Local Video Thumbnail (Bottom Right) when Remote User is present */}
                {remoteUsersList.length > 0 && (
                  <div className="absolute bottom-24 right-6 w-64 h-48 rounded-lg overflow-hidden border-2 border-border shadow-2xl z-20">
                    <div className="relative w-full h-full bg-secondary">
                      <LocalVideo 
                        stream={localStream} 
                        videoOff={videoOff} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2 py-1 rounded-full z-10 flex items-center gap-1.5 border border-white/10">
                        <span className="text-xs font-medium text-white">You</span>
                        <PresenceDot status={myPresenceStatus} showLabel={false} />
                      </div>
                      {muted && (
                        <div className="absolute top-2 right-2 bg-destructive/90 backdrop-blur-sm p-1.5 rounded-full z-10">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Remote Users (if > 1) */}
                {remoteUsersList.length > 1 && (
                  <div className="absolute top-6 right-6 space-y-3 z-20">
                    {remoteUsersList.slice(1).map((remoteUser, index) => (
                      <div key={remoteUser.id} className="w-48 h-36 rounded-lg overflow-hidden border-2 border-border shadow-xl bg-secondary">
                        <div className="relative w-full h-full">
                          <RemoteVideo 
                            stream={remoteUser.stream} 
                            name={`Participant ${index + 2}`} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full z-10">
                            <span className="text-xs font-medium text-white">
                              Participant {index + 2}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-background/95 backdrop-blur-lg border border-border rounded-full px-4 py-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <Button 
                    variant={muted ? "destructive" : "ghost"} 
                    size="icon"
                    onClick={() => {
                      const newMuted = !muted;
                      setMuted(newMuted);
                      webrtcServiceRef.current?.toggleAudio(newMuted);
                      toast.success(newMuted ? "Microphone muted" : "Microphone unmuted");
                    }} 
                    className="rounded-full h-12 w-12"
                    title={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  
                  <Button 
                    variant={videoOff ? "destructive" : "ghost"} 
                    size="icon"
                    onClick={() => {
                      const newVideoOff = !videoOff;
                      setVideoOff(newVideoOff);
                      webrtcServiceRef.current?.toggleVideo(newVideoOff);
                      toast.success(newVideoOff ? "Camera stopped" : "Camera started");
                    }} 
                    className="rounded-full h-12 w-12"
                    title={videoOff ? "Start Video" : "Stop Video"}
                  >
                    {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </Button>

                  <Button 
                    variant={isScreenSharing ? "default" : "ghost"} 
                    size="icon"
                    onClick={toggleScreenShare} 
                    className="rounded-full h-12 w-12"
                    title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                  >
                    {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                  </Button>

                  <div className="w-px h-8 bg-border mx-1" />

                  {/* Notes & Action Items Button */}
                  <Button 
                    variant={isNotesOpen ? "default" : "ghost"} 
                    size="icon"
                    onClick={() => toggleNotes()} 
                    className={cn(
                      "rounded-full h-12 w-12 relative transition-all",
                      isNotesOpen ? "glow-gold bg-primary text-primary-foreground" : ""
                    )}
                    title="Meeting Notes & Real-time Action Items"
                  >
                    <CheckSquare className="h-5 w-5" />
                  </Button>

                  {/* In-Call Chat Button */}
                  <Button 
                    variant={isChatOpen ? "default" : "ghost"} 
                    size="icon"
                    onClick={toggleChat} 
                    className={cn(
                      "rounded-full h-12 w-12 relative transition-all",
                      isChatOpen ? "glow-gold bg-primary text-primary-foreground" : ""
                    )}
                    title="In-Meeting Chat"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {unreadChatCount > 0 && (
                      <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                    )}
                  </Button>
                  
                  <div className="w-px h-8 bg-border mx-1" />

                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={toggleFullscreen} 
                    className="rounded-full h-12 w-12"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowSettings(!showSettings)} 
                    className="rounded-full h-12 w-12"
                    title="Settings"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>

                  <div className="w-px h-8 bg-border mx-1" />
                  
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={endCall} 
                    className="rounded-full h-12 w-12"
                    title="End Call"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Meeting Info Overlay */}
            <div className="absolute top-6 left-6 z-10">
              <div className="bg-background/80 backdrop-blur-md border border-border rounded-lg px-4 py-2 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-medium">Live</span>
                  </div>
                  {timeRemaining !== null && (
                    <>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</span>
                      </div>
                    </>
                  )}
                  {isScreenSharing && (
                    <>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1.5 text-sm text-primary">
                        <Monitor className="h-3.5 w-3.5" />
                        <span>Sharing</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar (Top Right) */}
            <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
              <Button
                variant={isNotesOpen ? "default" : "ghost"}
                size="sm"
                onClick={() => toggleNotes()}
                className={cn(
                  "bg-background/80 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-lg hover:bg-background/90 flex items-center gap-1.5 transition-all text-xs",
                  isNotesOpen ? "border-primary text-primary bg-primary/10" : ""
                )}
                title="Open Meeting Notes & Action Items"
              >
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="font-medium hidden sm:inline">Notes & Actions</span>
              </Button>

              <Button
                variant={isChatOpen ? "default" : "ghost"}
                size="sm"
                onClick={toggleChat}
                className={cn(
                  "bg-background/80 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-lg hover:bg-background/90 relative flex items-center gap-1.5 transition-all text-xs",
                  isChatOpen ? "border-primary text-primary bg-primary/10" : ""
                )}
                title="Open In-Meeting Chat"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium hidden sm:inline">Chat</span>
                {unreadChatCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </Button>

              <Button
                variant={showParticipants ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setShowParticipants(!showParticipants);
                  if (!showParticipants) {
                    setIsNotesOpen(false);
                    setIsChatOpen(false);
                  }
                }}
                className="bg-background/80 backdrop-blur-md border border-border rounded-lg px-4 py-2 shadow-lg hover:bg-background/90"
                title="View Participants"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{presenceCount}</span>
                </div>
              </Button>
            </div>

            {/* Meeting Notes Panel */}
            <AnimatePresence>
              {isNotesOpen && (
                <motion.div
                  initial={{ x: 340, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 340, opacity: 0 }}
                  transition={{ type: "spring", damping: 25 }}
                  className="absolute top-0 right-0 h-full z-30"
                >
                  <MeetingNotesPanel
                    roomId={getCanonicalRoomId(effectiveRoomId, booking)}
                    booking={booking}
                    currentUserId={user?.id || 'unknown'}
                    currentUserName={profile?.full_name || (userRole === 'consultant' ? booking?.consultants?.name : booking?.name) || user?.email?.split('@')[0] || 'Participant'}
                    currentUserRole={(userRole === 'consultant' ? 'consultant' : userRole === 'admin' ? 'admin' : 'client')}
                    onClose={() => setIsNotesOpen(false)}
                    broadcastChannel={waitingRoomChannelRef.current}
                    activeTabDefault={notesActiveTab}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* In-Meeting Chat Panel */}
            <AnimatePresence>
              {isChatOpen && (
                <motion.div
                  initial={{ x: 340, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 340, opacity: 0 }}
                  transition={{ type: "spring", damping: 25 }}
                  className="absolute top-0 right-0 h-full z-30"
                >
                  <MeetingChatPanel
                    messages={chatMessages}
                    currentUserId={user?.id || 'unknown'}
                    currentUserName={profile?.full_name || (userRole === 'consultant' ? booking?.consultants?.name : booking?.name) || user?.email?.split('@')[0] || 'Participant'}
                    currentUserRole={userRole || 'client'}
                    onSendMessage={handleSendChatMessage}
                    onClose={() => setIsChatOpen(false)}
                    bookingTitle={booking?.consultants?.name ? `Consultation with ${booking.consultants.name}` : undefined}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Participants Sidebar */}
            <AnimatePresence>
              {showParticipants && (
                <motion.div
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 300, opacity: 0 }}
                  transition={{ type: "spring", damping: 25 }}
                  className="absolute top-0 right-0 h-full w-80 bg-background border-l border-border shadow-2xl z-30"
                >
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <h3 className="font-semibold">Participants ({presenceCount})</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowParticipants(false)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Participants List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {/* Local User */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">You</p>
                            <PresenceBadge status={myPresenceStatus} className="text-[10px] py-0 px-1.5 h-4" />
                          </div>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {muted && (
                            <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                              <MicOff className="h-3 w-3 text-destructive" />
                            </div>
                          )}
                          {videoOff && (
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                              <VideoOff className="h-3 w-3" />
                            </div>
                          )}
                          {isScreenSharing && (
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <Monitor className="h-3 w-3 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remote Users Presence */}
                      {presenceParticipants
                        .filter(p => p.id !== user?.id)
                        .map((p, index) => (
                          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 border border-transparent hover:border-border transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {p.name || booking?.consultants?.name || `Participant ${index + 1}`}
                                </p>
                                <PresenceBadge 
                                  status={participantPresenceMap.get(p.id)?.status || 'Online'} 
                                  className="text-[10px] py-0 px-1.5 h-4" 
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {p.email || 'Connected'}
                              </p>
                            </div>
                          </div>
                        ))}

                      {presenceCount <= 1 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Waiting for others to join...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ type: "spring", damping: 25 }}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 w-96 bg-background border border-border rounded-xl shadow-2xl z-30"
                >
                  <div className="flex flex-col max-h-[500px]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        <h3 className="font-semibold">Settings</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSettings(false)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Settings Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Audio Settings */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Mic className="h-4 w-4 text-primary" />
                          <span>Audio</span>
                        </div>
                        <div className="space-y-2 pl-6">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Microphone</span>
                            <Button
                              variant={muted ? "outline" : "default"}
                              size="sm"
                              onClick={() => {
                                const newMuted = !muted;
                                setMuted(newMuted);
                                webrtcServiceRef.current?.toggleAudio(newMuted);
                                toast.success(newMuted ? "Microphone muted" : "Microphone unmuted");
                              }}
                              className="h-8 text-xs"
                            >
                              {muted ? "Unmute" : "Mute"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Video Settings */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Video className="h-4 w-4 text-primary" />
                          <span>Video</span>
                        </div>
                        <div className="space-y-2 pl-6">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Camera</span>
                            <Button
                              variant={videoOff ? "outline" : "default"}
                              size="sm"
                              onClick={() => {
                                const newVideoOff = !videoOff;
                                setVideoOff(newVideoOff);
                                webrtcServiceRef.current?.toggleVideo(newVideoOff);
                                toast.success(newVideoOff ? "Camera stopped" : "Camera started");
                              }}
                              className="h-8 text-xs"
                            >
                              {videoOff ? "Start Video" : "Stop Video"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Screen Share */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Monitor className="h-4 w-4 text-primary" />
                          <span>Screen Share</span>
                        </div>
                        <div className="space-y-2 pl-6">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Share your screen</span>
                            <Button
                              variant={isScreenSharing ? "default" : "outline"}
                              size="sm"
                              onClick={toggleScreenShare}
                              className="h-8 text-xs"
                            >
                              {isScreenSharing ? "Stop Sharing" : "Share Screen"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Meeting Info */}
                      <div className="pt-4 border-t border-border space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <AlertCircle className="h-4 w-4 text-primary" />
                          <span>Meeting Info</span>
                        </div>
                        <div className="space-y-1 pl-6 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Meeting ID:</span>
                            <span className="font-mono">{booking?.meeting_room_id?.substring(0, 15)}...</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Duration:</span>
                            <span>{booking?.session_duration || 60} minutes</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Participants:</span>
                            <span>{presenceCount}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-4 border-t border-border space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>Quick Actions</span>
                        </div>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowParticipants(true);
                              setShowSettings(false);
                            }}
                            className="w-full justify-start gap-2 h-9"
                          >
                            <Users className="h-4 w-4" />
                            View Participants
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              copyMeetingLink();
                              setShowSettings(false);
                            }}
                            className="w-full justify-start gap-2 h-9"
                          >
                            <Copy className="h-4 w-4" />
                            Copy Meeting Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleFullscreen}
                            className="w-full justify-start gap-2 h-9"
                          >
                            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                            {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!callStarted && !callEnded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg text-center space-y-8"
          >
            <div className="bg-gradient-card border border-border rounded-2xl p-8 space-y-6 shadow-lg">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto">
                  <User className="h-10 w-10 text-primary" />
                </div>
                {status === "live" && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-green-400"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>
              
              <div>
                <h2 className="font-display text-2xl font-bold">{booking.consultants?.name || "Consultant"}</h2>
                <p className="text-sm text-muted-foreground mt-1">{booking.consultants?.title}</p>
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  <PresenceBadge status={otherPartyPresenceStatus} label={otherPartyRoleLabel} />
                  <PresenceBadge status={myPresenceStatus} label="You" />
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  {formatBookingDateDisplay(booking.date, 'long')}
                </span>
                <span>·</span>
                <span>{booking.time}</span>
                <span>·</span>
                <span className="font-medium text-primary">{booking.session_duration || 60} minutes</span>
              </div>

              {/* Meeting ID & Link */}
              <div className="space-y-3">
                <div className="bg-secondary/50 border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Meeting ID</p>
                  <p className="font-mono text-sm font-medium">{getCanonicalRoomId(effectiveRoomId, booking)}</p>
                </div>

                {/* Shareable Link */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-medium text-primary">Meeting Link</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyMeetingLink}
                      className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="text-green-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {window.location.origin}/meeting/{getCanonicalRoomId(effectiveRoomId, booking)}
                  </p>
                </div>

                {/* Real-time waiting room participant indicator */}
                {waitingRoomParticipants.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-left space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span>Waiting Room Active</span>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold py-0 h-5">
                        In Room Now
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {waitingRoomParticipants.map((p) => p.name).join(", ")} {waitingRoomParticipants.length === 1 ? "is" : "are"} in the waiting room!
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {userRole === 'client' 
                        ? (isAdmitted ? "Host has admitted you! Click 'Join Meeting' to enter." : "Your consultant is ready. Click 'Join Meeting' to connect.")
                        : "The client is waiting in the room. Click 'Admit Client' to start the live consultation."}
                    </p>
                    <div className="pt-1.5 flex gap-2">
                      {userRole === 'consultant' ? (
                        <Button
                          size="sm"
                          onClick={handleAdmitAndJoin}
                          disabled={callStarted}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 shadow"
                        >
                          <Video className="w-3.5 h-3.5 mr-1.5" />
                          Admit Client & Start Call
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => startCall()}
                          disabled={callStarted}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2 shadow"
                        >
                          <Video className="w-3.5 h-3.5 mr-1.5" />
                          Join Meeting Room
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Meeting Notes & Action Items Quick Access */}
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleNotes()}
                    className="w-full justify-between items-center text-xs h-10 px-3.5 bg-secondary/40 border-border hover:bg-secondary/70 hover:border-primary/40 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckSquare className="h-4 w-4 text-primary" />
                      <span className="font-medium">Meeting Notes & Action Items</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] py-0 px-2 border-primary/30 text-primary bg-primary/5">
                      Collaborative
                    </Badge>
                  </Button>
                </div>
              </div>
            </div>

            {status === "upcoming" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-center gap-2 text-yellow-500">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">Your meeting hasn't started yet</p>
                </div>
                <Countdown
                  targetDate={booking.date}
                  targetTime={booking.time}
                  onTargetReached={loadMeetingAccess}
                />
                <p className="text-xs text-muted-foreground">
                  You can join 5 minutes before the scheduled time
                </p>
                {userRole === 'consultant' && (
                  <div className="pt-2">
                    <Button
                      size="lg"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-base py-6 font-semibold glow-gold shadow-lg"
                      onClick={handleAdmitAndJoin}
                      disabled={callStarted}
                    >
                      <Video className="h-5 w-5" />
                      {callStarted ? "Connecting..." : (waitingRoomParticipants.length > 0 ? "Admit Client & Start Meeting" : "Start Meeting as Host")}
                    </Button>
                  </div>
                )}
                {userRole === 'client' && (waitingRoomParticipants.length > 0 || isAdmitted) && (
                  <div className="pt-2">
                    <Button
                      size="lg"
                      className="w-full glow-gold gap-2 text-base py-6 font-semibold"
                      onClick={() => startCall()}
                      disabled={callStarted}
                    >
                      <Video className="h-5 w-5" />
                      {callStarted ? "Connecting..." : "Join Consultation"}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {status === "live" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
                  <motion.span
                    className="w-2.5 h-2.5 rounded-full bg-green-400"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  Session is ready to join
                </div>
                <Button 
                  size="lg" 
                  className="w-full glow-gold gap-2 text-base py-6 font-semibold" 
                  onClick={() => {
                    if (userRole === 'consultant') {
                      handleAdmitAndJoin();
                    } else {
                      startCall();
                    }
                  }}
                  disabled={callStarted}
                >
                  {hasJoinedBefore ? <RotateCcw className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  {callStarted ? "Connecting..." : (userRole === 'consultant' && waitingRoomParticipants.length > 0 ? "Admit Client & Join Meeting" : (hasJoinedBefore ? "Rejoin Meeting" : "Join Meeting"))}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Make sure your camera and microphone are ready
                </p>
              </motion.div>
            )}

            {status === "rejoin_eligible" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                {followUp && followUp.status === "confirmed" ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-emerald-500 text-sm font-semibold">
                      <CheckCircle className="h-4 w-4" />
                      <span>Confirmed Follow-Up Consultation</span>
                    </div>
                    <p className="text-xs text-emerald-400 font-medium">
                      Scheduled: {followUp.confirmed_date} at {followUp.confirmed_time}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Topic: {followUp.reason}
                    </p>
                    {rejoinDeadline && (
                      <p className="text-[11px] text-muted-foreground">
                        Window expires: {new Date(rejoinDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-amber-500 text-sm font-semibold">
                      {hasJoinedBefore ? <RotateCcw className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                      <span>{hasJoinedBefore ? "7-Day Follow-Up Window Active" : "7-Day Consultation Access Active"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {hasJoinedBefore
                        ? `Both the client and assigned consultant can rejoin this original room for follow-up questions${rejoinDaysRemaining ? ` (${rejoinDaysRemaining} day${rejoinDaysRemaining > 1 ? 's' : ''} left)` : ''}.`
                        : `Both the client and assigned consultant can access this original room for consultation${rejoinDaysRemaining ? ` (${rejoinDaysRemaining} day${rejoinDaysRemaining > 1 ? 's' : ''} left)` : ''}.`}
                    </p>
                    {rejoinDeadline && (
                      <p className="text-[11px] text-amber-500 font-medium">
                        Expires: {new Date(rejoinDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                )}

                <Button 
                  size="lg" 
                  className="w-full glow-gold gap-2 text-base py-6 font-semibold" 
                  onClick={() => startCall()}
                  disabled={callStarted}
                >
                  {hasJoinedBefore ? <RotateCcw className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  {callStarted ? "Connecting to Room..." : (
                    followUp?.status === "confirmed"
                      ? (hasJoinedBefore ? "Rejoin Confirmed Follow-up Call" : "Join Confirmed Follow-up Call")
                      : (hasJoinedBefore ? "Rejoin Meeting" : "Join Meeting")
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Reuses the original consultation meeting room.
                </p>
              </motion.div>
            )}

            {status === "expired" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-secondary border border-border rounded-xl p-4 text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span>7-Day Rejoin Period Expired</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The 7-day follow-up clarification period has passed for this session.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate("/consultants")}
                  >
                    Book New Session
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(dashboardPath)}
                  >
                    My Bookings
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "missed" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">This session has ended</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  The meeting time has passed. You can reschedule for a new time.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => setShowRescheduleDialog(true)}
                  >
                    <Calendar className="h-4 w-4" />
                    Reschedule
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(dashboardPath)}
                  >
                    My Bookings
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "completed" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">This session has ended</p>
                </div>
                <Button variant="outline" onClick={() => navigate(`/review/${booking.id}`)}>
                  Leave a Review
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Meeting</DialogTitle>
            <DialogDescription>
              Select a new date and time for your consultation session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">New Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">New Time</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Note: Please coordinate with your consultant before rescheduling to ensure they're available at the new time.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRescheduleDialog(false)}
              className="flex-1"
              disabled={rescheduling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              className="flex-1 glow-gold"
              disabled={rescheduling}
            >
              {rescheduling ? "Rescheduling..." : "Confirm New Time"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lobby Meeting Notes Dialog */}
      {!callStarted && (
        <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
          <DialogContent className="max-w-md sm:max-w-lg h-[85vh] p-0 overflow-hidden border-border bg-card">
            <MeetingNotesPanel
              roomId={getCanonicalRoomId(effectiveRoomId, booking)}
              booking={booking}
              currentUserId={user?.id || 'unknown'}
              currentUserName={profile?.full_name || (userRole === 'consultant' ? booking?.consultants?.name : booking?.name) || user?.email?.split('@')[0] || 'Participant'}
              currentUserRole={(userRole === 'consultant' ? 'consultant' : userRole === 'admin' ? 'admin' : 'client')}
              onClose={() => setIsNotesOpen(false)}
              broadcastChannel={waitingRoomChannelRef.current}
              activeTabDefault={notesActiveTab}
              className="w-full h-full border-none shadow-none"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

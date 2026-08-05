import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsService } from "@/services/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, User, Clock, ArrowLeft, AlertCircle, Copy, Check, Link2, Maximize, Minimize, Settings, Users, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/PageLoader";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { WebRTCService } from "@/services/webrtcService";

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

function getMeetingStatus(date: string, time: string, duration: number): "upcoming" | "live" | "completed" | "missed" {
  const now = new Date();
  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const joinWindow = new Date(start.getTime() - 5 * 60 * 1000);
  
  if (now < joinWindow) return "upcoming";
  if (now >= joinWindow && now <= end) return "live";
  if (now > end) return "missed";
  return "completed";
}

function canJoinMeeting(date: string, time: string, duration: number): boolean {
  const now = new Date();
  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const joinWindow = new Date(start.getTime() - 5 * 60 * 1000);
  
  // Can join 5 minutes before until meeting ends
  return now >= joinWindow && now <= end;
}

function Countdown({ targetDate, targetTime }: { targetDate: string; targetTime: string }) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const target = new Date(`${targetDate}T${targetTime}`).getTime() - 5 * 60 * 1000;
    const tick = () => setDiff(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, targetTime]);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="flex items-center gap-3 justify-center">
      {[{ v: h, l: "Hours" }, { v: m, l: "Minutes" }, { v: s, l: "Seconds" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center bg-secondary border border-border rounded-xl px-5 py-3 min-w-[70px]">
          <span className="font-display text-3xl font-bold text-primary">{String(v).padStart(2, "0")}</span>
          <span className="text-xs text-muted-foreground mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = {
  upcoming: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  live: "bg-green-500/15 text-green-400 border-green-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  missed: "bg-red-500/15 text-red-400 border-red-500/30",
};
const STATUS_LABELS = { upcoming: "Upcoming", live: "Live Now", completed: "Completed", missed: "Missed" };

export default function MeetingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const dashboardPath = profile?.role === 'admin' ? '/admin' : (profile?.role === 'consultant' || profile?.is_consultant) ? '/consultant/dashboard' : '/my-bookings';

  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const meetingContainerRef = useRef<HTMLDivElement | null>(null);

  const [booking, setBooking] = useState<BookingWithConsultant | null>(null);
  const [loading, setLoading] = useState(true);
  const [callStarted, setCallStarted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [status, setStatus] = useState<"upcoming" | "live" | "completed" | "missed">("upcoming");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualRoomId, setManualRoomId] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [presenceCount, setPresenceCount] = useState<number>(1);
  const [presenceParticipants, setPresenceParticipants] = useState<Array<{ id: string; name?: string; email?: string }>>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  // Copy meeting link to clipboard
  const copyMeetingLink = () => {
    const meetingUrl = `${window.location.origin}/meeting/${booking?.meeting_room_id}`;
    navigator.clipboard.writeText(meetingUrl).then(() => {
      setLinkCopied(true);
      toast.success("Meeting link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  useEffect(() => {
    if (!booking) return;
    const tick = () => setStatus(getMeetingStatus(booking.date, booking.time, booking.session_duration || 60));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [booking]);

  // Timer countdown during active call
  useEffect(() => {
    if (!callStarted || callEnded || !booking || !callStartTime) return;

    const duration = (booking.session_duration || 60) * 60;
    
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
      const remaining = duration - elapsed;
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        toast.warning("Session time has ended");
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
  }, [callStarted, callEnded, booking, callStartTime]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) { 
      navigate("/login", { state: { from: `/meeting/${roomId}` } }); 
      return; 
    }
    
    if (!roomId) { 
      setManualEntry(true); 
      setLoading(false); 
      return; 
    }
    
    (async () => {
      try {
        const allBookings = await bookingsService.getAll();
        const found = (allBookings as BookingWithConsultant[]).find(b => b.meeting_room_id === roomId);
        
        if (!found) {
          console.warn("[Meeting] Meeting not found in database - creating open session context");
          
          const openBooking: BookingWithConsultant = {
            id: roomId?.replace('foundarly-', '') || 'open-meeting',
            user_id: user.id,
            consultant_id: 'open-consultant',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].substring(0, 5),
            session_duration: 60,
            status: 'confirmed',
            meeting_room_id: roomId || 'open-room',
            name: user.email || 'Participant',
            consultants: {
              name: 'Meeting Host',
              title: 'Consultant',
              user_id: 'open-consultant'
            }
          };
          
          setBooking(openBooking);
          setStatus('live');
          setLoading(false);
          return;
        }

        setBooking(found);
        setStatus(getMeetingStatus(found.date, found.time, found.session_duration || 60));
      } catch (err: any) {
        console.error("Failed to load meeting:", err);
        toast.info("Joining meeting in open access mode");
        
        const mockBooking: BookingWithConsultant = {
          id: roomId?.replace('foundarly-', '') || 'test',
          user_id: user.id,
          consultant_id: 'test-consultant',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
          session_duration: 60,
          status: 'confirmed',
          meeting_room_id: roomId || 'test-room',
          name: user.email || 'User',
          consultants: {
            name: 'Meeting Host',
            title: 'Professional Consultant',
            user_id: 'test-consultant'
          }
        };
        
        setBooking(mockBooking);
        setStatus('live');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, roomId, navigate, authLoading]);

  const startCall = useCallback(async () => {
    console.log("=== START CALL FUNCTION CALLED ===");
    
    if (!booking) {
      toast.error("Booking information missing");
      return;
    }

    if (!canJoinMeeting(booking.date, booking.time, booking.session_duration || 60)) {
      toast.error("Meeting can only be joined 5 minutes before the scheduled time");
      return;
    }

    try {
      setCallStarted(true);
      setCallStartTime(new Date());
      toast.info("Connecting to real-time WebRTC video call...");

      const userId = user?.id || `user_${Math.random().toString(36).substring(2, 9)}`;
      const userName = user?.email?.split('@')[0] || 'Participant';

      const service = new WebRTCService(userId, {
        name: userName,
        email: user?.email || ''
      });
      webrtcServiceRef.current = service;

      // Event handlers
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

      // 1. Initialize local stream
      const stream = await service.initLocalStream(!videoOff, !muted);
      setLocalStream(stream);

      // 2. Join signaling channel
      await service.joinRoom(roomId || 'default-room');

      toast.success("Connected to meeting room!");
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
    }
  }, [booking, roomId, user, videoOff, muted]);

  const endCall = async () => {
    try {
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.leave();
        webrtcServiceRef.current = null;
      }
      setCallStarted(false);
      setCallEnded(true);
      setCallStartTime(null);
      setTimeRemaining(null);
      setRemoteParticipants(new Map());
      setLocalStream(null);
      
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (error) {
      console.error("Error ending call:", error);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          <div className="h-5 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">{new Date(booking.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
                {remoteUsersList.length > 0 ? (
                  <div className="w-full h-full relative">
                    <RemoteVideo 
                      stream={remoteUsersList[0].stream} 
                      name={booking?.consultants?.name || 'Participant'} 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full z-10">
                      <span className="text-sm font-medium text-white">
                        {booking?.consultants?.name || `Participant`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <LocalVideo 
                      stream={localStream} 
                      videoOff={videoOff} 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full z-10">
                      <span className="text-sm font-medium text-white">You</span>
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
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full z-10">
                        <span className="text-xs font-medium text-white">You</span>
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

            {/* Participants Count */}
            <div className="absolute top-6 right-6 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowParticipants(!showParticipants)}
                className="bg-background/80 backdrop-blur-md border border-border rounded-lg px-4 py-2 shadow-lg hover:bg-background/90"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{presenceCount}</span>
                </div>
              </Button>
            </div>

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
                          <p className="font-medium text-sm">You</p>
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
                              <p className="font-medium text-sm">
                                {p.name || booking?.consultants?.name || `Participant ${index + 1}`}
                              </p>
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
              </div>

              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  {new Date(booking.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
                  <p className="font-mono text-sm font-medium">{booking.meeting_room_id}</p>
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
                    {window.location.origin}/meeting/{booking.meeting_room_id}
                  </p>
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
                  <p className="text-sm font-medium">Session hasn't started yet</p>
                </div>
                <Countdown targetDate={booking.date} targetTime={booking.time} />
                <p className="text-xs text-muted-foreground">
                  You can join 5 minutes before the scheduled time
                </p>
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
                  className="w-full glow-gold gap-2 text-base py-6" 
                  onClick={() => {
                    console.log("Join button clicked!");
                    if (canJoinMeeting(booking.date, booking.time, booking.session_duration || 60)) {
                      startCall();
                    } else {
                      toast.error("You can only join 5 minutes before the scheduled time");
                    }
                  }}
                  disabled={callStarted || !canJoinMeeting(booking.date, booking.time, booking.session_duration || 60)}
                >
                  <Video className="h-5 w-5" /> 
                  {callStarted ? "Loading..." : "Join Video Call"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Make sure your camera and microphone are ready
                </p>
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
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, MessageSquare, CreditCard, Video, Star, AlertCircle, Trash2, LogIn, CheckCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { bookingsService } from "@/services/bookings";
import { consultantDashboardService } from "@/services/consultantDashboard";
import { emailService } from "@/services/email";
import { useNavigate, Link } from "react-router-dom";
import { SkeletonList } from "@/components/PageLoader";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Booking {
  id: string; consultant_id: string; name: string; email: string; date: string; time: string;
  message: string | null; status: "pending" | "confirmed" | "completed" | "cancelled";
  payment_status: "pending" | "paid" | "refunded"; session_duration: number | null;
  session_price: number | null; meeting_room_id: string | null; created_at: string;
  consultants?: { name: string; title: string };
  reschedule_status?: string;
  reschedule_requested_by?: string | null;
  reschedule_reason?: string | null;
  reschedule_count?: number;
}

function getMeetingStatus(date: string, time: string, duration: number) {
  const now = new Date();
  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const joinWindow = new Date(start.getTime() - 5 * 60 * 1000);
  if (now < joinWindow) return "upcoming";
  if (now >= joinWindow && now <= end) return "live";
  return "ended";
}

function Particle({ x, y, size, delay, dur }: { x: string; y: string; size: number; delay: number; dur: number }) {
  return (
    <motion.div className="absolute rounded-full bg-primary/25 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -18, 0], opacity: [0.1, 0.4, 0.1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }} />
  );
}

const PARTICLES = [
  { x: "5%",  y: "20%", size: 5, delay: 0,   dur: 5.5 },
  { x: "92%", y: "15%", size: 4, delay: 1.2, dur: 6   },
  { x: "84%", y: "65%", size: 6, delay: 2,   dur: 7   },
  { x: "8%",  y: "68%", size: 3, delay: 0.7, dur: 5   },
];

function BookingCard({ booking, index, onRetry, onCancel, onRemove, onReschedule, retryingId, formatPrice, navigate }: {
  booking: Booking; index: number; onRetry: (b: Booking) => void; onCancel: (id: string) => void;
  onRemove: (id: string) => void; onReschedule: (b: Booking) => void;
  retryingId: string | null; formatPrice: (v: number) => string; navigate: any;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const statusStyle: Record<string, string> = {
    confirmed: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-green-500/15 text-green-600 border-green-500/30",
    pending:   "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const payStyle: Record<string, string> = {
    paid:     "bg-green-500/15 text-green-600 border-green-500/30",
    pending:  "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    refunded: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const consultantObj = Array.isArray(booking?.consultants) ? (booking.consultants[0] as any) : booking?.consultants;
  const consultantName = consultantObj?.name || "Consultant";
  const consultantTitle = consultantObj?.title || "Professional Consultant";
  const status = booking?.status || "pending";
  const paymentStatus = booking?.payment_status || "pending";
  const bookingId = booking?.id || "";

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-gradient-card border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 4px 24px -8px hsl(45 100% 50% / 0.06)" }}>
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(45 100% 50% / 0.06) 0%, transparent 70%)" }} />
      {/* Top accent */}
      <motion.div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-primary/60 to-transparent"
        initial={{ width: 0 }} animate={inView ? { width: "50%" } : {}} transition={{ duration: 0.7, delay: index * 0.08 + 0.3 }} />

      {/* Header */}
      <div className="flex items-start justify-between p-6 pb-4">
        <div>
          <h3 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-200">
            {consultantName}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{consultantTitle}</p>
        </div>
        <div className="flex flex-col gap-1.5 items-end shrink-0 ml-4">
          <Badge variant="outline" className={`text-xs ${statusStyle[status] || ""}`}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
          </Badge>
          <Badge variant="outline" className={`text-xs ${payStyle[paymentStatus] || ""}`}>
            {paymentStatus === "paid" ? "Paid" : paymentStatus === "pending" ? "Payment Pending" : "Refunded"}
          </Badge>
        </div>
      </div>

      {/* Details grid */}
      <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Calendar, label: "Date",     value: booking?.date ? formatDate(booking.date) : "N/A" },
          { icon: Clock,    label: "Timing",   value: booking?.time && booking.time !== 'Flexible' ? booking.time : "Flexible" },
          { icon: User,     label: "Booked by",value: booking?.name || "User" },
          { icon: CreditCard, label: "Booking ID", value: bookingId ? bookingId.slice(0, 8) + "…" : "N/A" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Duration + Price */}
      {(booking?.session_duration || booking?.session_price) && (
        <div className="mx-6 mb-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-4">
          {booking.session_duration && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
                <p className="text-sm font-medium">{booking.session_duration} minutes</p>
              </div>
            </div>
          )}
          {booking.session_price && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
                <p className="text-sm font-bold text-primary">{formatPrice(booking.session_price)}</p>
                <p className="text-[9px] text-muted-foreground/60">*Rates may vary — can go up or down</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {booking?.message && (
        <div className="mx-6 mb-4 pt-4 border-t border-border/60 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Your Message</p>
            <p className="text-sm text-muted-foreground">{booking.message}</p>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-border/60 flex items-center justify-between flex-wrap gap-3 bg-secondary/20">
        <p className="text-xs text-muted-foreground">
          Booked {booking?.created_at ? new Date(booking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pending payment */}
          {booking.payment_status === "pending" && booking.status === "pending" && (
            <>
              <span className="flex items-center gap-1.5 text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3 py-1">
                <AlertCircle className="h-3 w-3" /> Payment verification pending
              </span>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:bg-secondary gap-1.5" onClick={() => navigate(`/upi-payment?booking=${booking.id}`)}>
                View Payment Details
              </Button>
            </>
          )}
          {/* Join / View call */}
          {booking.meeting_room_id && booking.status === "confirmed" && (() => {
            const ms = getMeetingStatus(booking.date, booking.time, booking.session_duration || 60);
            return ms === "live" ? (
              <Link to={`/meeting/${booking.meeting_room_id}`}>
                <Button size="sm" className="gap-2 glow-gold-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <Video className="h-3.5 w-3.5" /> Join Call
                </Button>
              </Link>
            ) : ms === "upcoming" ? (
              <>
                <Link to={`/meeting/${booking.meeting_room_id}`}>
                  <Button size="sm" variant="outline" className="gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5" /> View Session
                  </Button>
                </Link>
                {(!booking.reschedule_status || booking.reschedule_status === "none" || booking.reschedule_status === "rejected") && (
                  <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => onReschedule(booking)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Reschedule
                  </Button>
                )}
              </>
            ) : ms === "ended" ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
                  <AlertCircle className="h-3 w-3" /> Meeting Ended
                </span>
                {(!booking.reschedule_status || booking.reschedule_status === "none" || booking.reschedule_status === "rejected") && (
                  <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => onReschedule(booking)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Reschedule
                  </Button>
                )}
              </>
            ) : null;
          })()}
          {booking.status === "completed" && (
            <Link to={`/review/${booking.id}`}>
              <Button size="sm" variant="outline" className="gap-2 text-xs">
                <Star className="h-3.5 w-3.5 text-primary" /> Leave Review
              </Button>
            </Link>
          )}
          {/* Remove cancelled bookings */}
          {booking.status === "cancelled" && (
            <Button size="sm" variant="ghost"
              className="text-xs text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={() => onRemove(booking.id)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function MyBookingsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [manualMeetingId, setManualMeetingId] = useState("");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [4, -4]);
  const rotateY = useTransform(mouseX, [-300, 300], [-4, 4]);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && profile?.role === 'admin') { navigate("/admin", { replace: true }); return; }
    if (!authLoading && (profile?.role === 'consultant' || profile?.is_consultant)) { navigate("/consultant/dashboard", { replace: true }); return; }
    if (user) loadBookings();
  }, [user, profile, authLoading, navigate]);

  const loadBookings = async () => {
    try { setBookings(await bookingsService.getByUserId(user!.id, user!.email)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleRetryPayment = async (booking: Booking) => {
    // Redirect to UPI payment page
    navigate(`/upi-payment?booking=${booking.id}`);
  };

  const handleCancelBooking = async () => {
    if (!cancelId) return;
    const idToCancel = cancelId;
    setCancelId(null);
    
    try {
      // Update status to cancelled
      await bookingsService.update(idToCancel, { status: "cancelled" });
      // Update local state immediately
      setBookings(prev => prev.map(b => 
        b.id === idToCancel ? { ...b, status: "cancelled" as const } : b
      ));
      toast.success("Booking cancelled.");
    } catch (err: any) {
      console.error("Cancel booking error:", err);
      toast.error(err?.message || "Failed to cancel booking.");
      // Reload from DB on error
      loadBookings();
    }
  };

  const handleRemoveBooking = async () => {
    if (!removeId) return;
    const idToRemove = removeId;
    setRemoveId(null);
    
    try {
      // Try to delete from database first
      await bookingsService.delete(idToRemove);
      // Only remove from local state if DB delete succeeds
      setBookings(prev => prev.filter(b => b.id !== idToRemove));
      toast.success("Booking removed.");
    } catch (err: any) {
      console.error("Remove booking error:", err);
      // If DB delete fails, still remove from local state for better UX
      setBookings(prev => prev.filter(b => b.id !== idToRemove));
      toast.success("Booking removed from view.");
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleJoinWithId = () => {
    if (!manualMeetingId.trim()) {
      toast.error("Please enter a meeting ID");
      return;
    }
    navigate(`/meeting/${manualMeetingId.trim()}`);
  };

  const handleRescheduleRequest = async () => {
    if (!selectedBooking || !newDate || !newTime) {
      toast.error("Please select new date and time");
      return;
    }

    try {
      await bookingsService.reschedule(selectedBooking.id, newDate, newTime);
      toast.success("Meeting rescheduled successfully!");
      setRescheduleDialogOpen(false);
      setSelectedBooking(null);
      setRescheduleReason("");
      setNewDate("");
      setNewTime("");
      loadBookings();
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error("Failed to reschedule meeting");
    }
  };

  const openRescheduleDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setRescheduleDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-24">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="mb-12 space-y-3">
              <div className="h-10 bg-muted rounded-full w-48" />
              <div className="h-4 bg-muted rounded-full w-64" />
            </div>
            <SkeletonList count={3} />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* ── Hero ── */}
      <section ref={containerRef} onMouseMove={handleMouseMove}
        className="relative pt-36 pb-16 bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
        {[300, 480, 640].map((s, i) => (
          <motion.div key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 pointer-events-none"
            style={{ width: s, height: s }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.15 - i * 0.04, 0.05, 0.15 - i * 0.04] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }} />
        ))}
        <motion.svg className="absolute top-10 right-16 opacity-[0.09] pointer-events-none" width="140" height="140" viewBox="0 0 140 140"
          animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
          <circle cx="70" cy="70" r="62" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1" strokeDasharray="8 6" />
          <circle cx="70" cy="70" r="42" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.5" strokeDasharray="4 8" />
        </motion.svg>
        {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

        <div className="container mx-auto px-6 relative z-10">
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/8 mb-7"
            initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">Dashboard</span>
          </motion.div>
          <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
            <motion.h1 className="font-display text-5xl md:text-6xl font-bold leading-tight"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}>
              My{" "}
              <span className="relative inline-block">
                <span className="text-gradient-gold">Bookings</span>
                <motion.div className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-amber-400"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h1>
          </motion.div>
          <motion.p className="mt-5 text-muted-foreground text-sm md:text-base max-w-md"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
            Track your consultation sessions and their status.
          </motion.p>

          {/* Join with Meeting ID button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-6"
          >
            <Button
              variant="outline"
              onClick={() => setShowJoinDialog(true)}
              className="gap-2 border-primary/30 hover:bg-primary/5"
            >
              <LogIn className="h-4 w-4" />
              Join with Meeting ID
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Bookings list ── */}
      <section className="py-16 bg-background relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          {bookings.length === 0 ? (
            <motion.div className="bg-gradient-card border border-border rounded-2xl p-16 text-center"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Calendar className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">No Bookings Yet</h3>
              <p className="text-muted-foreground text-sm mb-6">You haven't booked any consultation sessions yet.</p>
              <Button onClick={() => navigate("/booking")} className="glow-gold-sm">Book Your First Session</Button>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {bookings.map((booking, i) => (
                <BookingCard key={booking.id} booking={booking} index={i}
                  onRetry={handleRetryPayment} onCancel={setCancelId} onRemove={setRemoveId}
                  onReschedule={openRescheduleDialog}
                  retryingId={retryingId} formatPrice={formatPrice} navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the booking as cancelled. Since no payment was completed, no refund is needed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this booking?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the cancelled booking from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, remove it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Join with Meeting ID Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Join Meeting
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your meeting ID to join the video call
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Meeting ID</label>
              <Input
                placeholder="foundarly-xxxxx"
                value={manualMeetingId}
                onChange={(e) => setManualMeetingId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinWithId()}
                className="bg-background border-border font-mono text-center"
              />
              <p className="text-xs text-muted-foreground">
                You can find your meeting ID in the booking confirmation email or on your booking card above.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </Button>
            <Button className="glow-gold-sm gap-2" onClick={handleJoinWithId}>
              <Video className="h-4 w-4" />
              Join Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>
              Send a reschedule request to the consultant. They will need to approve the new date and time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">Reason for Reschedule</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why you need to reschedule..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="newDate">Proposed New Date</Label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-2"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="newTime">Proposed New Time</Label>
              <Input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRescheduleDialogOpen(false);
              setSelectedBooking(null);
              setRescheduleReason("");
              setNewDate("");
              setNewTime("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleRescheduleRequest} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

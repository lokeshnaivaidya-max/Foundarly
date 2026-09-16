import { useState, useEffect } from "react";
import { 
  Search, Download, Video, Trash2, Copy, Check, ExternalLink, 
  Mail, CheckCircle, X, CreditCard, FileText, XCircle,
  Clock, RefreshCw, AlertTriangle
} from "lucide-react";
import { validateUUID } from "@/utils/security";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { bookingsService } from "@/services/bookings";
import { emailService } from "@/services/email";
import { upiPaymentService } from "@/services/upiPayment";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import {
  BookingLifecycleState,
  getBookingState,
  isBookingConfirmed,
  isBookingPending,
  isBookingRejected,
} from "@/utils/bookingLifecycle";

export type { BookingLifecycleState };
export { getBookingState, isBookingConfirmed, isBookingPending, isBookingRejected };

const statusColor = (b: any) => {
  const state = typeof b === 'string' ? b : getBookingState(b);
  if (state === "confirmed" || state === "completed") return "bg-green-500/15 text-green-500 border-green-500/30";
  if (state === "rejected" || state === "cancelled") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
};

const paymentColor = (s?: string) => {
  const st = (s || "").toLowerCase().trim();
  if (st === "paid") return "text-green-500";
  if (st === "pending") return "text-yellow-600";
  if (st === "rejected" || st === "failed") return "text-destructive";
  return "text-muted-foreground";
};

const getConsultantName = (b: any): string => {
  if (b?.consultant_name) return b.consultant_name;
  if (Array.isArray(b?.consultants)) return b.consultants[0]?.name || 'N/A';
  return b?.consultants?.name || 'N/A';
};

export default function AdminBookings() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showRescheduleOnly, setShowRescheduleOnly] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  // Rejection dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // SMTP test state
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<any | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState("lumora.verify@gmail.com");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any | null>(null);

  const runSmtpTest = async () => {
    setTestingSmtp(true);
    setSmtpDialogOpen(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/verify-smtp');
      const data = await res.json();
      setSmtpResult(data);
      if (data.success) {
        toast.success(data.message || "SMTP server authenticated and connected successfully!");
      } else {
        toast.warning(data.error || "SMTP authentication verification failed.");
      }
    } catch (err: any) {
      setSmtpResult({
        success: false,
        error: err.message || "Failed to reach /api/verify-smtp endpoint",
      });
      toast.error("Error communicating with SMTP diagnostic endpoint");
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes("@")) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testEmailRecipient }),
      });
      const data = await res.json();
      setTestEmailResult(data);
      if (data.success) {
        toast.success(`Test confirmation email sent to ${testEmailRecipient}!`);
      } else {
        toast.error(data.error || "Failed to send test email.");
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        error: err?.message || "Failed to communicate with test email endpoint.",
      });
      toast.error("Failed to dispatch test email.");
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Form state
  const [form, setForm] = useState({
    status: "pending" as "pending" | "confirmed" | "completed" | "cancelled" | "rejected",
    payment_status: "pending" as "pending" | "paid" | "refunded" | "rejected",
    meeting_room_id: "",
    date: "",
    time: ""
  });

  useEffect(() => {
    loadBookings();

    const channel = supabase
      .channel('admin-bookings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upi_payments' }, () => {
        loadBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBookings = async () => {
    try {
      const data = await bookingsService.getAll();
      
      // Fetch all UPI payments in bulk for performance
      let paymentsMap = new Map<string, any>();
      try {
        const allPayments = await upiPaymentService.getAllPayments();
        allPayments.forEach(p => {
          if (p.booking_id) {
            paymentsMap.set(p.booking_id, p);
          }
        });
      } catch (err) {
        console.warn("Could not fetch bulk UPI payments:", err);
      }

      const bookingsWithPayments = data.map(booking => {
        return {
          ...booking,
          upi_payment: paymentsMap.get(booking.id) || null,
        };
      });

      setBookings(bookingsWithPayments);
    } catch (error) {
      console.error('[AdminBookings] Error loading bookings:', error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (booking: any) => {
    setSelectedBooking(booking);
    setForm({
      status: booking.status,
      payment_status: booking.payment_status,
      meeting_room_id: booking.meeting_room_id || "",
      date: booking.date,
      time: booking.time
    });
    setDialogOpen(true);
  };

  const openDelete = (booking: any) => {
    setSelectedBooking(booking);
    setDeleteDialogOpen(true);
  };

  const openRejectDialog = (booking: any) => {
    setBookingToReject(booking);
    setRejectionReason("Payment verification failed / booking cancelled by administrator");
    setRejectDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedBooking) return;

    setSaving(true);
    try {
      const updates: any = {
        status: form.status,
        payment_status: form.payment_status,
        date: form.date,
        time: form.time
      };

      // Auto-generate meeting room if status is confirmed and no room exists
      if (form.status === "confirmed" && !form.meeting_room_id) {
        updates.meeting_room_id = `foundarly-${selectedBooking.id}`;
      } else if (form.meeting_room_id) {
        updates.meeting_room_id = form.meeting_room_id;
      }

      await bookingsService.update(selectedBooking.id, updates);
      toast.success("Booking updated successfully");
      setDialogOpen(false);
      loadBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error("Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBooking) return;

    setDeleting(true);
    try {
      await bookingsService.delete(selectedBooking.id);
      toast.success("Booking deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedBooking(null);
      loadBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error("Failed to delete booking");
    } finally {
      setDeleting(false);
    }
  };

  const copyMeetingLink = (meetingRoomId: string) => {
    const link = `${window.location.origin}/meeting/${meetingRoomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(meetingRoomId);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const sendBookingEmail = async (bookingId: string) => {
    setSendingEmailId(bookingId);
    try {
      const result = await emailService.sendBookingConfirmation(bookingId);
      if (result.success) {
        toast.success("Confirmation email sent successfully!");
        setBookings(prev => prev.map(b => 
          b.id === bookingId ? { ...b, email_sent: true } : b
        ));
      } else {
        console.warn("Email sending failed:", result.error);
        toast.error(result.error || "Failed to send confirmation email. Please check email service configuration.");
      }
    } catch (error: any) {
      console.error('Email error:', error);
      toast.error(error?.message || "Failed to send confirmation email.");
    } finally {
      setSendingEmailId(null);
    }
  };

  const approveBooking = async (booking: any) => {
    setApprovingId(booking.id);
    const toastId = toast.loading("Confirming booking & creating meeting room...");
    try {
      const meetingRoomId = booking.meeting_room_id || `foundarly-${booking.id}`;
      const updates: any = {
        status: "confirmed",
        payment_status: "paid",
        meeting_room_id: meetingRoomId,
      };

      // 1. Persist status and meeting room to database first
      await bookingsService.update(booking.id, updates);
      
      // 2. If there's an associated UPI payment, mark as verified
      if (booking.upi_payment && booking.upi_payment.id) {
        try {
          const validAdminId = (user?.id && validateUUID(user.id)) ? user.id : null;
          await upiPaymentService.verifyPayment(booking.upi_payment.id, validAdminId, "Approved by administrator");
        } catch (upiErr) {
          console.warn("UPI payment verify warning:", upiErr);
        }
      }

      // 3. Update local state immediately so user sees Confirmed status right away without Needs Verification
      setBookings(prev => prev.map(b => 
        b.id === booking.id ? { 
          ...b, 
          status: "confirmed", 
          payment_status: "paid", 
          meeting_room_id: meetingRoomId,
          upi_payment: b.upi_payment ? { ...b.upi_payment, status: "verified" } : null 
        } : b
      ));

      // 4. Send confirmation emails
      toast.loading("Sending confirmation emails...", { id: toastId });
      const emailRes = await emailService.sendBookingConfirmation(booking.id);
      if (emailRes.success) {
        toast.success("Booking confirmed! Confirmation emails dispatched to attendee and consultant.", { id: toastId });
        setBookings(prev => prev.map(b => 
          b.id === booking.id ? { ...b, email_sent: true } : b
        ));
      } else {
        toast.warning(
          `Booking confirmed in database! Email notice: ${emailRes.error || "Email delivery failed"}`,
          { id: toastId, duration: 10000 }
        );
      }

      await loadBookings();
    } catch (error: any) {
      console.error('Error approving booking:', error);
      toast.error(error.message || "Failed to approve booking", { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!bookingToReject) return;
    setIsRejecting(true);
    const toastId = toast.loading("Rejecting booking...");

    try {
      const validAdminId = (user?.id && validateUUID(user.id)) ? user.id : null;
      const reason = rejectionReason.trim() || "Booking cancelled by administrator";

      // 1. If there's an associated UPI payment record, reject it too
      if (bookingToReject.upi_payment && bookingToReject.upi_payment.id) {
        try {
          await upiPaymentService.rejectPayment(bookingToReject.upi_payment.id, validAdminId, reason);
        } catch (upiErr) {
          console.warn("UPI payment reject error:", upiErr);
        }
      }

      // 2. Update booking status in database
      let finalStatus = 'rejected';
      try {
        await bookingsService.update(bookingToReject.id, {
          status: 'rejected' as any,
          payment_status: 'rejected',
          reschedule_reason: reason,
        });
      } catch (err: any) {
        console.warn("Retrying status update with 'cancelled' due to DB constraint:", err);
        finalStatus = 'cancelled';
        await bookingsService.update(bookingToReject.id, {
          status: 'cancelled',
          payment_status: 'rejected',
          reschedule_reason: reason,
        });
      }

      // 3. Immediately update local state
      setBookings(prev => prev.map(b => 
        b.id === bookingToReject.id 
          ? { 
              ...b, 
              status: finalStatus, 
              payment_status: 'rejected', 
              rejection_reason: reason,
              reschedule_reason: reason,
              upi_payment: b.upi_payment ? { ...b.upi_payment, status: 'rejected' } : null 
            }
          : b
      ));

      setRejectDialogOpen(false);
      setBookingToReject(null);
      setRejectionReason("");

      // 4. Send Rejection Email notification to client
      toast.loading("Sending cancellation email to attendee...", { id: toastId });
      const emailRes = await emailService.sendBookingRejection(bookingToReject.id, reason);
      if (emailRes.success) {
        toast.success("Booking rejected and cancellation email delivered.", { id: toastId });
      } else {
        toast.warning(
          `Booking marked as rejected in database. Email notice: ${emailRes.error || "Email delivery failed"}`,
          { id: toastId, duration: 10000 }
        );
      }

      await loadBookings();
    } catch (error: any) {
      console.error("Error rejecting booking:", error);
      toast.error(error.message || "Failed to reject booking", { id: toastId });
    } finally {
      setIsRejecting(false);
    }
  };

  const openPaymentDialog = (booking: any) => {
    if (!booking.upi_payment) {
      const fallbackPayment = {
        id: `direct-${booking.id}`,
        booking_id: booking.id,
        customer_name: booking.name,
        customer_email: booking.email,
        customer_phone: booking.phone || 'N/A',
        payment_amount: booking.session_price || 0,
        transaction_id: 'DIRECT_VERIFICATION',
        status: booking.payment_status || 'pending',
        created_at: booking.created_at,
        is_direct: true,
      };
      setSelectedPayment(fallbackPayment);
    } else {
      setSelectedPayment(booking.upi_payment);
    }
    setSelectedBooking(booking);
    setAdminNotes("");
    setPaymentDialogOpen(true);
  };

  const handleVerifyPayment = async () => {
    if (!selectedPayment) return;
    const targetBooking = selectedBooking || bookings.find(b => b.id === selectedPayment?.booking_id);
    if (!targetBooking) return;
    
    setVerifyingPayment(true);
    const toastId = toast.loading("Verifying payment & confirming booking...");

    try {
      const validAdminId = (user?.id && validateUUID(user.id)) ? user.id : null;
      
      // 1. If actual UPI payment record exists, verify it
      if (!selectedPayment.is_direct && selectedPayment.id) {
        try {
          await upiPaymentService.verifyPayment(selectedPayment.id, validAdminId, adminNotes || "Payment verified by administrator");
        } catch (upiErr) {
          console.warn("UPI payment verify error:", upiErr);
        }
      }

      // 2. Persist confirmed booking and meeting room in database
      const meetingRoomId = targetBooking.meeting_room_id || `foundarly-${targetBooking.id}`;
      await bookingsService.update(targetBooking.id, {
        status: "confirmed",
        payment_status: "paid",
        meeting_room_id: meetingRoomId,
      });

      // 3. Update local state immediately
      setBookings(prev => prev.map(b => 
        b.id === targetBooking.id 
          ? { 
              ...b, 
              status: "confirmed", 
              payment_status: "paid", 
              meeting_room_id: meetingRoomId,
              upi_payment: b.upi_payment ? { ...b.upi_payment, status: "verified" } : null 
            }
          : b
      ));

      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      setSelectedBooking(null);
      setAdminNotes("");

      // 4. Send confirmation emails in background
      toast.loading("Sending confirmation emails...", { id: toastId });
      const emailRes = await emailService.sendBookingConfirmation(targetBooking.id);
      
      if (emailRes.success) {
        toast.success("Payment verified! Booking confirmed and confirmation emails delivered.", { id: toastId });
        setBookings(prev => prev.map(b => 
          b.id === targetBooking.id ? { ...b, email_sent: true } : b
        ));
      } else {
        toast.warning(
          `Booking confirmed in database! Confirmation email notice: ${emailRes.error || "Email delivery failed"}`,
          { id: toastId, duration: 10000 }
        );
      }

      await loadBookings();
    } catch (error: any) {
      console.error("Payment verification error:", error);
      toast.error(error.message || "Failed to verify payment", { id: toastId });
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleRejectPayment = () => {
    const targetBooking = selectedBooking || bookings.find(b => b.id === selectedPayment?.booking_id);
    setPaymentDialogOpen(false);
    if (targetBooking) {
      openRejectDialog(targetBooking);
    }
  };

  const exportToCSV = () => {
    try {
      const headers = [
        'Booking ID',
        'Client Name',
        'Client Email',
        'Consultant',
        'Date',
        'Time',
        'Duration (min)',
        'Price',
        'Meeting Room ID',
        'Payment Status',
        'Booking Status',
        'Participants',
        'Created At'
      ];

      const rows = filtered.map(b => [
        b.id,
        b.name,
        b.email,
        b.consultants?.name || 'N/A',
        new Date(b.date).toLocaleDateString(),
        b.time,
        b.session_duration || 'N/A',
        b.session_price || 'N/A',
        b.meeting_room_id || 'Not set',
        b.payment_status,
        b.status,
        b.participants_count || 0,
        new Date(b.created_at).toLocaleString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `bookings-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${filtered.length} bookings to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export CSV");
    }
  };

  // Status-based counts
  const stats = {
    total: bookings.length,
    pending: bookings.filter(isBookingPending).length,
    confirmed: bookings.filter(isBookingConfirmed).length,
    rejected: bookings.filter(isBookingRejected).length,
    completed: bookings.filter(b => (b.status || "").toLowerCase().trim() === "completed").length,
    rescheduleRequests: bookings.filter(b => (b.status || "").toLowerCase().trim() === "missed" && (b.participants_count || 0) < 2).length,
  };

  // Filter and sort newest bookings first
  const filtered = bookings
    .filter((b) => {
      const idStr = (b.id || "").toLowerCase();
      const nameStr = (b.name || "").toLowerCase();
      const emailStr = (b.email || "").toLowerCase();
      const consultantNameStr = getConsultantName(b).toLowerCase();
      const searchStr = search.trim().toLowerCase();

      const matchesSearch = !searchStr || 
        idStr.includes(searchStr) || 
        nameStr.includes(searchStr) || 
        emailStr.includes(searchStr) || 
        consultantNameStr.includes(searchStr);

      let matchesStatus = true;
      if (statusFilter === "pending") {
        matchesStatus = isBookingPending(b);
      } else if (statusFilter === "confirmed") {
        matchesStatus = isBookingConfirmed(b);
      } else if (statusFilter === "rejected") {
        matchesStatus = isBookingRejected(b);
      } else if (statusFilter === "completed") {
        matchesStatus = (b.status || "").toLowerCase().trim() === "completed";
      }

      const needsReschedule = (b.status || "").toLowerCase().trim() === "missed" && (b.participants_count || 0) < 2;
      const matchesReschedule = !showRescheduleOnly || needsReschedule;

      return matchesSearch && matchesStatus && matchesReschedule;
    })
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.date || 0).getTime();
      const timeB = new Date(b.created_at || b.date || 0).getTime();
      return timeB - timeA;
    });

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Header with stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Manage Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">{stats.total} total bookings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runSmtpTest} 
              disabled={testingSmtp}
              className="text-xs border-primary/30 hover:bg-primary/10 text-foreground"
            >
              <Mail className={`h-4 w-4 mr-1.5 text-primary ${testingSmtp ? 'animate-spin' : ''}`} />
              {testingSmtp ? "Testing SMTP..." : "Test SMTP Connection"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div 
            className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${
              statusFilter === "all" ? "border-primary shadow-sm" : "border-border hover:border-primary/50"
            }`}
            onClick={() => setStatusFilter("all")}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div 
            className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${
              statusFilter === "pending" ? "border-yellow-500 shadow-sm" : "border-yellow-500/20 hover:border-yellow-500/50"
            }`}
            onClick={() => setStatusFilter("pending")}
          >
            <p className="text-xs text-yellow-600 uppercase tracking-wider mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div 
            className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${
              statusFilter === "confirmed" ? "border-primary shadow-sm" : "border-primary/20 hover:border-primary/50"
            }`}
            onClick={() => setStatusFilter("confirmed")}
          >
            <p className="text-xs text-primary uppercase tracking-wider mb-1">Confirmed</p>
            <p className="text-2xl font-bold text-primary">{stats.confirmed}</p>
          </div>
          <div 
            className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${
              statusFilter === "rejected" ? "border-destructive shadow-sm" : "border-destructive/20 hover:border-destructive/50"
            }`}
            onClick={() => setStatusFilter("rejected")}
          >
            <p className="text-xs text-destructive uppercase tracking-wider mb-1">Rejected</p>
            <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
          </div>
          <div 
            className="bg-card border border-orange-500/20 rounded-lg p-4 cursor-pointer hover:bg-orange-500/5 transition-colors"
            onClick={() => setShowRescheduleOnly(!showRescheduleOnly)}
          >
            <p className="text-xs text-orange-600 uppercase tracking-wider mb-1">Reschedule</p>
            <p className="text-2xl font-bold text-orange-600">{stats.rescheduleRequests}</p>
            {showRescheduleOnly && <p className="text-xs text-orange-500 mt-1">Filtered</p>}
          </div>
        </div>
      </div>

      {/* Prominent Workflow Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: "all", label: "All Bookings", count: stats.total, badgeClass: "bg-muted text-foreground" },
          { id: "pending", label: "Pending", count: stats.pending, badgeClass: "bg-yellow-500/20 text-yellow-600" },
          { id: "confirmed", label: "Confirmed", count: stats.confirmed, badgeClass: "bg-primary/20 text-primary" },
          { id: "rejected", label: "Rejected", count: stats.rejected, badgeClass: "bg-destructive/20 text-destructive" },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              id={`booking-filter-tab-${tab.id}`}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setShowRescheduleOnly(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 border ${
                isActive
                  ? "bg-primary/10 border-primary text-primary shadow-sm"
                  : "bg-card hover:bg-muted/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                isActive ? "bg-primary text-primary-foreground" : tab.badgeClass
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {showRescheduleOnly && (
          <Badge variant="outline" className="text-orange-600 border-orange-500/30 bg-orange-500/10">
            Showing Reschedule Requests Only
            <X className="h-3 w-3 ml-2 cursor-pointer" onClick={() => setShowRescheduleOnly(false)} />
          </Badge>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by attendee name, email, consultant, or ID..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 bg-card border-border" 
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden w-full">
        <Table className="w-full min-w-[1000px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">ID</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Attendee</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Consultant</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Date</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Time</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Duration</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Price</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Meeting Room</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Payment</TableHead>
                <TableHead className="text-xs px-3 py-3.5 whitespace-nowrap">Status</TableHead>
                <TableHead className="text-xs px-3 py-3.5 text-center whitespace-nowrap">Email</TableHead>
                <TableHead className="sticky right-0 z-30 bg-card text-xs px-3 py-3.5 text-right whitespace-nowrap border-l border-b border-border shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.3)] min-w-[270px] w-[270px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const isPending = isBookingPending(b);
                const isConfirmed = isBookingConfirmed(b);
                const isRejected = isBookingRejected(b);

                return (
                  <TableRow key={b.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground px-3 py-3 whitespace-nowrap">
                      {b.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm px-3 py-3 whitespace-nowrap font-medium">
                      <div>
                        <p className="font-medium text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground px-3 py-3 whitespace-nowrap">
                      {getConsultantName(b)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground px-3 py-3 whitespace-nowrap">
                      {b.date ? (!isNaN(new Date(b.date).getTime()) ? new Date(b.date).toLocaleDateString() : b.date) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground px-3 py-3 whitespace-nowrap">
                      {b.time || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground px-3 py-3 whitespace-nowrap">
                      {b.session_duration ? `${b.session_duration} min` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-primary px-3 py-3 whitespace-nowrap">
                      {b.session_price ? formatPrice(b.session_price) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs px-3 py-3 whitespace-nowrap">
                      {b.meeting_room_id ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-primary">
                            <Video className="h-3 w-3 shrink-0" />
                            <span className="font-mono text-xs">{b.meeting_room_id.slice(0, 15)}...</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => copyMeetingLink(b.meeting_room_id)}
                            title="Copy meeting link"
                          >
                            {copiedId === b.meeting_room_id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => window.open(`/meeting/${b.meeting_room_id}`, '_blank')}
                            title="Open meeting room"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium px-3 py-3 whitespace-nowrap">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-green-500">
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Paid</span>
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Payment Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-yellow-600">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>{b.payment_status === 'paid' ? 'Paid' : 'Pending'}</span>
                            </span>
                          )}

                          {/* Show Needs Verification badge ONLY when booking is strictly pending */}
                          {isPending && (
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 whitespace-nowrap">
                              {b.upi_payment ? "Needs Verification" : "Payment Pending"}
                            </Badge>
                          )}
                        </div>

                        {/* Transaction Reference when available */}
                        {b.upi_payment?.transaction_id && (
                          <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]" title={`UPI Transaction: ${b.upi_payment.transaction_id}`}>
                            Ref: {b.upi_payment.transaction_id}
                          </div>
                        )}

                        {/* Quick Payment Verification Button - ONLY on strictly pending bookings */}
                        {isPending && (
                          <Button 
                            id={`verify-payment-btn-${b.id}`}
                            variant="default"
                            size="sm" 
                            className="text-xs bg-amber-600 hover:bg-amber-700 text-white w-full whitespace-nowrap h-7"
                            onClick={() => openPaymentDialog(b)}
                            title="Review payment details & verify"
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs font-semibold">Verify</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 whitespace-nowrap">
                      <Badge variant="outline" className={`text-xs font-semibold ${statusColor(b)}`}>
                        {isRejected ? "Rejected" : isConfirmed ? "Confirmed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center px-3 py-3 whitespace-nowrap">
                      {isConfirmed && b.meeting_room_id && (
                        <div className="flex flex-col items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                            onClick={() => sendBookingEmail(b.id)}
                            disabled={sendingEmailId === b.id}
                            title="Resend confirmation emails"
                          >
                            {sendingEmailId === b.id ? (
                              <span className="w-3 h-3 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                          {b.email_sent && (
                            <CheckCircle className="h-3 w-3 text-green-500" title="Email dispatched" />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 z-20 bg-card group-hover:bg-[color-mix(in_srgb,hsl(var(--muted))_50%,hsl(var(--card)))] transition-colors text-right px-3 py-3 whitespace-nowrap border-l border-b border-border group-last:border-b-0 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.3)] min-w-[270px] w-[270px]">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* Pending actions */}
                        {isPending && (
                          <>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="text-xs bg-green-600 hover:bg-green-700 text-white h-7 px-2.5"
                              onClick={() => approveBooking(b)}
                              disabled={approvingId === b.id}
                              title="Confirm booking and generate meeting room"
                            >
                              {approvingId === b.id ? (
                                <span className="text-xs">Confirming...</span>
                              ) : (
                                <>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  <span>Confirm</span>
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 h-7 px-2"
                              onClick={() => openRejectDialog(b)}
                              title="Reject booking"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              <span>Reject</span>
                            </Button>
                          </>
                        )}

                        {/* Confirmed actions: option to cancel / reject if needed */}
                        {isConfirmed && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                            onClick={() => openRejectDialog(b)}
                            title="Reject or cancel this booking"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            <span>Reject</span>
                          </Button>
                        )}

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-primary hover:text-primary/80 h-7 px-2"
                          onClick={() => openEdit(b)}
                          title="Edit details"
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-destructive hover:text-destructive/80 h-7 px-2"
                          onClick={() => openDelete(b)}
                          title="Delete booking record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    <p className="text-sm font-medium">No bookings found in this view.</p>
                    <p className="text-xs mt-1 text-muted-foreground/80">
                      {statusFilter !== "all" ? `Switch to another tab or select "All Bookings" to see other records.` : "No bookings match your current search criteria."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Update Booking Status</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Update the booking and payment status for {selectedBooking?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Booking Status</Label>
              <Select 
                value={form.status} 
                onValueChange={(value: any) => setForm({ ...form, status: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select 
                value={form.payment_status} 
                onValueChange={(value: any) => setForm({ ...form, payment_status: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Meeting Room ID</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={form.meeting_room_id} 
                  onChange={(e) => setForm({ ...form, meeting_room_id: e.target.value })}
                  placeholder="foundarly-xxxxx"
                  className="bg-background border-border font-mono text-sm"
                />
                {!form.meeting_room_id && selectedBooking && (
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline"
                    onClick={() => setForm({ ...form, meeting_room_id: `foundarly-${selectedBooking.id}` })}
                  >
                    Auto
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Required for confirmed bookings</p>
            </div>

            {/* Reschedule Section */}
            <div className="pt-4 border-t border-border space-y-4">
              <Label className="text-sm font-semibold">Reschedule Meeting</Label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">New Date</Label>
                  <Input 
                    type="date"
                    value={form.date} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="bg-background border-border text-sm"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">New Time</Label>
                  <Input 
                    type="time"
                    value={form.time} 
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="bg-background border-border text-sm"
                  />
                </div>
              </div>
            </div>

            {selectedBooking && (
              <div className="bg-secondary/30 p-3 rounded-lg space-y-1 text-sm">
                <p><span className="text-muted-foreground">Attendee:</span> {selectedBooking.name}</p>
                <p><span className="text-muted-foreground">Email:</span> {selectedBooking.email}</p>
                <p><span className="text-muted-foreground">Original Date:</span> {new Date(selectedBooking.date).toLocaleDateString()}</p>
                <p><span className="text-muted-foreground">Original Time:</span> {selectedBooking.time}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="glow-gold-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dedicated Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5 text-destructive" />
              Reject Consultation Booking
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Provide a reason for rejection. An email notification will be dispatched to the attendee.
            </DialogDescription>
          </DialogHeader>
          {bookingToReject && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
                <p><span className="text-muted-foreground">Attendee:</span> <strong className="text-foreground">{bookingToReject.name}</strong></p>
                <p><span className="text-muted-foreground">Email:</span> {bookingToReject.email}</p>
                <p><span className="text-muted-foreground">Consultant:</span> {getConsultantName(bookingToReject)}</p>
                <p><span className="text-muted-foreground">Date:</span> {new Date(bookingToReject.date).toLocaleDateString()} at {bookingToReject.time}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectReason">Rejection Reason</Label>
                <Textarea 
                  id="rejectReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this booking is being rejected..."
                  className="bg-background border-border min-h-[90px]"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "Payment verification failed",
                    "Consultant unavailable at requested time",
                    "Duplicate booking requested",
                    "Cancelled by client request",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectionReason(preset)}
                      className="text-[11px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isRejecting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmReject} 
              disabled={isRejecting || !rejectionReason.trim()}
            >
              {isRejecting ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the booking for {selectedBooking?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Verification Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-lg md:text-xl">
              <CreditCard className="h-5 w-5 text-primary" />
              Verify Payment
            </DialogTitle>
            <DialogDescription className="text-sm">
              Review transaction details, verify and confirm the booking, or reject the transaction.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-4">
              {/* Customer Details */}
              <div className="bg-secondary/30 rounded-lg p-3 md:p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Attendee Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium break-words">{selectedPayment.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="font-medium">{selectedPayment.customer_phone}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium break-all">{selectedPayment.customer_email}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 md:p-4 space-y-3">
                <h3 className="font-semibold text-sm text-primary">Payment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs">Transaction ID</p>
                    <p className="font-mono font-bold break-all">{selectedPayment.transaction_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Amount</p>
                    <p className="font-bold text-primary">{formatPrice(selectedPayment.payment_amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Payment Method</p>
                    <p className="font-medium">{selectedPayment.payment_method || 'UPI'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs">Submitted On</p>
                    <p className="font-medium text-xs">{new Date(selectedPayment.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-secondary/30 rounded-lg p-3 md:p-4 space-y-3">
                <h3 className="font-semibold text-sm">Booking Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p className="font-medium">{new Date(selectedPayment.booking_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Time</p>
                    <p className="font-medium">{selectedPayment.booking_time}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Duration</p>
                    <p className="font-medium">{selectedPayment.session_duration} minutes</p>
                  </div>
                </div>
                {selectedPayment.booking_message && (
                  <div>
                    <p className="text-muted-foreground text-xs">Message</p>
                    <p className="text-sm mt-1 break-words">{selectedPayment.booking_message}</p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <Label htmlFor="adminNotes" className="text-sm font-medium mb-2 block">
                  Admin Notes
                </Label>
                <Textarea
                  id="adminNotes"
                  placeholder="Optional notes about this payment verification..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="bg-background border-border min-h-[80px] text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setPaymentDialogOpen(false);
                setSelectedPayment(null);
                setAdminNotes("");
              }}
              disabled={verifyingPayment}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectPayment}
              disabled={verifyingPayment}
              className="w-full sm:w-auto"
            >
              Reject Payment
            </Button>
            <Button
              className="glow-gold-sm w-full sm:w-auto"
              onClick={handleVerifyPayment}
              disabled={verifyingPayment}
            >
              {verifyingPayment ? "Processing..." : "Verify & Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMTP Connection Diagnostic Dialog */}
      <Dialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
        <DialogContent className="sm:max-w-[580px] bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Mail className="h-5 w-5 text-primary" />
              <span>SMTP Connection & Email Diagnostic</span>
            </DialogTitle>
            <DialogDescription>
              Test live SMTP authentication and delivery across Titan Email and GoDaddy fallback targets.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {testingSmtp ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">Testing SMTP server authentication & connection...</p>
                <p className="text-xs text-muted-foreground">Probing Titan Port 587 (STARTTLS), Port 465 (SSL), and GoDaddy fallback</p>
              </div>
            ) : smtpResult ? (
              <div className="space-y-3">
                <div className={`p-3.5 rounded-lg border ${
                  smtpResult.success 
                    ? "bg-green-500/10 border-green-500/30 text-green-500" 
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {smtpResult.success ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                        <span>SMTP Connection & Authentication Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        <span>SMTP Authentication Error</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs mt-1.5 opacity-90 break-words font-mono text-[11px] whitespace-pre-line">
                    {smtpResult.message || smtpResult.error}
                  </p>
                </div>

                {/* Configuration details */}
                <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1.5 border border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primary Host:</span>
                    <span className="font-mono font-medium">{smtpResult.config?.smtpHost || 'smtp.titan.email'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Port & Security:</span>
                    <span className="font-mono font-medium">
                      Port {smtpResult.portVerified || smtpResult.config?.smtpPort || 587} ({smtpResult.config?.encryption || 'STARTTLS'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SMTP Username:</span>
                    <span className="font-mono font-medium">{smtpResult.config?.smtpUser || 'hello@foundarlybusinessworld.in'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From Address:</span>
                    <span className="font-mono font-medium">{smtpResult.config?.fromEmail || 'hello@foundarlybusinessworld.in'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Password Configured:</span>
                    <span className="font-medium">
                      {smtpResult.config?.hasSmtpPass ? 'Yes (configured in env)' : 'No (missing in env)'}
                    </span>
                  </div>
                </div>

                {/* Candidate attempts breakdown if any */}
                {Array.isArray(smtpResult.attempts) && smtpResult.attempts.length > 0 && (
                  <div className="bg-muted/20 rounded-lg p-2.5 text-[11px] border border-border space-y-1">
                    <span className="font-semibold text-muted-foreground block">Tested Candidates:</span>
                    {smtpResult.attempts.map((att: any, idx: number) => (
                      <div key={idx} className="flex flex-col text-muted-foreground">
                        <span className="font-medium text-foreground">• {att.name}:</span>
                        <span className="text-xs text-destructive/90 pl-3">{att.error}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!smtpResult.success && (
                  <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg space-y-1.5">
                    <p className="font-semibold text-amber-600">How to resolve 535 Authentication Failed:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      <li>Ensure <code>SMTP_PASS</code> in Vercel environment variables is the exact mailbox password for <code>hello@foundarlybusinessworld.in</code>.</li>
                      <li>If 2FA is active on the Titan or GoDaddy mailbox, create an <strong>Application Password</strong> in webmail settings instead of using the primary password.</li>
                      <li>Check that there are no accidental leading/trailing spaces or quotes in <code>SMTP_PASS</code>.</li>
                    </ul>
                  </div>
                )}

                {/* Real Email Delivery Test Section */}
                <div className="mt-4 pt-4 border-t border-border space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-primary" />
                    Test Live Booking Confirmation Email Delivery
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Send a real booking confirmation email to verify end-to-end inbox delivery.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter recipient email (e.g. your email)"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button
                      size="sm"
                      onClick={handleSendTestEmail}
                      disabled={sendingTestEmail || !testEmailRecipient}
                      className="shrink-0 h-9"
                    >
                      {sendingTestEmail ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1" />
                      )}
                      Send Test Email
                    </Button>
                  </div>

                  {testEmailResult && (
                    <div className={`p-2.5 rounded text-xs border ${
                      testEmailResult.success
                        ? "bg-green-500/10 border-green-500/30 text-green-600"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      <div className="font-medium flex items-center gap-1.5">
                        {testEmailResult.success ? (
                          <>
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            <span>{testEmailResult.message}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{testEmailResult.error}</span>
                          </>
                        )}
                      </div>
                      {testEmailResult.messageId && (
                        <p className="text-[11px] font-mono mt-1 opacity-80">
                          Message ID: {testEmailResult.messageId}
                        </p>
                      )}
                      {testEmailResult.diagnostic && (
                        <p className="text-[10px] mt-1 opacity-90 whitespace-pre-line font-mono">
                          {testEmailResult.diagnostic}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSmtpDialogOpen(false)}>
              Close
            </Button>
            <Button size="sm" onClick={runSmtpTest} disabled={testingSmtp}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${testingSmtp ? 'animate-spin' : ''}`} />
              Re-test Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

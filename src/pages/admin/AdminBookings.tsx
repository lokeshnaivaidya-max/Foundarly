import { useState, useEffect } from "react";
import { Search, Download, Video, Trash2, Copy, Check, ExternalLink, Mail, CheckCircle, X, CreditCard, FileText } from "lucide-react";
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

const statusColor = (s: string) => {
  if (s === "confirmed") return "bg-primary/15 text-primary border-primary/30";
  if (s === "completed") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s === "pending") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
};

const paymentColor = (s: string) => {
  if (s === "paid") return "text-green-400";
  if (s === "pending") return "text-yellow-400";
  return "text-destructive";
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

  // Form state
  const [form, setForm] = useState({
    status: "pending" as "pending" | "confirmed" | "completed" | "cancelled",
    payment_status: "pending" as "pending" | "paid" | "refunded",
    meeting_room_id: "",
    date: "",
    time: ""
  });

  useEffect(() => {
    console.log("[AdminBookings] useEffect fired");
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
    console.log("[AdminBookings] loadBookings called");
    try {
      console.log('[AdminBookings] Calling bookingsService.getAll()...');
      const data = await bookingsService.getAll();
      console.log('[AdminBookings] Loaded bookings from service, count:', data.length, 'Data:', data);
      
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

      console.log('[AdminBookings] Final bookings with payments count:', bookingsWithPayments.length);
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
        // Mark email as sent in local state
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
    try {
      const updates: any = {
        status: "confirmed",
        payment_status: "paid",
        meeting_room_id: `foundarly-${booking.id}`,
      };

      await bookingsService.update(booking.id, updates);
      
      // If there's a UPI payment, verify it
      if (booking.upi_payment) {
        await upiPaymentService.verifyPayment(booking.upi_payment.id, "Payment verified by admin");
      }
      
      toast.success("Booking approved and meeting room created!");

      // Trigger automatic confirmation email in background
      emailService.sendBookingConfirmation(booking.id).then((res) => {
        if (res.success) {
          toast.success("Confirmation email sent to attendee!");
          setBookings(prev => prev.map(b => 
            b.id === booking.id ? { ...b, email_sent: true } : b
          ));
        } else {
          console.warn("Automatic email notification not sent:", res.error);
        }
      }).catch((err) => {
        console.warn("Error sending automatic confirmation email on approval:", err);
      });

      loadBookings();
    } catch (error) {
      console.error('Error approving booking:', error);
      toast.error("Failed to approve booking");
    } finally {
      setApprovingId(null);
    }
  };

  const openPaymentDialog = (booking: any) => {
    if (!booking.upi_payment) {
      toast.error("No payment details found");
      return;
    }
    setSelectedPayment(booking.upi_payment);
    setAdminNotes("");
    setPaymentDialogOpen(true);
  };

  const handleVerifyPayment = async () => {
    if (!selectedPayment || !user) return;
    
    setVerifyingPayment(true);
    try {
      // Verify the payment
      await upiPaymentService.verifyPayment(selectedPayment.id, user.id, adminNotes || "Payment verified");
      
      // Get the booking and update it with meeting room
      const booking = bookings.find(b => b.id === selectedPayment.booking_id);
      if (booking) {
        await bookingsService.update(booking.id, {
          status: "confirmed",
          payment_status: "paid",
          meeting_room_id: `foundarly-${booking.id}`,
        });

        // Trigger automatic confirmation email in background
        emailService.sendBookingConfirmation(booking.id).then((res) => {
          if (res.success) {
            toast.success("Confirmation email sent to attendee!");
            setBookings(prev => prev.map(b => 
              b.id === booking.id ? { ...b, email_sent: true } : b
            ));
          } else {
            console.warn("Automatic email notification not sent:", res.error);
          }
        }).catch((err) => {
          console.warn("Error sending automatic confirmation email on payment verification:", err);
        });
      }
      
      toast.success("Payment verified! Booking confirmed and meeting room created.");
      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      setAdminNotes("");
      loadBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to verify payment");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !user) return;
    
    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    
    setVerifyingPayment(true);
    try {
      await upiPaymentService.rejectPayment(selectedPayment.id, user.id, adminNotes);
      toast.success("Payment rejected. Booking cancelled.");
      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      setAdminNotes("");
      loadBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject payment");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const exportToCSV = () => {
    try {
      // Prepare CSV headers
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

      // Prepare CSV rows
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

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape commas and quotes in cell content
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      // Create blob and download
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

  const filtered = bookings.filter((b) => {
    const nameStr = (b.name || "").toLowerCase();
    const emailStr = (b.email || "").toLowerCase();
    const consultantNameStr = (b.consultants?.name || "").toLowerCase();
    const searchStr = search.toLowerCase();

    const matchesSearch = nameStr.includes(searchStr) || emailStr.includes(searchStr) || consultantNameStr.includes(searchStr);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    
    // Filter for reschedule requests (missed meetings with only 1 participant or no participants)
    const needsReschedule = b.status === "missed" && (b.participants_count || 0) < 2;
    const matchesReschedule = !showRescheduleOnly || needsReschedule;
    
    return matchesSearch && matchesStatus && matchesReschedule;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    rescheduleRequests: bookings.filter(b => b.status === "missed" && (b.participants_count || 0) < 2).length,
  };

  console.log('[AdminBookings] Rendering with bookings.length:', bookings.length, 'filtered.length:', filtered.length);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Manage Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">{stats.total} total bookings</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-card border border-yellow-500/20 rounded-lg p-4">
            <p className="text-xs text-yellow-600 uppercase tracking-wider mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-card border border-primary/20 rounded-lg p-4">
            <p className="text-xs text-primary uppercase tracking-wider mb-1">Confirmed</p>
            <p className="text-2xl font-bold text-primary">{stats.confirmed}</p>
          </div>
          <div className="bg-card border border-green-500/20 rounded-lg p-4">
            <p className="text-xs text-green-600 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-card border border-destructive/20 rounded-lg p-4">
            <p className="text-xs text-destructive uppercase tracking-wider mb-1">Cancelled</p>
            <p className="text-2xl font-bold text-destructive">{stats.cancelled}</p>
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

      {/* Filters */}
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
            placeholder="Search by name, email, or consultant..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 bg-card border-border" 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">ID</TableHead>
              <TableHead className="text-xs">Client</TableHead>
              <TableHead className="text-xs">Consultant</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Duration</TableHead>
              <TableHead className="text-xs">Price</TableHead>
              <TableHead className="text-xs">Meeting Room</TableHead>
              <TableHead className="text-xs">Payment</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-center">Email</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{b.id.slice(0, 8)}</TableCell>
                <TableCell className="text-sm">{b.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.consultants?.name || 'N/A'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(b.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.time}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.session_duration ? `${b.session_duration} min` : 'N/A'}</TableCell>
                <TableCell className="text-sm font-medium text-primary">{b.session_price ? formatPrice(b.session_price) : 'N/A'}</TableCell>
                <TableCell className="text-xs">
                  {b.meeting_room_id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-primary">
                        <Video className="h-3 w-3" />
                        <span className="font-mono text-xs">{b.meeting_room_id.slice(0, 15)}...</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
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
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(`/meeting/${b.meeting_room_id}`, '_blank')}
                        title="Open meeting"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </TableCell>
                <TableCell className={`text-xs font-medium ${paymentColor(b.payment_status)}`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span>{b.payment_status.charAt(0).toUpperCase() + b.payment_status.slice(1)}</span>
                      {b.payment_status === "pending" && b.upi_payment && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          Needs Verification
                        </Badge>
                      )}
                    </div>
                    {/* Verify Payment Button under Payment column */}
                    {b.payment_status === "pending" && b.upi_payment && (
                      <Button 
                        variant="default"
                        size="sm" 
                        className="text-xs bg-amber-600 hover:bg-amber-700 text-white w-full"
                        onClick={() => openPaymentDialog(b)}
                        title="View and verify payment"
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs font-semibold">Verify Payment</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${statusColor(b.status)}`}>
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {b.status === "confirmed" && b.meeting_room_id && (
                    <div className="flex flex-col items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                        onClick={() => sendBookingEmail(b.id)}
                        disabled={sendingEmailId === b.id}
                        title="Send confirmation emails"
                      >
                        {sendingEmailId === b.id ? (
                          <span className="w-3 h-3 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Checkmark if email was sent */}
                      {b.email_sent && (
                        <CheckCircle className="h-3 w-3 text-green-500" title="Email sent" />
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {b.status === "pending" && !b.upi_payment && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => approveBooking(b)}
                        disabled={approvingId === b.id}
                        title="Approve booking and create meeting room"
                      >
                        {approvingId === b.id ? (
                          <span className="text-xs">Approving...</span>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Approve</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-primary hover:text-primary/80"
                      onClick={() => openEdit(b)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-destructive hover:text-destructive/80"
                      onClick={() => openDelete(b)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
                <p><span className="text-muted-foreground">Client:</span> {selectedBooking.name}</p>
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
              Review the payment details and verify or reject the transaction
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-4">
              {/* Customer Details */}
              <div className="bg-secondary/30 rounded-lg p-3 md:p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Customer Information
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
                  Admin Notes {selectedPayment.status === 'pending' && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="adminNotes"
                  placeholder="Add notes about this payment verification..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="bg-background border-border min-h-[80px] text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPayment.status === 'pending' ? 'Required for rejection' : 'Optional notes for record keeping'}
                </p>
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
              {verifyingPayment ? "Processing..." : "Reject Payment"}
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
    </div>
  );
}

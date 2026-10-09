import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { consultantDashboardService, DashboardStats, ConsultantBooking, PayoutRequest } from "@/services/consultantDashboard";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, Calendar, Star, TrendingUp, Clock, Video, 
  CreditCard, CheckCircle2, XCircle, RefreshCw, Copy, Check, Shield, RotateCcw, AlertCircle, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/PageLoader";
import { motion } from "framer-motion";
import { useCurrency } from "@/contexts/CurrencyContext";
import { calculateRejoinEligibility, FollowUpRequest } from "@/utils/meetingRejoin";
import { followUpService } from "@/services/followUpService";

export default function ConsultantDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<ConsultantBooking[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ConsultantBooking | null>(null);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  // Follow-up workflow state
  const [followUps, setFollowUps] = useState<FollowUpRequest[]>([]);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpRequest | null>(null);
  const [alternativeDialogOpen, setAlternativeDialogOpen] = useState(false);
  const [alternativeDate, setAlternativeDate] = useState("");
  const [alternativeTime, setAlternativeTime] = useState("");
  const [consultantNote, setConsultantNote] = useState("");
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Payout form
  const [payoutAmount, setPayoutAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDetails, setPaymentDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    ifscCode: "",
    upiId: "",
  });

  // Reschedule form
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if user has consultant role
    checkConsultantAccess();
  }, [user]);

  const checkConsultantAccess = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First, check if user has consultant role in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // If no profile exists, create one with client role initially
      if (profileError && profileError.code === 'PGRST116') {
        const { error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            role: "client",
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || "User"
          });
        
        if (createError) {
          console.error("Error creating profile:", createError);
        }
      }

      // Check if user is linked to an active consultant
      const { data: consultant, error: consultantError } = await supabase
        .from("consultants")
        .select("id, is_active, name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (consultantError || !consultant) {
        console.log("User is not linked to an active consultant");
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // If user is linked to consultant but doesn't have consultant role, update it
      if (!profile || profile.role !== "consultant") {
        console.log("Updating user role to consultant");
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ role: "consultant" })
          .eq("id", user.id);

        if (updateError) {
          console.error("Error updating role:", updateError);
          // Continue anyway - they have consultant record
        }
      }

      // User has proper access, load dashboard data
      loadDashboardData();
    } catch (error) {
      console.error("Error checking consultant access:", error);
      setAccessDenied(true);
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [statsData, bookingsData, payoutsData, followUpsRes] = await Promise.all([
        consultantDashboardService.getDashboardStats(user.id),
        consultantDashboardService.getConsultantBookings(user.id),
        consultantDashboardService.getPayoutRequests(user.id),
        followUpService.listConsultantFollowUps(),
      ]);

      setStats(statsData);
      setBookings(bookingsData);
      setPayoutRequests(payoutsData);
      if (followUpsRes.success && followUpsRes.followUps) {
        setFollowUps(followUpsRes.followUps);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptFollowUp = async (req: FollowUpRequest) => {
    setSubmittingAction(true);
    try {
      const res = await followUpService.consultantRespond(req.id, {
        action: 'accept',
      });
      if (res.success && res.followUp) {
        toast.success("Follow-up session confirmed! Client has been notified by email.");
        setFollowUps(prev => prev.map(f => f.id === req.id ? res.followUp! : f));
      } else {
        toast.error(res.error || "Failed to accept follow-up request.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error accepting follow-up request.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const openAlternativeDialog = (req: FollowUpRequest) => {
    setSelectedFollowUp(req);
    setAlternativeDate("");
    setAlternativeTime("");
    setConsultantNote("");
    setAlternativeDialogOpen(true);
  };

  const handleProposeAlternative = async () => {
    if (!selectedFollowUp) return;
    if (!alternativeDate || !alternativeTime) {
      toast.error("Please provide both an alternative date and time.");
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await followUpService.consultantRespond(selectedFollowUp.id, {
        action: 'propose_alternative',
        alternativeDate,
        alternativeTime,
        consultantNote,
      });
      if (res.success && res.followUp) {
        toast.success("Alternative time proposed to client! They have been notified by email.");
        setFollowUps(prev => prev.map(f => f.id === selectedFollowUp.id ? res.followUp! : f));
        setAlternativeDialogOpen(false);
      } else {
        toast.error(res.error || "Failed to propose alternative time.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error proposing alternative time.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const openDeclineDialog = (req: FollowUpRequest) => {
    setSelectedFollowUp(req);
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const handleDeclineFollowUp = async () => {
    if (!selectedFollowUp) return;
    setSubmittingAction(true);
    try {
      const res = await followUpService.consultantRespond(selectedFollowUp.id, {
        action: 'decline',
        reason: declineReason,
      });
      if (res.success && res.followUp) {
        toast.success("Follow-up request declined. Client has been notified.");
        setFollowUps(prev => prev.map(f => f.id === selectedFollowUp.id ? res.followUp! : f));
        setDeclineDialogOpen(false);
      } else {
        toast.error(res.error || "Failed to decline follow-up.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error declining follow-up.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!stats || parseFloat(payoutAmount) > stats.pending_earnings) {
      toast.error("Amount exceeds pending earnings");
      return;
    }

    const details = paymentMethod === "upi" 
      ? { upiId: paymentDetails.upiId }
      : {
          accountName: paymentDetails.accountName,
          accountNumber: paymentDetails.accountNumber,
          bankName: paymentDetails.bankName,
          ifscCode: paymentDetails.ifscCode,
        };

    const result = await consultantDashboardService.createPayoutRequest(
      user!.id,
      parseFloat(payoutAmount),
      paymentMethod,
      details
    );

    if (result.success) {
      toast.success("Payout request submitted successfully");
      setPayoutDialogOpen(false);
      loadDashboardData();
      // Reset form
      setPayoutAmount("");
      setPaymentDetails({
        accountName: "",
        accountNumber: "",
        bankName: "",
        ifscCode: "",
        upiId: "",
      });
    } else {
      toast.error(result.error || "Failed to submit payout request");
    }
  };

  const handleRescheduleRequest = async () => {
    if (!selectedBooking || !rescheduleReason || !newDate || !newTime) {
      toast.error("Please fill all fields");
      return;
    }

    const result = await consultantDashboardService.requestReschedule(
      selectedBooking.id,
      user!.id,
      rescheduleReason,
      newDate,
      newTime
    );

    if (result.success) {
      toast.success("Reschedule request sent to user");
      setRescheduleDialogOpen(false);
      setSelectedBooking(null);
      setRescheduleReason("");
      setNewDate("");
      setNewTime("");
      loadDashboardData();
    } else {
      toast.error(result.error || "Failed to request reschedule");
    }
  };

  const copyMeetingLink = (meetingRoomId: string) => {
    const link = `${window.location.origin}/meeting/${meetingRoomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(meetingRoomId);
      toast.success("Meeting link copied!");
      setTimeout(() => setLinkCopied(null), 2000);
    });
  };

  if (loading) return <PageLoader text="Loading your dashboard..." />;

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-6"
        >
          <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <Shield className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">
              You need to be an approved consultant with the "consultant" role to access this dashboard.
            </p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Have "consultant" role in your profile</li>
                <li>Be linked to an active consultant record</li>
                <li>Account must be approved by admin</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Go Home
            </Button>
            <Button onClick={() => navigate("/apply-consultant")}>
              Apply as Consultant
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const upcomingBookings = bookings.filter(b => b.status === "confirmed");
  const completedBookings = bookings.filter(b => b.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Consultant Dashboard - Foundarly"
        description="Private dashboard for verified Foundarly consultants to manage bookings, earnings, and follow-ups."
        noindex={true}
      />
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold">Consultant Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Welcome back, {profile?.full_name || "Consultant"}
              </p>
            </div>
            <Button onClick={() => navigate("/")} variant="outline">
              Back to Home
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <h3 className="text-2xl font-bold">{formatPrice(stats.total_earnings)}</h3>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">{formatPrice(stats.pending_earnings)}</h3>
              <p className="text-sm text-muted-foreground">Pending Payout</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">{stats.upcoming_sessions}</h3>
              <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">
                {stats.average_rating ? stats.average_rating.toFixed(1) : "N/A"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Average Rating ({stats.total_reviews} reviews)
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Payout Request Button */}
        {stats.pending_earnings > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
            <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-1">Ready to withdraw?</h3>
                  <p className="text-sm text-muted-foreground">
                    You have {formatPrice(stats.pending_earnings)} available for payout
                  </p>
                </div>
                <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <CreditCard className="h-4 w-4" />
                      Request Payout
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Request Payout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value)}
                          max={stats.pending_earnings}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Available: {formatPrice(stats.pending_earnings)}
                        </p>
                      </div>

                      <div>
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {paymentMethod === "bank_transfer" ? (
                        <>
                          <div>
                            <Label>Account Name</Label>
                            <Input
                              value={paymentDetails.accountName}
                              onChange={(e) => setPaymentDetails({...paymentDetails, accountName: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label>Account Number</Label>
                            <Input
                              value={paymentDetails.accountNumber}
                              onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label>Bank Name</Label>
                            <Input
                              value={paymentDetails.bankName}
                              onChange={(e) => setPaymentDetails({...paymentDetails, bankName: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label>IFSC Code</Label>
                            <Input
                              value={paymentDetails.ifscCode}
                              onChange={(e) => setPaymentDetails({...paymentDetails, ifscCode: e.target.value})}
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <Label>UPI ID</Label>
                          <Input
                            placeholder="yourname@upi"
                            value={paymentDetails.upiId}
                            onChange={(e) => setPaymentDetails({...paymentDetails, upiId: e.target.value})}
                          />
                        </div>
                      )}

                      <Button onClick={handlePayoutRequest} className="w-full">
                        Submit Request
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="follow-ups" className="relative gap-1.5">
              <span>Follow-ups</span>
              {followUps.filter(f => f.status === 'pending_consultant').length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-black">
                  {followUps.filter(f => f.status === 'pending_consultant').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">My Sessions</h2>
            </div>

            {bookings.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">No bookings yet</h3>
                <p className="text-muted-foreground">
                  Your upcoming sessions will appear here
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant={
                            booking.status === "completed" ? "default" :
                            booking.status === "confirmed" ? "outline" :
                            "secondary"
                          }>
                            {booking.status}
                          </Badge>
                          {booking.reschedule_status !== "none" && (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Reschedule {booking.reschedule_status}
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-bold text-lg mb-2">{booking.name}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {new Date(booking.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {booking.time} ({booking.session_duration} min)
                          </div>
                        </div>

                        {booking.reschedule_reason && (
                          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-sm">
                              <span className="font-medium">Reschedule Reason:</span> {booking.reschedule_reason}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {booking.meeting_room_id && (() => {
                          const eligibility = calculateRejoinEligibility(booking, new Date());
                          if (eligibility.sessionStatus === "rejoin_eligible") {
                            return (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => navigate(`/meeting/${booking.meeting_room_id}`)}
                                  className="gap-2 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-medium"
                                  title={`Follow-up rejoin available until ${eligibility.rejoinDeadline.toLocaleDateString()}`}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                                  Rejoin Meeting ({eligibility.rejoinDaysRemaining}d left)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyMeetingLink(booking.meeting_room_id)}
                                  className="gap-2 text-xs"
                                >
                                  {linkCopied === booking.meeting_room_id ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  Copy Link
                                </Button>
                              </>
                            );
                          }
                          return null;
                        })()}

                        {booking.status === "confirmed" && (() => {
                          const eligibility = calculateRejoinEligibility(booking, new Date());
                          if (eligibility.sessionStatus === "rejoin_eligible") return null;
                          return (
                            <>
                              <Button
                                size="sm"
                                onClick={() => navigate(`/meeting/${booking.meeting_room_id}`)}
                                className="gap-2"
                              >
                                <Video className="h-4 w-4" />
                                Join Meeting
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyMeetingLink(booking.meeting_room_id)}
                                className="gap-2"
                              >
                                {linkCopied === booking.meeting_room_id ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                Copy Link
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setRescheduleDialogOpen(true);
                                }}
                                className="gap-2"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Reschedule
                              </Button>
                            </>
                          );
                        })()}

                        {booking.status === "completed" && booking.consultant_earnings > 0 && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Earned</p>
                            <p className="font-bold text-green-500">
                              {formatPrice(booking.consultant_earnings)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Follow-ups Tab */}
          <TabsContent value="follow-ups" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Client Follow-up Requests</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  7-day post-meeting follow-ups. Confirm, propose an alternative time, or decline directly — no admin approval needed.
                </p>
              </div>
            </div>

            {followUps.length === 0 ? (
              <Card className="p-12 text-center">
                <RotateCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">No follow-up requests</h3>
                <p className="text-muted-foreground">
                  Requests from clients within their 7-day follow-up window will appear here.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {followUps.map((fu) => {
                  const deadlineDate = new Date(fu.rejoin_deadline);
                  const isPending = fu.status === "pending_consultant";
                  const isAlternative = fu.status === "alternative_proposed";
                  const isConfirmed = fu.status === "confirmed";
                  const isDeclined = fu.status === "declined";

                  return (
                    <Card key={fu.id} className="p-6 border-border/80">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={
                                isPending
                                  ? "bg-amber-500/15 text-amber-500 border-amber-500/30 font-semibold"
                                  : isAlternative
                                  ? "bg-blue-500/15 text-blue-500 border-blue-500/30 font-semibold"
                                  : isConfirmed
                                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-semibold"
                                  : "bg-secondary text-muted-foreground"
                              }
                            >
                              {isPending && <Clock className="h-3 w-3 mr-1" />}
                              {isConfirmed && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {isAlternative && <RefreshCw className="h-3 w-3 mr-1" />}
                              {isPending
                                ? "Pending Consultant Response"
                                : isAlternative
                                ? "Alternative Time Proposed"
                                : isConfirmed
                                ? "Confirmed Follow-up"
                                : isDeclined
                                ? "Declined"
                                : "Expired"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Booking Ref: <code className="text-foreground">{fu.booking_id.slice(0, 8)}</code>
                            </span>
                          </div>

                          <h3 className="font-bold text-lg text-foreground">{fu.client_name || "Client"}</h3>
                          <p className="text-xs text-muted-foreground">{fu.client_email}</p>

                          <div className="p-3 bg-secondary/50 rounded-lg text-xs space-y-1.5 border border-border/40">
                            <p>
                              <span className="text-muted-foreground font-medium">Requested Follow-up Time:</span>{" "}
                              <strong className="text-primary">{fu.preferred_date} at {fu.preferred_time}</strong>
                            </p>
                            {fu.alternative_date && (
                              <p>
                                <span className="text-muted-foreground font-medium">Proposed Alternative:</span>{" "}
                                <strong className="text-blue-400">{fu.alternative_date} at {fu.alternative_time}</strong>
                              </p>
                            )}
                            {fu.confirmed_date && (
                              <p>
                                <span className="text-muted-foreground font-medium">Confirmed Time:</span>{" "}
                                <strong className="text-emerald-500">{fu.confirmed_date} at {fu.confirmed_time}</strong>
                              </p>
                            )}
                            <p>
                              <span className="text-muted-foreground font-medium">Question / Clarification:</span>{" "}
                              <span className="italic text-foreground">"{fu.reason}"</span>
                            </p>
                            {fu.consultant_note && (
                              <p>
                                <span className="text-muted-foreground font-medium">Your Note to Client:</span>{" "}
                                <span>"{fu.consultant_note}"</span>
                              </p>
                            )}
                            {fu.declined_reason && (
                              <p className="text-destructive">
                                <span className="font-medium">Decline reason:</span> {fu.declined_reason}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                              7-day window expires: {deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0 md:min-w-[200px]">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                                onClick={() => handleAcceptFollowUp(fu)}
                                disabled={submittingAction}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Accept Proposed Time
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => openAlternativeDialog(fu)}
                                disabled={submittingAction}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Propose Alternative
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => openDeclineDialog(fu)}
                                disabled={submittingAction}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Decline Request
                              </Button>
                            </>
                          )}

                          {isAlternative && (
                            <div className="text-xs text-muted-foreground p-2 rounded bg-secondary/30 text-center">
                              Awaiting client response to your proposed alternative time
                            </div>
                          )}

                          {isConfirmed && (
                            <>
                              <Button
                                size="sm"
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                                onClick={() => navigate(`/meeting/${fu.meeting_room_id}`)}
                              >
                                <Video className="h-3.5 w-3.5" />
                                Enter Meeting Room
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyMeetingLink(fu.meeting_room_id)}
                                className="gap-2 text-xs"
                              >
                                {linkCopied === fu.meeting_room_id ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                Copy Room Link
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Payout Requests</h2>

            {payoutRequests.length === 0 ? (
              <Card className="p-12 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">No payout requests</h3>
                <p className="text-muted-foreground">
                  Your payout requests will appear here
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {payoutRequests.map((payout) => (
                  <Card key={payout.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-xl">{formatPrice(payout.amount)}</h3>
                          <Badge variant={
                            payout.status === "paid" ? "default" :
                            payout.status === "approved" ? "outline" :
                            payout.status === "rejected" ? "destructive" :
                            "secondary"
                          }>
                            {payout.status === "paid" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {payout.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                            {payout.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Method: {payout.payment_method.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested: {new Date(payout.requested_at).toLocaleDateString()}
                        </p>
                        {payout.admin_notes && (
                          <div className="mt-3 p-3 bg-secondary rounded-lg">
                            <p className="text-sm">
                              <span className="font-medium">Admin Note:</span> {payout.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Earnings Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
                <p className="text-2xl font-bold text-green-500">{formatPrice(stats.total_earnings)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">{formatPrice(stats.pending_earnings)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Paid Out</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(stats.paid_earnings)}</p>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-bold mb-4">Recent Earnings</h3>
              <div className="space-y-3">
                {completedBookings.slice(0, 10).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium">{booking.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(booking.date).toLocaleDateString()} at {booking.time}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-500">
                        +{formatPrice(booking.consultant_earnings)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {booking.payout_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Reschedule</Label>
              <Textarea
                placeholder="Please explain why you need to reschedule..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </div>
            <div>
              <Label>Proposed New Date</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Proposed New Time</Label>
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
            <Button onClick={handleRescheduleRequest} className="w-full">
              Send Reschedule Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

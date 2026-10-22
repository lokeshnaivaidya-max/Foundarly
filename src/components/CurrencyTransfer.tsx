import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  AlertCircle,
  Video,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Building2,
  User,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { upiPaymentService, UPIPayment } from "@/services/upiPayment";
import { bookingsService } from "@/services/bookings";
import { useNavigate } from "react-router-dom";

export type TransferStatus = "processing" | "completed" | "failed";

export interface CurrencyTransferProps {
  paymentId?: string;
  bookingId: string;
  amount: number;
  currency?: string;
  transactionId: string;
  customerName: string;
  customerEmail: string;
  consultantName: string;
  consultantTitle?: string;
  sessionDuration: number;
  bookingDate: string;
  bookingTime: string;
  meetingRoomId?: string | null;
  initialStatus?: "pending" | "verified" | "rejected";
  initialAdminNotes?: string | null;
  onStatusChanged?: (newStatus: "pending" | "verified" | "rejected") => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  timestamp?: string;
  state: "completed" | "active" | "waiting" | "failed";
}

export default function CurrencyTransfer({
  paymentId,
  bookingId,
  amount,
  currency = "INR",
  transactionId,
  customerName,
  customerEmail,
  consultantName,
  consultantTitle,
  sessionDuration,
  bookingDate,
  bookingTime,
  meetingRoomId,
  initialStatus = "pending",
  initialAdminNotes,
  onStatusChanged,
}: CurrencyTransferProps) {
  const navigate = useNavigate();

  const [status, setStatus] = useState<"pending" | "verified" | "rejected">(initialStatus);
  const [adminNotes, setAdminNotes] = useState<string | null>(initialAdminNotes || null);
  const [currentTxnId, setCurrentTxnId] = useState<string>(transactionId);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | undefined>(paymentId);
  const [copied, setCopied] = useState(false);
  const [effectiveMeetingRoomId, setEffectiveMeetingRoomId] = useState<string | null>(meetingRoomId || null);

  // Retry / update transaction ID dialog
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [newTxnInput, setNewTxnInput] = useState("");
  const [retrying, setRetrying] = useState(false);

  // Auto-listen via Supabase realtime channel and polling
  useEffect(() => {
    let isMounted = true;

    // 1. Check current status from DB
    const checkDbStatus = async () => {
      try {
        const payment = await upiPaymentService.getPaymentByBookingId(bookingId);
        if (payment && isMounted) {
          setCurrentPaymentId(payment.id);
          setCurrentTxnId(payment.transaction_id);
          setAdminNotes(payment.admin_notes);
          if (payment.status !== status) {
            setStatus(payment.status);
            onStatusChanged?.(payment.status);
          }
        }

        // Also check booking for confirmed meeting room
        const b = await bookingsService.getById(bookingId);
        if (b && isMounted) {
          if (b.meeting_room_id) {
            setEffectiveMeetingRoomId(b.meeting_room_id);
          }
          if (b.payment_status === "paid" || b.status === "confirmed") {
            if (status !== "verified") {
              setStatus("verified");
              onStatusChanged?.("verified");
            }
          }
        }
      } catch (err) {
        console.warn("[CurrencyTransfer] Poll error (non-fatal):", err);
      }
    };

    // Initial query
    checkDbStatus();

    // 2. Realtime channel subscription
    const channel = supabase
      .channel(`currency_transfer_${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "upi_payments",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload: any) => {
          const rec = payload.new as UPIPayment;
          if (rec && isMounted) {
            setCurrentTxnId(rec.transaction_id);
            setAdminNotes(rec.admin_notes);
            setStatus(rec.status);
            onStatusChanged?.(rec.status);

            if (rec.status === "verified") {
              toast.success("Payment verified! Your booking has been confirmed.");
            } else if (rec.status === "rejected") {
              toast.error(
                `Payment verification failed: ${rec.admin_notes || "Please check UTR details and try again."}`
              );
            }
          }
        }
      )
      .subscribe();

    // 3. Fallback polling interval every 5s while pending
    const interval = setInterval(() => {
      if (status === "pending") {
        checkDbStatus();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [bookingId, status]);

  const copyTxn = () => {
    navigator.clipboard.writeText(currentTxnId);
    setCopied(true);
    toast.success("UTR / Transaction ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetrySubmit = async () => {
    if (!newTxnInput.trim() || newTxnInput.trim().length < 5) {
      toast.error("Please enter a valid Transaction ID / UTR number (at least 5 characters)");
      return;
    }

    if (!currentPaymentId) {
      toast.error("Payment record not found. Please reload.");
      return;
    }

    setRetrying(true);
    try {
      const updated = await upiPaymentService.resubmitTransactionId(
        currentPaymentId,
        newTxnInput.trim()
      );
      setCurrentTxnId(updated.transaction_id);
      setStatus("pending");
      setAdminNotes(null);
      setRetryDialogOpen(false);
      setNewTxnInput("");
      toast.success("Transaction ID updated! Admin verification is now in progress.");
      onStatusChanged?.("pending");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update transaction ID.");
    } finally {
      setRetrying(false);
    }
  };

  // Derive KokonutUI steps based on current status
  const steps: Step[] = [
    {
      id: "step-1",
      title: "Payment submitted",
      description: "Transfer initiated via UPI / Netbanking",
      timestamp: "Just now",
      state: "completed",
    },
    {
      id: "step-2",
      title: "UTR & proof recorded",
      description: `Reference UTR: ${currentTxnId}`,
      timestamp: "Logged",
      state: "completed",
    },
    {
      id: "step-3",
      title: "Admin verification",
      description:
        status === "pending"
          ? "Cross-referencing bank settlement statement"
          : status === "verified"
          ? "Approved & verified by Foundarly Admin"
          : "Verification declined by Admin",
      timestamp: status === "pending" ? "In progress" : status === "verified" ? "Verified" : "Failed",
      state: status === "pending" ? "active" : status === "verified" ? "completed" : "failed",
    },
    {
      id: "step-4",
      title: "Booking confirmed & room active",
      description:
        status === "verified"
          ? "Calendar slot locked & secure video room ready"
          : status === "rejected"
          ? "Action required to activate session"
          : "Awaiting admin confirmation",
      timestamp: status === "verified" ? "Arrived" : undefined,
      state: status === "verified" ? "completed" : status === "rejected" ? "failed" : "waiting",
    },
  ];

  const overallState: TransferStatus =
    status === "verified" ? "completed" : status === "rejected" ? "failed" : "processing";

  const roomLink = effectiveMeetingRoomId || `foundarly-${bookingId}`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Main KokonutUI Transfer Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative bg-card/80 backdrop-blur-xl border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
      >
        {/* Subtle Ambient Background Gradient */}
        <div
          className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
            overallState === "completed"
              ? "bg-emerald-500/15"
              : overallState === "failed"
              ? "bg-destructive/15"
              : "bg-amber-500/15"
          }`}
        />

        {/* Top Status Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full ${
                overallState === "completed"
                  ? "bg-emerald-500 animate-pulse"
                  : overallState === "failed"
                  ? "bg-destructive"
                  : "bg-amber-500 animate-ping"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {overallState === "completed"
                ? "Payment Confirmed"
                : overallState === "failed"
                ? "Verification Failed"
                : "Admin Verification In Progress"}
            </span>
          </div>

          {/* Copyable UTR Pill */}
          <button
            onClick={copyTxn}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1 bg-secondary/80 hover:bg-secondary border border-border/60 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground transition-all group"
            title="Click to copy Transaction ID"
          >
            <span>UTR:</span>
            <span className="font-semibold text-foreground">{currentTxnId}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500 ml-1" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground ml-1" />
            )}
          </button>
        </div>

        {/* Currency & Amount Display */}
        <div className="text-center py-4 px-2 bg-secondary/30 border border-border/40 rounded-2xl mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
            Total Transfer Amount
          </p>
          <div className="flex items-baseline justify-center gap-1.5 font-display">
            <span className="text-2xl font-bold text-primary">₹</span>
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              {amount.toLocaleString("en-IN")}
            </span>
            <span className="text-sm font-semibold text-muted-foreground uppercase ml-1">
              {currency}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {sessionDuration} Min Session with{" "}
            <span className="font-semibold text-foreground">{consultantName}</span>
          </p>
        </div>

        {/* Transfer Route (From -> To) */}
        <div className="grid grid-cols-5 items-center gap-2 p-3.5 bg-background/60 border border-border/50 rounded-2xl mb-8 text-xs">
          {/* Sender */}
          <div className="col-span-2 flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{customerName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{customerEmail}</p>
            </div>
          </div>

          {/* Transfer Arrow Icon */}
          <div className="col-span-1 flex justify-center">
            <div
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
                overallState === "completed"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : overallState === "failed"
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              }`}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Receiver */}
          <div className="col-span-2 flex items-center gap-2.5 justify-end text-right min-w-0">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{consultantName}</p>
              <p className="text-[11px] text-muted-foreground truncate">Foundarly Escrow</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Stepper Timeline (KokonutUI style) */}
        <div className="relative pl-6 sm:pl-8 space-y-7 before:absolute before:left-[17px] sm:before:left-[21px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border/60">
          {steps.map((step, idx) => {
            const isCompleted = step.state === "completed";
            const isActive = step.state === "active";
            const isFailed = step.state === "failed";
            const isWaiting = step.state === "waiting";

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="relative flex items-start justify-between gap-4"
              >
                {/* Node icon on timeline line */}
                <div
                  className={`absolute -left-[24px] sm:-left-[28px] top-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isActive
                      ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20"
                      : isFailed
                      ? "bg-destructive border-destructive text-white"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {isCompleted && <Check className="h-3 w-3 stroke-[3]" />}
                  {isActive && <RefreshCw className="h-3 w-3 animate-spin stroke-[2.5]" />}
                  {isFailed && <XCircle className="h-3 w-3" />}
                  {isWaiting && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                </div>

                {/* Step Details */}
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm font-semibold transition-colors ${
                        isActive
                          ? "text-amber-500 dark:text-amber-400"
                          : isCompleted
                          ? "text-foreground"
                          : isFailed
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </h4>
                    {isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>

                {/* Step Timestamp */}
                {step.timestamp && (
                  <span
                    className={`text-[11px] font-medium shrink-0 ${
                      isActive
                        ? "text-amber-500 font-semibold"
                        : isCompleted
                        ? "text-emerald-500 font-semibold"
                        : isFailed
                        ? "text-destructive font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.timestamp}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Dynamic Contextual Action Panel */}
        <div className="mt-8 pt-6 border-t border-border/60">
          <AnimatePresence mode="wait">
            {overallState === "completed" && (
              <motion.div
                key="completed-action"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-foreground">Booking Confirmed & Ready</p>
                    <p className="text-muted-foreground">
                      Session scheduled for {bookingDate} at {bookingTime}. Meeting link is active.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => navigate(`/meeting/${roomLink}`)}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <Video className="h-4 w-4" />
                    Enter Meeting Room
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/my-bookings")}
                    className="w-full gap-2 border-border"
                  >
                    View in My Bookings
                  </Button>
                </div>
              </motion.div>
            )}

            {overallState === "failed" && (
              <motion.div
                key="failed-action"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-destructive">Verification Issue Reported</p>
                    <p className="text-muted-foreground">
                      {adminNotes || "The provided UTR / Transaction ID could not be verified against the received payment statement."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      setNewTxnInput(currentTxnId);
                      setRetryDialogOpen(true);
                    }}
                    className="w-full gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Update UTR & Retry
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/my-bookings")}
                    className="w-full"
                  >
                    Go to My Bookings
                  </Button>
                </div>
              </motion.div>
            )}

            {overallState === "processing" && (
              <motion.div
                key="processing-action"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 text-center"
              >
                <div className="p-4 bg-secondary/40 border border-border/50 rounded-2xl text-xs space-y-1.5 text-muted-foreground">
                  <p className="font-medium text-foreground flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Admin verification typically completes within 10–30 minutes
                  </p>
                  <p>
                    You will receive an automated confirmation email once verified. This screen updates in real time.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/my-bookings")}
                    className="text-xs border-border hover:bg-secondary"
                  >
                    View in My Bookings
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setNewTxnInput(currentTxnId);
                      setRetryDialogOpen(true);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit UTR Reference
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Retry / Edit UTR Dialog */}
      <Dialog open={retryDialogOpen} onOpenChange={setRetryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Transaction / UTR Number</DialogTitle>
            <DialogDescription>
              Enter the correct 12-digit UTR or Bank Reference number from your payment app (Google Pay, PhonePe, Paytm, etc.).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Transaction ID / UTR Number
              </label>
              <Input
                placeholder="e.g., 429182749102"
                value={newTxnInput}
                onChange={(e) => setNewTxnInput(e.target.value)}
                className="font-mono text-sm tracking-wider uppercase"
                maxLength={30}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Double check the UTR number in your banking transaction receipt.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRetryDialogOpen(false)}
              disabled={retrying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRetrySubmit}
              disabled={retrying}
              className="gap-2"
            >
              {retrying && <RefreshCw className="h-4 w-4 animate-spin" />}
              {retrying ? "Updating..." : "Resubmit for Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { bookingsService } from "@/services/bookings";
import { upiPaymentService } from "@/services/upiPayment";
import { consultantsService } from "@/services/consultants";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from 'qrcode.react';
import { 
  CheckCircle, 
  Copy, 
  QrCode, 
  Phone, 
  Mail, 
  Calendar,
  Clock,
  User,
  CreditCard,
  AlertCircle,
  MessageCircle,
  Shield,
  ArrowRight,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/PageLoader";
import { validateEmail, sanitizeString } from "@/utils/security";

const UPI_DETAILS = {
  accountHolder: "Abhishek Agarwal",
  upiId: "aagarwal1019@oksbi",
  accountNumber: "4549460820",
  ifscCode: "KKBK0007474",
  branch: "CHAMPAPET",
};

export default function UPIPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();
  const { formatPrice } = useCurrency();

  const [booking, setBooking] = useState<any>(null);
  const [consultant, setConsultant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi');

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    transactionId: "",
    message: "",
  });

  const bookingId = searchParams.get("booking");

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Please login to continue");
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (bookingId && !authLoading) {
      loadBookingDetails();
    }
  }, [bookingId, authLoading]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      console.log("[UPIPaymentPage] Loading booking details for bookingId:", bookingId);
      
      if (!bookingId) {
        toast.error("No booking ID provided");
        navigate("/booking");
        return;
      }

      // Check state from navigation first
      const stateBooking = (location.state as any)?.booking;
      let effectiveBooking = stateBooking && stateBooking.id === bookingId ? stateBooking : null;

      // Try fetching directly from Supabase
      try {
        const foundBooking = await bookingsService.getById(bookingId);
        if (foundBooking) {
          effectiveBooking = foundBooking;
        }
      } catch (e) {
        console.warn("[UPIPaymentPage] Supabase fetch error (continuing with state if present):", e);
      }
      
      if (!effectiveBooking) {
        console.error("[UPIPaymentPage] Booking not found for ID:", bookingId);
        toast.error("Booking not found.");
        navigate("/booking");
        return;
      }

      console.log("[UPIPaymentPage] Using booking:", effectiveBooking);
      setBooking(effectiveBooking);

      // Get consultant details
      try {
        const consultants = await consultantsService.getAll();
        const foundConsultant = consultants.find(c => c.id === effectiveBooking.consultant_id);
        setConsultant(foundConsultant);
      } catch (e) {
        console.warn("[UPIPaymentPage] Error fetching consultant details:", e);
      }

      // Check if payment already submitted
      try {
        const existingPayment = await upiPaymentService.getPaymentByBookingId(bookingId);
        if (existingPayment) {
          // Payment already submitted - show as submitted
          setSubmitted(true);
          setFormData({
            customerName: existingPayment.customer_name,
            customerPhone: existingPayment.customer_phone,
            customerEmail: existingPayment.customer_email,
            transactionId: existingPayment.transaction_id,
            message: existingPayment.booking_message || "",
          });
          return;
        }
      } catch (error: any) {
        // No payment found or table doesn't exist - continue to form
        console.log("No existing payment found");
      }

      // Pre-fill form for new payment
      setFormData({
        customerName: effectiveBooking.name || "",
        customerPhone: "",
        customerEmail: effectiveBooking.email || "",
        transactionId: "",
        message: effectiveBooking.message || "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to load booking details");
      navigate("/booking");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customerName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!formData.customerPhone.trim() || formData.customerPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!validateEmail(formData.customerEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!formData.transactionId.trim() || formData.transactionId.length < 5) {
      toast.error("Please enter a valid transaction ID / UTR number");
      return;
    }

    setSubmitting(true);

    try {
      // Create UPI payment record
      await upiPaymentService.createPayment({
        booking_id: booking.id,
        user_id: user!.id,
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone,
        customer_email: formData.customerEmail,
        transaction_id: formData.transactionId,
        payment_amount: booking.session_price,
        payment_method: paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer',
        consultant_id: booking.consultant_id,
        session_duration: booking.session_duration,
        booking_date: booking.date,
        booking_time: booking.time,
        booking_message: formData.message || null,
      });

      // Update booking status to pending verification
      await bookingsService.update(booking.id, {
        payment_status: 'pending',
        status: 'pending',
      });

      toast.success("Payment details submitted successfully!");
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit payment details");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <PageLoader text="Loading payment details..." />;
  }

  if (!booking || !consultant) {
    return <PageLoader text="Loading..." />;
  }

  // Generate UPI payment string for QR code
  const upiString = `upi://pay?pa=${UPI_DETAILS.upiId}&pn=${encodeURIComponent(UPI_DETAILS.accountHolder)}&am=${booking.session_price}&cu=INR&tn=${encodeURIComponent(`Booking ${booking.id.slice(0, 8)}`)}`;

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="p-12 text-center bg-gradient-card border-primary/20">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6"
              >
                <Clock className="h-10 w-10 text-amber-500" />
              </motion.div>
              
              <h2 className="font-display text-3xl font-bold mb-4 text-gradient-gold">
                Payment Under Verification
              </h2>
              
              <p className="text-muted-foreground mb-6">
                Your payment details have been submitted successfully. Our admin team will verify your payment and confirm your booking within 24 hours.
              </p>

              <div className="bg-secondary/50 rounded-xl p-6 mb-6 space-y-4">
                <h3 className="font-semibold text-lg mb-4">Payment Details Submitted</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                    <p className="font-medium">{formData.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                    <p className="font-medium">{formData.customerPhone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="font-medium">{formData.customerEmail}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Transaction ID</p>
                    <p className="font-mono font-bold text-primary">{formData.transactionId}</p>
                  </div>
                  {formData.message && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Message</p>
                      <p className="text-sm">{formData.message}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount Paid</span>
                    <span className="text-lg font-bold text-primary">{formatPrice(booking.session_price)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                    Verification in Progress
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your payment is being verified by our admin team. You'll receive a confirmation once approved. This usually takes 2-24 hours.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate(profile?.role === 'admin' ? '/admin' : (profile?.role === 'consultant' || profile?.is_consultant) ? '/consultant/dashboard' : '/my-bookings')} className="glow-gold-sm">
                  View My Bookings
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-6 py-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Complete Your <span className="text-gradient-gold">Payment</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pay securely using UPI and submit your transaction details for verification
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Payment Details */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8 bg-gradient-card border-primary/20 sticky top-24">
                <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                  <CreditCard className="h-6 w-6 text-primary" />
                  Payment Method
                </h2>

                {/* Payment Method Selector */}
                <RadioGroup value={paymentMethod} onValueChange={(v: 'upi' | 'bank') => setPaymentMethod(v)} className="mb-6">
                  <div className="flex items-center space-x-2 p-4 border-2 border-primary rounded-lg bg-primary/5 cursor-pointer">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">UPI Payment</p>
                          <p className="text-xs text-muted-foreground">Pay via any UPI app</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border-2 border-border rounded-lg hover:border-primary/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="bank" id="bank" />
                    <Label htmlFor="bank" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">Bank Transfer</p>
                          <p className="text-xs text-muted-foreground">Direct bank transfer</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === 'upi' ? (
                  <>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-primary" />
                      UPI Payment Details
                    </h3>

                    {/* QR Code */}
                    <div className="bg-white p-6 rounded-xl mb-6 flex items-center justify-center">
                      <div className="text-center">
                        <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                          <QRCodeSVG 
                            value={upiString}
                            size={200}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        <p className="text-sm text-gray-600 font-medium mt-4">Scan to Pay with Any UPI App</p>
                      </div>
                    </div>

                    {/* UPI ID */}
                    <div className="space-y-4">
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">UPI ID</p>
                            <p className="font-mono font-semibold text-primary">{UPI_DETAILS.upiId}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(UPI_DETAILS.upiId, "UPI ID")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Bank Transfer Details
                    </h3>

                    {/* Bank Account Details */}
                    <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Account Holder</p>
                        <p className="font-semibold">{UPI_DETAILS.accountHolder}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Account Number</p>
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-sm">{UPI_DETAILS.accountNumber}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(UPI_DETAILS.accountNumber, "Account Number")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">IFSC Code</p>
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-sm">{UPI_DETAILS.ifscCode}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(UPI_DETAILS.ifscCode, "IFSC Code")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Branch</p>
                        <p className="text-sm">{UPI_DETAILS.branch}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Amount to Pay */}
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Amount to Pay</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(booking.session_price)}
                    </span>
                  </div>
                </div>

                {/* Booking Summary */}
                <div className="border-t border-border pt-4 mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Consultant</span>
                    <span className="font-medium">{consultant.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{booking.session_duration} minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Preferred Date</span>
                    <span className="font-medium">{booking.date}{booking.time && booking.time !== 'Flexible' ? ` at ${booking.time}` : ''}</span>
                  </div>
                </div>

                {/* Important Note */}
                <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                      Important Note
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your booking will be confirmed after manual payment verification by admin. This usually takes 2-24 hours.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Right: Payment Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-8 bg-gradient-card border-border">
                <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  Submit Payment Details
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Full Name */}
                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Full Name
                    </label>
                    <Input
                      required
                      placeholder="Enter your full name"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      Phone Number
                    </label>
                    <Input
                      required
                      type="tel"
                      placeholder="Enter your phone number"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      Email Address
                    </label>
                    <Input
                      required
                      type="email"
                      placeholder="Enter your email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Transaction ID */}
                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Transaction ID / UTR Number / Reference Number
                    </label>
                    <Input
                      required
                      placeholder={paymentMethod === 'upi' ? "Enter UPI transaction ID" : "Enter bank transfer reference number"}
                      value={formData.transactionId}
                      onChange={(e) => setFormData({ ...formData, transactionId: e.target.value.toUpperCase() })}
                      className="bg-secondary border-border font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {paymentMethod === 'upi' 
                        ? "You can find this in your UPI app's transaction history" 
                        : "You can find this in your bank statement or transaction receipt"}
                    </p>
                  </div>

                  {/* Additional Message */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Additional Message (Optional)
                    </label>
                    <Textarea
                      placeholder="Any special requests or notes..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="bg-secondary border-border min-h-[100px]"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full glow-gold"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Submit Payment Details
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>

                  {/* Support */}
                  <div className="text-center pt-4">
                    <p className="text-sm text-muted-foreground">
                      Your payment is being verified. You'll receive confirmation within 24 hours.
                    </p>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

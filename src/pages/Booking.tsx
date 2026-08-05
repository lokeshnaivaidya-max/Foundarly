import { useState, useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, CreditCard, Lock, Clock, Calendar, Tag, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { consultantsService } from "@/services/consultants";
import { bookingsService } from "@/services/bookings";
import { referralsService } from "@/services/referrals";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { initiateRazorpayPayment } from "@/services/razorpay";
import { emailService } from "@/services/email";
import { supabase } from "@/lib/supabase";
import { PageLoader } from "@/components/PageLoader";
import { BookingSEO } from "@/components/SEO";
import { 
  validateEmail, 
  sanitizeString, 
  checkRateLimit,
  secureLog 
} from "@/utils/security";

function Particle({ x, y, size, delay, dur }: { x: string; y: string; size: number; delay: number; dur: number }) {
  return (
    <motion.div className="absolute rounded-full bg-primary/25 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -18, 0], opacity: [0.1, 0.4, 0.1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }} />
  );
}

const PARTICLES = [
  { x: "5%",  y: "25%", size: 5, delay: 0,   dur: 5.5 },
  { x: "92%", y: "18%", size: 4, delay: 1.3, dur: 6   },
  { x: "85%", y: "70%", size: 6, delay: 2.1, dur: 7   },
  { x: "8%",  y: "72%", size: 3, delay: 0.7, dur: 5   },
];

export default function BookingPage() {
  const [submitted, setSubmitted] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", consultant_id: "", date: "", message: "", session_duration: 60 });
  const [selectedConsultant, setSelectedConsultant] = useState<any>(null);

  // Referral code state
  const [referralInput, setReferralInput] = useState("");
  const [appliedReferral, setAppliedReferral] = useState<any>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const { user, profile, loading: authLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [4, -4]);
  const rotateY = useTransform(mouseX, [-300, 300], [-4, 4]);
  const formRef = useRef<HTMLDivElement>(null);
  const formInView = useInView(formRef, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!authLoading && user) {
      if (profile?.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }
      if (profile?.role === "consultant" || profile?.is_consultant) {
        navigate("/consultant/dashboard", { replace: true });
        return;
      }
    } else if (!authLoading && !user) {
      toast.error("Please login to book a session");
      navigate("/login");
    }
  }, [user, profile, authLoading, navigate]);

  const { data: consultants, isLoading } = useQuery({
    queryKey: ["consultants", "active"],
    queryFn: () => consultantsService.getAll(true),
  });

  useEffect(() => {
    if (user && profile) setFormData(prev => ({ ...prev, name: profile.full_name || "", email: user.email || "" }));
  }, [user, profile]);

  useEffect(() => {
    const id = searchParams.get("consultant");
    if (id && consultants) {
      const found = consultants.find(c => c.id === id);
      if (found) { setFormData(prev => ({ ...prev, consultant_id: id })); setSelectedConsultant(found); }
    }
  }, [consultants, searchParams]);

  useEffect(() => {
    if (formData.consultant_id && consultants) setSelectedConsultant(consultants.find(c => c.id === formData.consultant_id) || null);
    else setSelectedConsultant(null);
  }, [formData.consultant_id, consultants]);

  const sessionPrice = selectedConsultant?.pricing_60 || 0;
  const effectivePrice = Math.max(0, sessionPrice - discountAmount);

  const handleApplyReferral = async () => {
    if (!referralInput.trim()) {
      toast.error("Please enter a referral code");
      return;
    }
    if (!sessionPrice) {
      toast.error("Please select a consultant first");
      return;
    }

    setIsValidatingReferral(true);
    try {
      const result = await referralsService.validateCode(referralInput, sessionPrice);
      if (result.valid) {
        setAppliedReferral(result.codeObj || { code: referralInput.toUpperCase() });
        setDiscountAmount(result.discountAmount);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Error validating referral code");
    } finally {
      setIsValidatingReferral(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleChange = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) { 
      toast.error("Please login"); 
      navigate("/login"); 
      return; 
    }

    // Rate limiting (max 3 bookings per minute per user)
    if (!checkRateLimit(`booking-${user.id}`, 3, 60000)) {
      toast.error("Too many booking attempts. Please wait a moment.");
      return;
    }

    // Validate inputs
    if (!formData.consultant_id) { 
      toast.error("Please select a consultant"); 
      return; 
    }
    if (!formData.date) { 
      toast.error("Please select a preferred date"); 
      return; 
    }
    if (!validateEmail(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (formData.name.trim().length < 2) {
      toast.error("Please enter your full name");
      return;
    }

    // Validate date is not in the past (allow today and future dates)
    const todayStr = new Date().toISOString().split("T")[0];
    if (formData.date < todayStr) {
      toast.error("Please select a valid date (today or future)");
      return;
    }

    setPaymentProcessing(true);
    
    try {
      console.log("[BookingPage.handleSubmit] Initiating booking creation in Supabase...", {
        user_id: user?.id,
        consultant_id: formData.consultant_id,
        name: formData.name,
        email: formData.email,
        date: formData.date,
        session_price: sessionPrice
      });

      const booking = await bookingsService.create({
        user_id: user?.id || null, 
        consultant_id: formData.consultant_id, 
        name: sanitizeString(formData.name), 
        email: formData.email.toLowerCase().trim(),
        date: formData.date, 
        time: "Flexible", 
        message: formData.message ? sanitizeString(formData.message) : null,
        session_duration: 60, 
        session_price: effectivePrice, 
        payment_status: "pending", 
        status: "pending",
      });
      
      console.log("[BookingPage.handleSubmit] Supabase booking created successfully! Booking ID:", booking.id);

      if (appliedReferral) {
        await referralsService.recordUsage({
          referral_code_id: appliedReferral.id || null,
          code: appliedReferral.code,
          booking_id: booking.id,
          user_email: formData.email,
          user_id: user?.id || null,
          discount_amount: discountAmount,
          original_price: sessionPrice,
          final_price: effectivePrice
        });
      }

      // Redirect to UPI payment page AFTER booking exists in database
      navigate(`/upi-payment?booking=${booking.id}`, { state: { booking } });
      return;
      
      // Old Razorpay flow (kept for reference, not executed)
      await initiateRazorpayPayment({
        amount: sessionPrice || 0, 
        currency: "INR", 
        bookingId: booking.id,
        consultantName: selectedConsultant?.name || "", 
        sessionDuration: formData.session_duration,
        userName: formData.name, 
        userEmail: formData.email,
        onSuccess: async (paymentId: string, orderId: string, signature: string) => {
          try {
            // Verify payment signature via Edge Function
            const { data: verificationResult, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_payment_id: paymentId,
                razorpay_order_id: orderId,
                razorpay_signature: signature,
                bookingId: booking.id
              }
            });

            if (verifyError || !verificationResult?.verified) {
              throw new Error('Payment verification failed. Please contact support.');
            }

            // Send confirmation emails (non-blocking)
            emailService.sendBookingConfirmation(booking.id).catch(err => {
              secureLog.error('Failed to send confirmation emails:', err);
            });
            
            toast.success("Payment verified! Booking confirmed.");
            setSubmitted(true);
            setPaymentProcessing(false);
          } catch (error: any) {
            secureLog.error('Verification error:', error);
            toast.error(error.message || "Payment verification failed");
            setPaymentProcessing(false);
          }
        },
        onFailure: async (error) => {
          await bookingsService.delete(booking.id);
          if (error?.message !== "Payment cancelled by user") {
            toast.error(error?.description || "Payment failed.");
          } else {
            toast.info("Payment cancelled.");
          }
          setPaymentProcessing(false);
        },
      });
    } catch (error: any) {
      secureLog.error('Booking error:', error);
      toast.error(error.message || "Failed to process booking.");
      setPaymentProcessing(false);
    }
  };

  if (authLoading) return <PageLoader text="Loading..." />;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <BookingSEO />
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

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/8 mb-7"
            initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
            <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">Book a Session</span>
          </motion.div>
          <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
            <motion.h1 className="font-display text-5xl md:text-6xl font-bold leading-tight"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}>
              Schedule Your{" "}
              <span className="relative inline-block">
                <span className="text-gradient-gold">Consultation</span>
                <motion.div className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-amber-400"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h1>
          </motion.div>
          <motion.p className="mt-5 text-muted-foreground max-w-md mx-auto text-sm md:text-base"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
            Private 1-on-1 sessions with verified experts. Secure payment, instant confirmation.
          </motion.p>
        </div>
      </section>

      {/* ── Form ── */}
      <section className="py-16 bg-background relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-6 max-w-2xl relative z-10">
          <motion.div ref={formRef} initial={{ opacity: 0, y: 30 }} animate={formInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>

            {submitted ? (
              <motion.div className="bg-gradient-card border border-primary/20 rounded-2xl p-12 text-center"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                style={{ boxShadow: "0 32px 80px -20px hsl(45 100% 50% / 0.15)" }}>
                <motion.div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.1 }}>
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </motion.div>
                <h2 className="font-display text-2xl font-bold mb-3 text-gradient-gold">Booking Confirmed!</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your payment was successful. A confirmation has been sent to{" "}
                  <span className="text-foreground font-medium">{formData.email}</span>
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate(profile?.role === 'admin' ? '/admin' : (profile?.role === 'consultant' || profile?.is_consultant) ? '/consultant/dashboard' : '/my-bookings')} className="glow-gold-sm">View My Bookings</Button>
                  <Button variant="outline" onClick={() => { setSubmitted(false); setFormData({ name: "", email: "", consultant_id: "", date: "", message: "", session_duration: 60 }); }}>
                    Book Another
                  </Button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit}
                className="bg-gradient-card border border-border rounded-2xl p-8 space-y-6 relative overflow-hidden"
                style={{ boxShadow: "0 24px 60px -16px hsl(45 100% 50% / 0.10)" }}>
                {/* Corner glow */}
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/8 blur-3xl pointer-events-none" />

                {/* Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Full Name</label>
                    <Input required placeholder="Your name" className="bg-secondary border-border focus:border-primary/50 transition-colors"
                      value={formData.name} onChange={(e) => handleChange("name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Email</label>
                    <Input required type="email" placeholder="you@example.com" className="bg-secondary border-border focus:border-primary/50 transition-colors"
                      value={formData.email} onChange={(e) => handleChange("email", e.target.value)} />
                  </div>
                </div>

                {/* Consultant */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">Select Consultant</label>
                  {isLoading ? (
                    <div className="bg-secondary border border-border rounded-lg p-3 text-sm text-muted-foreground">Loading consultants...</div>
                  ) : (
                    <Select value={formData.consultant_id} onValueChange={(v) => handleChange("consultant_id", v)}>
                      <SelectTrigger className="bg-secondary border-border focus:border-primary/50">
                        <SelectValue placeholder="Choose an expert" />
                      </SelectTrigger>
                      <SelectContent>
                        {consultants?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} — {c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Session Duration */}
                {selectedConsultant && (
                  <motion.div className="bg-secondary/40 border border-border rounded-xl p-4"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.3 }}>
                    <label className="text-sm font-medium text-foreground mb-3 block">Session Duration</label>
                    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full p-4 rounded-xl border-2 border-primary bg-primary/10 shadow-sm text-left">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold text-foreground text-sm">30-60 min session</span>
                      </div>
                      <div className="text-xl font-bold text-primary">{formatPrice(selectedConsultant.pricing_60)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Deep-dive consultation</div>
                    </motion.button>
                  </motion.div>
                )}

                {/* Preferred Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5 block">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Preferred Date *
                  </label>
                  <Input required type="date" className="bg-secondary border-border focus:border-primary/50 w-full"
                    value={formData.date} onChange={(e) => handleChange("date", e.target.value)}
                    min={new Date().toISOString().split("T")[0]} />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">Message (optional)</label>
                  <Textarea placeholder="Tell us about your goals..." className="bg-secondary border-border min-h-[90px] resize-none focus:bor
der-primary/50"
                    value={formData.message} onChange={(e) => handleChange("message", e.target.value)} />
                </div>

                {/* Referral Code Section */}
                {selectedConsultant && sessionPrice > 0 && (
                  <div className="space-y-2 bg-secondary/30 p-3.5 rounded-xl border border-border/80">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      Referral / Promo Code
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code (e.g. FOUNDARLY10)"
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                        disabled={appliedReferral || isValidatingReferral}
                        className="bg-background border-border text-xs uppercase tracking-wider uppercase font-mono"
                      />
                      {appliedReferral ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAppliedReferral(null);
                            setDiscountAmount(0);
                            setReferralInput("");
                          }}
                          className="text-xs text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleApplyReferral}
                          disabled={isValidatingReferral || !referralInput.trim()}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shrink-0"
                        >
                          {isValidatingReferral ? "Validating..." : "Apply"}
                        </Button>
                      )}
                    </div>
                    {appliedReferral && (
                      <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">
                        <Check size={12} /> Referral code <span className="font-bold">{appliedReferral.code}</span> applied successfully!
                      </p>
                    )}
                  </div>
                )}

                {/* Order Summary */}
                {selectedConsultant && sessionPrice > 0 && (
                  <motion.div className="bg-primary/6 border border-primary/20 rounded-xl p-4 space-y-2.5"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>Order Summary</span>
                      {appliedReferral && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Sparkles size={10} /> Discount Applied
                        </span>
                      )}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{selectedConsultant.name}</span>
                      <span className="text-foreground">{formatPrice(sessionPrice)}</span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-500 font-medium">
                        <span>Referral Discount ({appliedReferral?.code})</span>
                        <span>-{formatPrice(discountAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold border-t border-primary/20 pt-2 text-base">
                      <span className="text-foreground">Total Payable</span>
                      <span className="text-primary text-xl">{formatPrice(effectivePrice)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pt-1 border-t border-primary/10">* Prices are indicative and may vary — rates can go higher or lower based on consultant expertise, session complexity, and market conditions.</p>
                  </motion.div>
                )}

                {/* Submit */}
                <Button type="submit" size="lg" className="w-full glow-gold py-6 text-base" disabled={paymentProcessing || !selectedConsultant}>
                  {paymentProcessing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Pay {selectedConsultant ? formatPrice(effectivePrice) : ""} & Confirm Booking
                    </span>
                  )}
                </Button>

                <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                  <Lock size={12} className="text-primary" />
                  <span>Secured by Razorpay · 100% safe & encrypted</span>
                  <Shield size={12} className="text-primary" />
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

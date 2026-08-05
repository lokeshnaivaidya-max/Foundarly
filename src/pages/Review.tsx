import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsService } from "@/services/bookings";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Star, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/PageLoader";
import { motion, AnimatePresence } from "framer-motion";

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hovered || value);
        return (
          <motion.button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Star
              className={`h-10 w-10 transition-colors duration-150 ${
                active ? "fill-primary text-primary drop-shadow-[0_0_8px_hsl(45,100%,50%,0.6)]" : "text-muted-foreground/40"
              }`}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

export default function ReviewPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const getBackPath = () => profile?.role === 'admin' ? '/admin' : (profile?.role === 'consultant' || profile?.is_consultant) ? '/consultant/dashboard' : '/my-bookings';

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, [user]);

  const load = async () => {
    try {
      const bookings = await bookingsService.getByUserId(user!.id);
      const found = bookings.find((b: any) => b.id === bookingId);
      if (!found) { navigate(getBackPath()); return; }
      setBooking(found);
      setDisplayName((found as any).name || "");

      // Check if already reviewed
      const { data } = await supabase
        .from("testimonials")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (data) setAlreadyReviewed(true);
    } catch {
      navigate(getBackPath());
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!rating) { toast.error("Please select a star rating"); return; }
    if (!reviewText.trim()) { toast.error("Please write your review"); return; }
    setSubmitting(true);
    try {
      console.log("Submitting review with data:", {
        client_name: displayName.trim() || booking.name,
        designation: "Client",
        review: reviewText.trim(),
        rating,
        status: "draft",
        consultant_id: booking.consultant_id,
        booking_id: bookingId,
      });

      const { data, error } = await (supabase as any).from("testimonials").insert({
        client_name: displayName.trim() || booking.name,
        designation: "Client",
        review: reviewText.trim(),
        rating,
        status: "draft",
        consultant_id: booking.consultant_id || null,
        booking_id: bookingId,
      }).select();

      if (error) {
        console.error("Review submission error:", error);
        throw error;
      }

      console.log("Review submitted successfully:", data);
      
      // Try to update booking status, but don't fail if it errors
      try {
        await bookingsService.update(bookingId!, { status: "completed" });
      } catch (updateError) {
        console.warn("Could not update booking status:", updateError);
        // Continue anyway - review was submitted successfully
      }
      
      setSubmitted(true);
      toast.success("Review submitted successfully!");
    } catch (err: any) {
      console.error("Full error object:", err);
      if (err?.code === "23505") {
        toast.error("You have already submitted a review for this session.");
        setAlreadyReviewed(true);
      } else if (err?.code === "42703") {
        toast.error("Database schema issue. Please run the review fields migration.");
        console.error("Missing columns in testimonials table. Run database/add-review-fields.sql");
      } else {
        toast.error(`Failed to submit review: ${err?.message || "Please try again"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getDefaultAvatar = (gender?: string) =>
    gender === "female" ? "/female-default.jpg" : "/male-default.png";

  if (loading) return <PageLoader text="Loading review..." />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-lg">

          {/* Header */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Session Complete</p>
            <h1 className="font-display text-4xl font-bold">
              Rate Your <span className="text-gradient-gold">Experience</span>
            </h1>
            <p className="mt-3 text-muted-foreground text-sm">
              Your feedback helps the community and helps consultants improve.
            </p>
          </motion.div>

          <AnimatePresence mode="wait">

            {/* Already reviewed */}
            {alreadyReviewed && !submitted && (
              <motion.div
                key="already"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-card border border-border rounded-2xl p-12 text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="h-8 w-8 text-yellow-400" />
                </div>
                <h2 className="font-display text-xl font-bold">Already Reviewed</h2>
                <p className="text-muted-foreground text-sm">You have already submitted a review for this session.</p>
                <Button variant="outline" onClick={() => navigate(getBackPath())}>Back</Button>
              </motion.div>
            )}

            {/* Success */}
            {submitted && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="bg-gradient-card border border-primary/20 rounded-2xl p-12 text-center space-y-5"
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                >
                  <CheckCircle className="h-10 w-10 text-green-400" />
                </motion.div>
                <h2 className="font-display text-2xl font-bold text-gradient-gold">Thank You!</h2>
                <div className="flex justify-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`h-5 w-5 ${s <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Your review has been submitted and will appear on the platform after admin approval.
                </p>
                <Button className="glow-gold-sm" onClick={() => navigate(getBackPath())}>
                  Back
                </Button>
              </motion.div>
            )}

            {/* Review form */}
            {!submitted && !alreadyReviewed && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-gradient-card border border-border rounded-2xl p-8 space-y-7"
              >
                {/* Consultant card */}
                <div className="flex items-center gap-4 pb-5 border-b border-border">
                  <img
                    src={booking?.consultants?.image_url || getDefaultAvatar(booking?.consultants?.gender)}
                    alt={booking?.consultants?.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-primary/20"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/male-default.png"; }}
                  />
                  <div>
                    <p className="font-semibold text-foreground">{booking?.consultants?.name || "Consultant"}</p>
                    <p className="text-sm text-muted-foreground">{booking?.consultants?.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {booking?.date} · {booking?.time} · {booking?.session_duration || 60} min
                    </p>
                  </div>
                </div>

                {/* Stars */}
                <div className="space-y-3 text-center">
                  <label className="text-sm font-medium block
">How would you rate this session?</label>
                  <StarPicker value={rating} onChange={setRating} />
                  <AnimatePresence>
                    {rating > 0 && (
                      <motion.p
                        className="text-sm font-medium text-primary"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {RATING_LABELS[rating]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Review text */}
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Your Review</label>
                  <Textarea
                    placeholder="Share what was most valuable about this consultation..."
                    className="bg-secondary border-border min-h-[120px] resize-none"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">{reviewText.length}/500</p>
                </div>

                {/* Display name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Display Name</label>
                  <Input
                    placeholder="Your name (as it will appear publicly)"
                    className="bg-secondary border-border"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to use your booking name</p>
                </div>

                <Button
                  className="w-full glow-gold-sm py-5 text-base"
                  onClick={handleSubmit}
                  disabled={submitting || !rating || !reviewText.trim()}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : "Submit Review"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Reviews are moderated before appearing publicly on the platform.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}

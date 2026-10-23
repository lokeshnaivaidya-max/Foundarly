import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const { updateUserPassword, session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);

    // Verify recovery session validity
    const checkRecoverySession = async () => {
      // 1. Check if hash contains recovery parameters from Supabase email link
      const hash = location.hash || window.location.hash;
      const isRecoveryHash = hash.includes("type=recovery") || hash.includes("access_token");

      if (isRecoveryHash) {
        setHasValidSession(true);
        return;
      }

      // 2. Check current Supabase active session
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setHasValidSession(true);
        } else {
          // If auth loading is done and no session/hash exists, direct access is invalid
          setHasValidSession(false);
        }
      } catch {
        setHasValidSession(false);
      }
    };

    if (!authLoading) {
      checkRecoverySession();
    }
  }, [location.hash, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidSession) {
      toast.error("No valid recovery session. Please request a new password reset link.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await updateUserPassword(password);
      if (error) throw error;

      setSuccess(true);
      toast.success("Your password has been successfully updated!");
      // Cleanly sign out recovery session so user can log in with new credentials
      try {
        await signOut();
      } catch {
        // Suppress signout errors
      }
    } catch (err: any) {
      toast.error(
        err?.message || "Failed to update password. Your recovery link may have expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Set New Password - Foundarly"
        description="Reset your account password securely."
        noindex={true}
      />
      <Header />
      <main className="pt-28 pb-24 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md px-6">
          <AnimatedSection>
            <div className="bg-gradient-card border border-border rounded-xl p-8 shadow-xl">
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="font-display text-2xl font-bold text-gradient-gold">Foundarly</span>
                <h1 className="font-display text-2xl font-bold mt-2">
                  {success
                    ? "Password Updated"
                    : hasValidSession === false
                    ? "Reset Link Required"
                    : "Reset Password"}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  {success
                    ? "Your password has been changed. You can now use your new password to sign in."
                    : hasValidSession === false
                    ? "A valid password recovery link is required to access this page."
                    : "Enter your new account password below."}
                </p>
              </div>

              {/* 1. Invalid or Direct Access State */}
              {hasValidSession === false && !success && (
                <div className="space-y-6 text-center">
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-3 text-left">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-200">No Active Recovery Session</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Password reset links are single-use and expire after a short period. Direct access to this page without a valid recovery token is not permitted for security reasons.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button
                      onClick={() => navigate("/login")}
                      className="w-full glow-gold-sm"
                    >
                      Request a Reset Link on Sign In
                    </Button>
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to Home
                    </Link>
                  </div>
                </div>
              )}

              {/* 2. Success State */}
              {success && (
                <div className="space-y-6 text-center">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Password updated successfully. You are ready to log in with your new password.</span>
                  </div>
                  <Button
                    onClick={() => navigate("/login", { replace: true })}
                    className="w-full glow-gold-sm"
                  >
                    Go to Sign In
                  </Button>
                </div>
              )}

              {/* 3. Valid Session Active - Password Input Form */}
              {hasValidSession !== false && !success && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      New Password
                    </label>
                    <div className="relative">
                      <Input
                        required
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        className="bg-secondary border-border pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Must be at least 8 characters long.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      Confirm New Password
                    </label>
                    <Input
                      required
                      type={showPassword ? "text" : "password"}
                      placeholder="Repeat your new password"
                      className="bg-secondary border-border"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full glow-gold-sm mt-2"
                    disabled={loading || password.length < 8}
                  >
                    {loading ? "Updating Password..." : "Update Password"}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}

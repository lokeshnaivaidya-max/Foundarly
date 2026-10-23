import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { updateUserPassword, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Supabase recovery links usually provide #access_token=... in the URL hash
  const hasRecoveryToken = location.hash.includes("type=recovery") || Boolean(session);

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password. Your recovery link may have expired.");
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
                  {success ? "Password Updated" : "Reset Password"}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  {success
                    ? "Your password has been changed. You can now use your new password to sign in."
                    : "Enter your new account password below."}
                </p>
              </div>

              {success ? (
                <div className="space-y-6 text-center">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Password updated successfully. You are ready to log in.</span>
                  </div>
                  <Button
                    onClick={() => navigate("/login", { replace: true })}
                    className="w-full glow-gold-sm"
                  >
                    Go to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!hasRecoveryToken && !authLoading && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5 mb-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Notice: Make sure you arrived here via a valid password recovery email link from Foundarly.
                      </span>
                    </div>
                  )}

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
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full glow-gold-sm mt-2"
                    disabled={loading}
                  >
                    {loading ? "Updating Password..." : "Update Password"}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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

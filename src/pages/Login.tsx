import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isUserAdmin } from "@/lib/authorization";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { validateEmail } from "@/utils/security";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [signupConfirmationRequired, setSignupConfirmationRequired] = useState(false);
  const { user, profile, isAdmin, isConsultant, signUp, signIn, signInWithGoogle, resetPassword, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && user) {
      console.log("user:", user);
      console.log("profile:", profile);

      const fromPath = (location.state as any)?.from?.pathname || (location.state as any)?.from;

      // Critical: If user came directly from an email meeting link (/meeting/:roomId), preserve destination for all roles
      if (typeof fromPath === 'string' && fromPath.startsWith('/meeting/')) {
        navigate(fromPath, { replace: true });
        return;
      }

      if (isAdmin || isUserAdmin(user, profile)) {
        const validAdminFrom = (typeof fromPath === 'string' && fromPath.startsWith('/admin')) ? fromPath : '/admin';
        navigate(validAdminFrom, { replace: true });
      } else if (isConsultant || profile?.role === 'consultant' || profile?.is_consultant) {
        const validConsultantFrom = (typeof fromPath === 'string' && fromPath.startsWith('/consultant')) ? fromPath : '/consultant/dashboard';
        navigate(validConsultantFrom, { replace: true });
      } else {
        const validUserFrom = (typeof fromPath === 'string' && fromPath !== "/" && fromPath !== "/login" && fromPath !== "/admin/login" && !fromPath.startsWith('/admin')) ? fromPath : '/my-bookings';
        navigate(validUserFrom, { replace: true });
      }
    }
  }, [user, profile, isAdmin, isConsultant, authLoading, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        if (!fullName.trim()) {
          toast.error("Please enter your full name.");
          setLoading(false);
          return;
        }

        const res = await signUp(cleanEmail, password, fullName);
        if (res.error) throw res.error;

        if (res.emailConfirmationRequired) {
          setSignupConfirmationRequired(true);
          toast.success("Account created! Please check your email to verify your account.");
          return;
        }

        toast.success("Account created successfully!");
        navigate("/my-bookings", { replace: true });
      } else {
        const { error, profile: userProfile } = await signIn(cleanEmail, password);
        if (error) throw error;
        toast.success("Welcome back!");

        const activeProfile = userProfile || profile;

        const fromPath = (location.state as any)?.from?.pathname || (location.state as any)?.from;

        if (typeof fromPath === 'string' && fromPath.startsWith('/meeting/')) {
          navigate(fromPath, { replace: true });
          return;
        }

        if (isUserAdmin(user, activeProfile)) {
          const validAdminFrom = (typeof fromPath === 'string' && fromPath.startsWith('/admin')) ? fromPath : '/admin';
          navigate(validAdminFrom, { replace: true });
        } else if (activeProfile?.role === 'consultant' || activeProfile?.is_consultant) {
          const validConsultantFrom = (typeof fromPath === 'string' && fromPath.startsWith('/consultant')) ? fromPath : '/consultant/dashboard';
          navigate(validConsultantFrom, { replace: true });
        } else {
          const validUserFrom = (typeof fromPath === 'string' && fromPath !== "/" && fromPath !== "/login" && fromPath !== "/admin/login" && !fromPath.startsWith('/admin')) ? fromPath : '/my-bookings';
          navigate(validUserFrom, { replace: true });
        }
      }
    } catch (error: any) {
      const msg = error.message || "An authentication error occurred.";
      if (msg.toLowerCase().includes("email not confirmed")) {
        toast.error("Please verify your email address before signing in. Check your inbox for the confirmation link.");
      } else if (msg.toLowerCase().includes("invalid login credentials")) {
        toast.error("Invalid email or password. Please verify your credentials.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      toast.error("Please enter a valid account email address");
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await resetPassword(cleanEmail);
      if (error) {
        if (error.message?.toLowerCase().includes("rate limit") || (error as any).status === 429) {
          toast.error("Too many reset attempts. Please wait a few minutes before trying again.");
          return;
        }
        console.warn("[Auth] Password reset notice:", error.message);
      }
      setForgotSent(true);
      toast.success("If an account exists, a password reset link has been dispatched.");
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("rate limit")) {
        toast.error("Too many reset attempts. Please wait a few minutes before trying again.");
      } else {
        setForgotSent(true);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md px-6">
          <AnimatedSection>
            <div className="bg-gradient-card border border-border rounded-lg p-8">
              <div className="text-center mb-8">
                <span className="font-display text-2xl font-bold text-gradient-gold">Foundarly</span>
              </div>

              {signupConfirmationRequired ? (
                <div className="space-y-6 text-center py-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3 text-left">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-300">Verification Email Sent</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        We sent a secure activation link to <span className="font-medium text-foreground">{email}</span>. Please check your inbox and verify your email address to activate your account.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSignupConfirmationRequired(false);
                      setIsSignup(false);
                    }}
                    className="w-full glow-gold-sm"
                  >
                    Proceed to Sign In
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-bold mt-4 text-center">{isSignup ? "Create Account" : "Welcome Back"}</h1>
                  <p className="text-sm text-muted-foreground mt-2 text-center mb-6">
                    {isSignup ? "Join the Foundarly community." : "Sign in to your account."}
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Full Name</label>
                    <Input
                      required
                      placeholder="John Doe"
                      className="bg-secondary border-border"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                  <Input
                    required
                    type="email"
                    placeholder="john@example.com"
                    className="bg-secondary border-border"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
                  <div className="relative">
                    <Input
                      required
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-secondary border-border pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  {!isSignup && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotSent(false);
                          setForgotOpen(true);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full glow-gold-sm" disabled={loading}>
                  {loading ? "Loading..." : isSignup ? "Create Account" : "Sign In"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center gap-2.5 border-border hover:border-primary/40 bg-secondary/30 hover:bg-secondary transition-all"
                onClick={handleGoogleSignIn}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleLoading ? "Redirecting to Google..." : "Continue with Google"}</span>
              </Button>

              <p className="text-center text-sm text-muted-foreground mt-6">
                {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                <button type="button" onClick={() => setIsSignup(!isSignup)} className="text-primary hover:underline font-medium">
                  {isSignup ? "Sign In" : "Sign Up"}
                </button>
              </p>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Admin users sign in with their registered admin account credentials.
              </p>
            </>
          )}
        </div>
      </AnimatedSection>
        </div>
      </main>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Reset Your Password
            </DialogTitle>
            <DialogDescription>
              Enter your registered account email and we will send you a secure link to reset your password.
            </DialogDescription>
          </DialogHeader>

          {forgotSent ? (
            <div className="py-4 space-y-4 text-center">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold">Reset Email Sent</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    If an account exists for <span className="font-medium text-foreground">{forgotEmail}</span>, you will receive password reset instructions shortly.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setForgotOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Account Email</label>
                <Input
                  required
                  type="email"
                  placeholder="name@example.com"
                  className="bg-secondary border-border"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="glow-gold-sm"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Sending Link..." : "Send Reset Link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}

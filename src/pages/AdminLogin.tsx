import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const fromPath = (location.state as any)?.from?.pathname;
      if (profile?.role === 'admin') {
        const validAdminFrom = (typeof fromPath === 'string' && fromPath.startsWith('/admin')) ? fromPath : '/admin';
        navigate(validAdminFrom, { replace: true });
      } else if (profile?.role === 'consultant' || profile?.is_consultant) {
        navigate("/consultant/dashboard", { replace: true });
      } else {
        navigate("/my-bookings", { replace: true });
      }
    }
  }, [user, profile, authLoading, navigate, location.state]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError, profile: userProfile } = await signIn(email, password);

      if (signInError) {
        setError(signInError.message || "Invalid email or password.");
        return;
      }

      toast.success("Successfully authenticated as Admin");
      
      const activeProfile = userProfile || profile;

      const fromPath = (location.state as any)?.from?.pathname;

      if (activeProfile?.role === 'admin') {
        const validAdminFrom = (typeof fromPath === 'string' && fromPath.startsWith('/admin')) ? fromPath : '/admin';
        navigate(validAdminFrom, { replace: true });
      } else if (activeProfile?.role === 'consultant' || activeProfile?.is_consultant) {
        navigate("/consultant/dashboard", { replace: true });
      } else {
        navigate("/my-bookings", { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative subtle background accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl relative z-10">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleBack}
              className="text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 flex items-center gap-1.5 px-2.5 py-1.5 h-auto rounded-md transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-primary" />
              <span>Back</span>
            </Button>
            
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              Admin Portal
            </div>
          </div>

          <div>
            <CardTitle className="font-display text-2xl tracking-tight">Admin Sign In</CardTitle>
            <CardDescription className="text-sm mt-1">
              Sign in with your administrator credentials to access the Foundarly management suite.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@domain.com"
                  className="bg-secondary/50 pl-9 border-border/60 focus:border-primary"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="bg-secondary/50 pl-9 pr-10 border-border/60 focus:border-primary"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-1 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
              {loading ? "Authenticating..." : "Sign In to Admin Panel"}
            </Button>
          </form>

          <p className="mt-6 text-[11px] text-muted-foreground text-center">
            Secured via Supabase Authentication & Role-Based Access Control.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


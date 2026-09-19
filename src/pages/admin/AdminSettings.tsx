import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { settingsService } from "@/services/settings";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { isUserAdmin } from "@/lib/authorization";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const { refreshCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const { user, profile, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Change Password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    platform_name: "Foundarly",
    support_email: "support@foundarly.com",
    default_session_duration: "60",
    cancellation_window: "24",
    currency: "USD",
    youtube_url: "https://youtube.com/@foundarly?si=ZHlc2Swj3Rtm37Kn",
    youtube_intro_url: "https://youtu.be/L2ndHKr9Q5Y?si=TE35364lR-3dY94F",
    instagram_url: "https://www.instagram.com/foundarlybusinessworld_in?utm_source=qr&igsh=dmVxNm8wNW93aHV5"
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsService.getAll();
      const settingsMap: any = {};
      data.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value || '';
      });
      
      setSettings({
        platform_name: settingsMap.platform_name || "Foundarly",
        support_email: settingsMap.support_email || "support@foundarly.com",
        default_session_duration: settingsMap.default_session_duration || "60",
        cancellation_window: settingsMap.cancellation_window || "24",
        currency: settingsMap.currency || "USD",
        youtube_url: settingsMap.youtube_url || "https://youtube.com/@foundarly?si=ZHlc2Swj3Rtm37Kn",
        youtube_intro_url: settingsMap.youtube_intro_url || "https://youtu.be/L2ndHKr9Q5Y?si=TE35364lR-3dY94F",
        instagram_url: settingsMap.instagram_url || "https://www.instagram.com/foundarlybusinessworld_in?utm_source=qr&igsh=dmVxNm8wNW93aHV5"
      });

      if (settingsMap.site_theme && (settingsMap.site_theme === 'light' || settingsMap.site_theme === 'dark')) {
        setTheme(settingsMap.site_theme);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each setting individually and create missing rows automatically
      await settingsService.upsert('platform_name', settings.platform_name);
      await settingsService.upsert('support_email', settings.support_email);
      await settingsService.upsert('default_session_duration', settings.default_session_duration);
      await settingsService.upsert('cancellation_window', settings.cancellation_window);
      await settingsService.upsert('currency', settings.currency);
      await settingsService.upsert('youtube_url', settings.youtube_url);
      await settingsService.upsert('youtube_intro_url', settings.youtube_intro_url);
      await settingsService.upsert('instagram_url', settings.instagram_url);
      await settingsService.upsert('site_theme', theme);

      // Refresh currency context to update all pages
      await refreshCurrency();

      toast({
        title: "Saved",
        description: "Settings updated successfully. Currency and theme will update across all pages."
      });
    } catch (error: any) {
      console.error('[AdminSettings Save Error]:', error);
      const exactErrorMsg = error?.message || error?.details || "Database update failed.";
      toast({
        title: "Database Update Error",
        description: exactErrorMsg,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    // Minimum password length validation
    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    // Confirmation matching validation
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }

    // Authorization check
    if (!user || !isUserAdmin(user, profile)) {
      setPasswordError("Unauthorized: Only verified administrators can change the password.");
      return;
    }

    setPasswordSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message || "Failed to update password. Please try again.");
        toast({
          title: "Password Update Failed",
          description: error.message || "Failed to update administrator password.",
          variant: "destructive",
        });
      } else {
        // Keep backend in sync if authenticated session token is present
        if (session?.access_token) {
          try {
            await fetch('/api/admin/change-password', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ newPassword }),
            });
          } catch {
            // Client auth update has succeeded; network/server sync error is non-fatal
          }
        }

        // Clear password state immediately for security
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setPasswordSuccess("Administrator password changed successfully. You remain logged in.");
        toast({
          title: "Password Updated",
          description: "Your administrator password has been updated successfully.",
        });
      }
    } catch (_err: unknown) {
      setPasswordError("An unexpected error occurred while updating the password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading settings...</div>;
  }
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and preferences.</p>
        {loading && (
          <p className="text-xs text-yellow-600 mt-2">
            Note: If settings fail to save, make sure you've run the site_settings table setup from supabase-setup.sql
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input 
                value={settings.platform_name} 
                onChange={(e) => setSettings({...settings, platform_name: e.target.value})}
                className="bg-background border-border" 
              />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input 
                value={settings.support_email} 
                onChange={(e) => setSettings({...settings, support_email: e.target.value})}
                className="bg-background border-border" 
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Booking</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Session Duration (minutes)</Label>
              <Input 
                value={settings.default_session_duration} 
                onChange={(e) => setSettings({...settings, default_session_duration: e.target.value})}
                type="number" 
                className="bg-background border-border" 
              />
            </div>
            <div className="space-y-2">
              <Label>Cancellation Window (hours)</Label>
              <Input 
                value={settings.cancellation_window} 
                onChange={(e) => setSettings({...settings, cancellation_window: e.target.value})}
                type="number" 
                className="bg-background border-border" 
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Payment</h2>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select 
              value={settings.currency} 
              onValueChange={(value) => setSettings({...settings, currency: value})}
            >
              <SelectTrigger className="bg-background border-border max-w-xs">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.symbol} {curr.name} ({curr.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This currency will be used across all pricing displays on the website
            </p>
          </div>
        </div>

        <Separator />

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Social Media & Video Links</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>YouTube Channel URL</Label>
              <Input 
                value={settings.youtube_url} 
                onChange={(e) => setSettings({...settings, youtube_url: e.target.value})}
                className="bg-background border-border" 
                placeholder="https://youtube.com/@foundarly"
              />
            </div>
            <div className="space-y-2">
              <Label>YouTube Introduction Video URL</Label>
              <Input 
                value={settings.youtube_intro_url} 
                onChange={(e) => setSettings({...settings, youtube_intro_url: e.target.value})}
                className="bg-background border-border" 
                placeholder="https://youtu.be/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram Profile URL</Label>
              <Input 
                value={settings.instagram_url} 
                onChange={(e) => setSettings({...settings, instagram_url: e.target.value})}
                className="bg-background border-border" 
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Appearance</h2>
          <div className="space-y-2">
            <Label>Site Theme</Label>
            <Select 
              value={theme} 
              onValueChange={(value: 'dark' | 'light') => setTheme(value)}
            >
              <SelectTrigger className="bg-background border-border max-w-xs">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-400 border border-yellow-600"></div>
                    <span>Light (Yellow & White)</span>
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-gray-800 to-yellow-600 border border-gray-600"></div>
                    <span>Dark (Gold & Black)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Changes apply immediately across the entire website
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button 
            className="glow-gold-sm" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-5" id="change-password-section">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Change Password</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Directly set a new password for your administrator account. You do not need to enter your current password.
            </p>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Admin Security</span>
          </div>
        </div>

        <Separator />

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md" autoComplete="off">
          {/* Admin Email Indicator */}
          <div className="text-xs text-muted-foreground flex items-center justify-between bg-secondary/40 border border-border/60 rounded-md px-3 py-2">
            <span className="font-medium text-foreground">Admin Account:</span>
            <span className="font-mono text-[11px] text-muted-foreground">{user?.email || "admin@foundarly.com"}</span>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="admin-new-password" className="text-xs font-medium text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="admin-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (passwordSuccess) setPasswordSuccess(null);
                }}
                placeholder="Enter new password (min. 8 characters)"
                className="bg-background border-border pr-10 focus:border-primary text-sm"
                autoComplete="new-password"
                disabled={passwordSaving}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-1 rounded-sm transition-colors"
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Minimum 8 characters required.
            </p>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="admin-confirm-password" className="text-xs font-medium text-foreground">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="admin-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (passwordSuccess) setPasswordSuccess(null);
                }}
                placeholder="Re-enter new password to confirm"
                className="bg-background border-border pr-10 focus:border-primary text-sm"
                autoComplete="new-password"
                disabled={passwordSaving}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-1 rounded-sm transition-colors"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-destructive font-medium">
                Passwords do not match.
              </p>
            )}
          </div>

          {/* Error Message Display */}
          {passwordError && (
            <div
              id="password-error-alert"
              role="alert"
              className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          {/* Success Message Display */}
          {passwordSuccess && (
            <div
              id="password-success-alert"
              role="status"
              className="p-3 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-start gap-2"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{passwordSuccess}</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Your administrator session remains active and authenticated.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              id="change-password-submit-btn"
              type="submit"
              className="glow-gold-sm"
              disabled={passwordSaving || !newPassword || !confirmPassword}
            >
              {passwordSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating Password...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

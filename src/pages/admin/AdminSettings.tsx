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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    </div>
  );
}

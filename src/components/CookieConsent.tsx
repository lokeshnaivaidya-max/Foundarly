import { useState, useEffect } from "react";
import { Cookie, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCookiePreferences,
  saveCookiePreferences,
} from "@/utils/cookieConsent";

export {
  getCookiePreferences,
  isCookieCategoryAllowed,
  saveCookiePreferences,
  type CookiePreferences,
} from "@/utils/cookieConsent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [functionalAllowed, setFunctionalAllowed] = useState(true);

  useEffect(() => {
    const existing = getCookiePreferences();
    if (!existing) {
      // Small delay so layout loads cleanly before prompt
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    saveCookiePreferences({
      essential: true,
      functional: true,
      analytics: true,
    });
    setVisible(false);
  };

  const handleRejectNonEssential = () => {
    saveCookiePreferences({
      essential: true,
      functional: false,
      analytics: false,
    });
    setVisible(false);
  };

  const handleSaveCustom = () => {
    saveCookiePreferences({
      essential: true,
      functional: functionalAllowed,
      analytics: analyticsAllowed,
    });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Privacy & Cookie Preferences"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-card/95 backdrop-blur-md border border-primary/25 rounded-2xl p-5 shadow-2xl text-foreground">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-foreground">Privacy &amp; Cookie Preferences</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              We use necessary cookies for secure authentication and session management. Optional analytics help us enhance consultation reliability. Read our{" "}
              <a href="/privacy" className="text-primary hover:underline underline-offset-2">
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <button
            onClick={handleRejectNonEssential}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            aria-label="Close and use essential cookies only"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 pt-3 border-t border-border/80 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Essential Cookies</p>
                <p className="text-muted-foreground text-[11px]">Required for login, meetings &amp; bookings.</p>
              </div>
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">Always On</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Functional Preferences</p>
                <p className="text-muted-foreground text-[11px]">Preserves currency, language &amp; theme.</p>
              </div>
              <input
                type="checkbox"
                checked={functionalAllowed}
                onChange={(e) => setFunctionalAllowed(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
                aria-label="Allow functional preferences"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Performance &amp; Diagnostics</p>
                <p className="text-muted-foreground text-[11px]">Helps detect video connection errors.</p>
              </div>
              <input
                type="checkbox"
                checked={analyticsAllowed}
                onChange={(e) => setAnalyticsAllowed(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
                aria-label="Allow performance analytics"
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 font-medium"
          >
            {showDetails ? "Hide options" : "Customize choices"}
          </button>

          <div className="flex items-center gap-2">
            {showDetails ? (
              <Button size="sm" variant="default" onClick={handleSaveCustom} className="text-xs h-8 px-3">
                <Check className="w-3.5 h-3.5 mr-1" /> Save Preferences
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRejectNonEssential}
                  className="text-xs h-8 px-3 border-border hover:bg-secondary/40"
                >
                  Essential Only
                </Button>
                <Button size="sm" variant="default" onClick={handleAcceptAll} className="text-xs h-8 px-3">
                  Accept All
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Compass, Home, Search, HelpCircle, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEO
        title="404: Page Not Found | foundarly"
        description="The page you are looking for does not exist or has been moved."
        noindex={true}
      />
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-foreground selection:bg-primary/20">
        <div className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center">
          {/* Subtle Glow Background */}
          <div className="absolute -top-12 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl filter" />

          {/* Badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Compass className="h-3.5 w-3.5" /> Error 404
          </div>

          <h1 className="font-display text-6xl font-bold tracking-tight text-foreground sm:text-7xl">
            Page Not Found
          </h1>

          <p className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
            The page at <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary font-mono">{location.pathname}</code> doesn&apos;t exist, was removed, or is temporarily unavailable.
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="default" className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" /> Return to Directory
              </Link>
            </Button>
            <Button asChild variant="outline" size="default" className="gap-2">
              <Link to="/consultants">
                <Search className="h-4 w-4" /> Find a Consultant
              </Link>
            </Button>
          </div>

          {/* Secondary Helpful Links */}
          <div className="mt-12 w-full border-t border-border/60 pt-6">
            <p className="text-xs font-medium text-muted-foreground">Looking for something else?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs">
              <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">
                Pricing &amp; Plans
              </Link>
              <span className="text-border">•</span>
              <Link to="/faqs" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                <HelpCircle className="h-3 w-3" /> FAQs &amp; Help
              </Link>
              <span className="text-border">•</span>
              <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                About Foundarly
              </Link>
              <span className="text-border">•</span>
              <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;

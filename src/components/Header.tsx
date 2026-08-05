import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  User,
  Calendar,
  ShieldCheck,
  Briefcase,
  Settings,
  ChevronDown,
  Sparkles,
  Youtube,
  Instagram,
  PlayCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { settingsService } from "@/services/settings";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", path: "/home" },
  { label: "Experts", path: "/" },
  { label: "Network", path: "/network" },
  { label: "Pricing", path: "/pricing" },
  { label: "Our Story", path: "/about" },
  { label: "Blog", path: "/blog" },
  { label: "FAQs", path: "/faqs" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoText, setLogoText] = useState("Foundarly");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location]);

  useEffect(() => {
    loadLogo();
  }, []);

  const loadLogo = async () => {
    try {
      const settings = await settingsService.getAll();
      const logoTextSetting = settings.find((s) => s.setting_key === "site_logo_text");
      const logoUrlSetting = settings.find((s) => s.setting_key === "site_logo_url");

      if (logoTextSetting?.setting_value) setLogoText(logoTextSetting.setting_value);
      if (logoUrlSetting?.setting_value) setLogoUrl(logoUrlSetting.setting_value);
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/consultants";
    }
    if (path === "/home") {
      return location.pathname === "/home";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const getInitials = () => {
    try {
      const name = profile?.full_name || user?.user_metadata?.full_name;
      if (name && typeof name === "string" && name.trim().length > 0) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
          return parts
            .map((p) => p[0])
            .filter(Boolean)
            .join("")
            .toUpperCase()
            .slice(0, 2);
        }
      }
      if (user?.email && typeof user.email === "string" && user.email.length > 0) {
        return user.email.charAt(0).toUpperCase();
      }
    } catch (e) {
      console.error("Error calculating initials in Header:", e);
    }
    return "U";
  };

  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);
  const isClientRole = !isAdminRole && !isConsultantRole;

  return (
    <header
      className={cn(
        "sticky top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-background/85 backdrop-blur-xl border-border/60 shadow-lg shadow-black/5 py-2.5"
          : "bg-background/60 backdrop-blur-md border-border/30 py-3.5"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          {logoUrl ? (
            <img src={logoUrl} alt={logoText} className="h-8 w-auto object-contain" />
          ) : (
            <span className="font-display text-2xl font-bold tracking-tight text-gradient-gold group-hover:opacity-90 transition-opacity">
              {logoText}
            </span>
          )}
        </Link>

        {/* Centered Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 bg-secondary/40 border border-border/40 p-1 rounded-full backdrop-blur-md">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "relative px-2.5 xl:px-3.5 py-1 text-xs xl:text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-full",
                  active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="navbar-active-pill"
                    className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-full z-0"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Area */}
        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2.5 shrink-0">
          {/* Grouped Social & Intro Video Pill */}
          <div className="flex items-center gap-0.5 bg-secondary/50 border border-border/60 p-0.5 rounded-full">
            <a
              href="https://youtube.com/@foundarly?si=ZHlc2Swj3Rtm37Kn"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              title="Foundarly YouTube Channel"
              className="p-1.5 text-muted-foreground hover:text-red-500 hover:scale-110 transition-all rounded-full hover:bg-background"
            >
              <Youtube className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://www.instagram.com/foundarlybusinessworld_in?utm_source=qr&igsh=dmVxNm8wNW93aHV5"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              title="Foundarly Instagram"
              className="p-1.5 text-muted-foreground hover:text-pink-500 hover:scale-110 transition-all rounded-full hover:bg-background"
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://youtu.be/L2ndHKr9Q5Y?si=TE35364lR-3dY94F"
              target="_blank"
              rel="noopener noreferrer"
              title="Watch Intro Video"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline font-semibold">Intro Video</span>
            </a>
          </div>

          {isClientRole && (
            <Link to="/apply-consultant">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-full px-2.5 xl:px-3 h-8"
              >
                <span className="hidden xl:inline">Become a Consultant</span>
                <span className="inline xl:hidden">Apply</span>
              </Button>
            </Link>
          )}

          {!user && (
            <Link to="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-full px-2.5 xl:px-3 h-8"
              >
                Sign In
              </Button>
            </Link>
          )}

          {/* Primary CTA - Role based */}
          {isAdminRole ? (
            <Link to="/admin">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs xl:text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-full px-4 xl:px-5 py-2"
              >
                Admin Dashboard
              </Button>
            </Link>
          ) : isConsultantRole ? (
            <Link to="/consultant/dashboard">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs xl:text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-full px-4 xl:px-5 py-2"
              >
                Consultant Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/booking">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs xl:text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-full px-4 xl:px-5 py-2"
              >
                Book a Session
              </Button>
            </Link>
          )}

          {/* Authenticated User Profile Dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/50 transition-all p-0 overflow-hidden focus-visible:ring-primary"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={profile?.avatar_url || user.user_metadata?.avatar_url}
                      alt={profile?.full_name || "User"}
                    />
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mt-2 rounded-2xl p-2 border-border/80 shadow-xl backdrop-blur-xl" align="end">
                <DropdownMenuLabel className="font-normal px-2 py-2">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold leading-none text-foreground truncate">
                        {profile?.full_name || "User Account"}
                      </p>
                      {isAdminRole ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                          Admin
                        </span>
                      ) : isConsultantRole ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                          Consultant
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 bg-border/60" />

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => navigate(isAdminRole ? "/admin" : isConsultantRole ? "/consultant/dashboard" : "/my-bookings")}
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium focus:bg-primary/10 focus:text-primary transition-colors"
                  >
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>My Profile</span>
                  </DropdownMenuItem>

                  {isClientRole && (
                    <DropdownMenuItem
                      onClick={() => navigate("/my-bookings")}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium focus:bg-primary/10 focus:text-primary transition-colors"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>My Bookings</span>
                    </DropdownMenuItem>
                  )}

                  {isConsultantRole && (
                    <DropdownMenuItem
                      onClick={() => navigate("/consultant/dashboard")}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-primary focus:bg-primary/10 focus:text-primary transition-colors"
                    >
                      <Briefcase className="mr-2 h-4 w-4 text-primary" />
                      <span>Consultant Dashboard</span>
                    </DropdownMenuItem>
                  )}

                  {isAdminRole && (
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-primary focus:bg-primary/10 focus:text-primary transition-colors"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                      <span>Admin Dashboard</span>
                    </DropdownMenuItem>
                  )}

                  {isClientRole && (
                    <DropdownMenuItem
                      onClick={() => navigate("/apply-consultant")}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium focus:bg-primary/10 focus:text-primary transition-colors"
                    >
                      <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Become a Consultant</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => navigate(isAdminRole ? "/admin/settings" : isConsultantRole ? "/consultant/dashboard" : "/my-bookings")}
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium focus:bg-primary/10 focus:text-primary transition-colors"
                  >
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-1 bg-border/60" />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mobile Header Right Actions */}
        <div className="flex lg:hidden items-center gap-2">
          {isAdminRole ? (
            <Link to="/admin">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full px-3 py-1.5 font-semibold">
                Admin
              </Button>
            </Link>
          ) : isConsultantRole ? (
            <Link to="/consultant/dashboard">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full px-3 py-1.5 font-semibold">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/booking">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full px-3 py-1.5 font-semibold">
                Book
              </Button>
            </Link>
          )}

          <button
            className="p-2 text-foreground rounded-full hover:bg-secondary/80 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="lg:hidden bg-background/95 backdrop-blur-2xl border-b border-border/80 overflow-hidden shadow-2xl"
          >
            <nav className="flex flex-col p-5 gap-1.5">
              {navLinks.map((link) => {
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "flex items-center justify-between text-sm py-2.5 px-3 rounded-xl font-medium transition-colors",
                      active
                        ? "bg-primary/15 text-primary font-semibold border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <span>{link.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}

              <div className="mt-3 pt-3 border-t border-border/60 flex flex-col gap-2">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2 bg-secondary/30 rounded-xl mb-1">
                      <Avatar className="h-9 w-9 border border-primary/20">
                        <AvatarImage
                          src={profile?.avatar_url || user.user_metadata?.avatar_url}
                          alt={profile?.full_name || "User"}
                        />
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {profile?.full_name || "User Account"}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </div>
                    </div>

                    {isClientRole && (
                      <Link
                        to="/my-bookings"
                        className="flex items-center gap-2 text-xs py-2 px-3 font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Calendar className="h-4 w-4" />
                        <span>My Bookings</span>
                      </Link>
                    )}

                    {isConsultantRole && (
                      <Link
                        to="/consultant/dashboard"
                        className="flex items-center gap-2 text-xs py-2 px-3 font-semibold text-primary"
                      >
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span>Consultant Dashboard</span>
                      </Link>
                    )}

                    {isAdminRole && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 text-xs py-2 px-3 font-semibold text-primary"
                      >
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}

                    {isClientRole && (
                      <Link
                        to="/apply-consultant"
                        className="flex items-center gap-2 text-xs py-2 px-3 font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Briefcase className="h-4 w-4" />
                        <span>Become a Consultant</span>
                      </Link>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                      className="w-full mt-2 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                    >
                      <LogOut className="mr-2 h-3.5 w-3.5" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs rounded-full">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/apply-consultant" className="w-full">
                      <Button variant="ghost" size="sm" className="w-full text-xs rounded-full text-primary">
                        Become a Consultant
                      </Button>
                    </Link>
                  </>
                )}

                {isAdminRole ? (
                  <Link to="/admin" className="w-full mt-1">
                    <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-full py-2.5">
                      Admin Dashboard
                    </Button>
                  </Link>
                ) : isConsultantRole ? (
                  <Link to="/consultant/dashboard" className="w-full mt-1">
                    <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-full py-2.5">
                      Consultant Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link to="/booking" className="w-full mt-1">
                    <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-full py-2.5">
                      Book a Session
                    </Button>
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}


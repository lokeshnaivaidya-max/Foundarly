import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { consultantsService } from "@/services/consultants";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorksModal from "@/components/HowItWorksModal";
import { PageLoader } from "@/components/PageLoader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  GraduationCap,
  Briefcase,
  Clock,
  Globe2,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Star,
  ArrowLeft,
  Share2,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Globe,
  Tag,
  Zap,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export default function ConsultantProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { profile, isAdmin } = useAuth();
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(60);

  const { data: consultant, isLoading, error } = useQuery({
    queryKey: ["consultant", id],
    queryFn: () => (id ? consultantsService.getById(id) : null),
    enabled: !!id,
  });

  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);
  const isClientRole = !isAdminRole && !isConsultantRole;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${consultant?.name} - Foundarly Consultant`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Profile link copied to clipboard!");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "C";
    return name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center py-20">
          <PageLoader text="Loading consultant profile..." />
        </div>
        <Footer />
      </div>
    );
  }

  if (!consultant) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-6 py-24 text-center max-w-lg">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
            <Briefcase className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Consultant Not Found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            The profile you are looking for does not exist or has been removed.
          </p>
          <Link to="/consultants">
            <Button className="glow-gold-sm">Back to All Experts</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const socialLinks = consultant.social_links as any || {};
  const categoriesList = consultant.categories || [];
  const languagesList = consultant.languages || ['English', 'Hindi'];
  const price = selectedDuration === 30 ? (consultant.pricing_30 || consultant.pricing_60) : consultant.pricing_60;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* Hero / Header Banner */}
      <section className="relative pt-28 pb-12 bg-gradient-hero border-b border-border/60 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[350px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-[300px] h-[200px] bg-amber-400/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
          {/* Top Breadcrumb & Actions */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-secondary/50 px-3.5 py-1.5 rounded-full border border-border/60"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Experts</span>
            </button>

            <div className="flex items-center gap-2">
              <HowItWorksModal showText buttonText="How booking works" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="rounded-full text-xs gap-1.5 border-border hover:border-primary/50"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </div>

          {/* Profile Card Header */}
          <div className="bg-gradient-card border border-border rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden">
            {/* Top gold bar accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-amber-400 to-primary/40" />

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8">
              {/* Profile Avatar */}
              <div className="relative group shrink-0">
                <Avatar className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-primary/30 shadow-2xl shadow-primary/10 overflow-hidden">
                  <AvatarImage
                    src={consultant.image_url || undefined}
                    alt={consultant.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">
                    {getInitials(consultant.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full border border-background shadow">
                  VERIFIED
                </div>
              </div>

              {/* Title & Info */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                    {consultant.name}
                  </h1>
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verified Consultant
                  </Badge>
                  {consultant.gender && (
                    <Badge variant="outline" className="capitalize text-xs rounded-full">
                      {consultant.gender}
                    </Badge>
                  )}
                </div>

                <p className="text-base sm:text-lg font-medium text-gradient-gold">
                  {consultant.title}
                </p>

                {/* Quick Meta Stats */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-muted-foreground pt-1">
                  {consultant.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      {consultant.location}
                    </span>
                  )}
                  {consultant.qualification && (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                      {consultant.qualification}
                    </span>
                  )}
                  {consultant.experience && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" />
                      {consultant.experience}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    4.9 (50+ Sessions)
                  </span>
                </div>

                {/* Category Badges */}
                {categoriesList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {categoriesList.map((cat: string) => (
                      <span
                        key={cat}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3" />
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Booking Summary CTA Box */}
              <div className="w-full md:w-auto shrink-0 bg-secondary/50 border border-border p-5 rounded-2xl flex flex-col items-center md:items-end justify-center text-center md:text-right gap-3">
                <div>
                  <span className="text-xs text-muted-foreground block">Session Rate</span>
                  <span className="font-display text-2xl font-bold text-foreground">
                    {formatPrice(price)}
                  </span>
                  <span className="text-xs text-muted-foreground block">/ {selectedDuration} mins</span>
                </div>

                {isClientRole ? (
                  <Button
                    onClick={() => navigate(`/booking?consultant=${consultant.id}`)}
                    className="w-full md:w-auto glow-gold-sm font-semibold px-6 py-2.5 rounded-full text-xs"
                  >
                    Book Session Now
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate(`/booking?consultant=${consultant.id}`)}
                    className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2.5 rounded-full text-xs"
                  >
                    Schedule Consultation
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile Details Main Body */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left 2 Columns: Bio, Expertise, Details */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* About / Biography Glass Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-card border border-border rounded-3xl p-6 sm:p-8 space-y-4"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-border/80">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-xl font-bold text-foreground">About {consultant.name}</h2>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                  {consultant.bio}
                </p>
              </motion.div>

              {/* Areas of Expertise */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-card border border-border rounded-3xl p-6 sm:p-8 space-y-4"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-border/80">
                  <Zap className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-xl font-bold text-foreground">Core Expertise & Capabilities</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {consultant.expertise?.map((skill: string) => (
                    <div
                      key={skill}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/40 border border-border/60 text-sm font-medium text-foreground hover:border-primary/40 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Professional Credentials & Info Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-card border border-border rounded-3xl p-6 sm:p-8 space-y-5"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-border/80">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-xl font-bold text-foreground">Consultation Specifications</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" /> Qualification
                    </span>
                    <p className="font-semibold text-foreground">{consultant.qualification || "Industry Verified"}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary" /> Overall Experience
                    </span>
                    <p className="font-semibold text-foreground">{consultant.experience || "10+ Years"}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-primary" /> Languages Spoken
                    </span>
                    <p className="font-semibold text-foreground">{languagesList.join(", ")}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" /> Preferred Session Hours
                    </span>
                    <p className="font-semibold text-foreground">{consultant.preferred_time || "Mon - Sat (10 AM - 6 PM IST)"}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> Current Availability
                    </span>
                    <p className="font-semibold text-primary">{consultant.availability || "Available for booking"}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" /> Location Base
                    </span>
                    <p className="font-semibold text-foreground">{consultant.location || "India"}</p>
                  </div>
                </div>
              </motion.div>

              {/* Dedicated Preferred Consultation Time Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gradient-card border border-primary/20 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm"
              >
                <div className="flex items-center gap-3 pb-3 border-b border-border/80">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">Preferred Consultation Time</h2>
                    <p className="text-xs text-muted-foreground">Optimal window for scheduling direct sessions with this expert</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary font-semibold text-sm">
                      {consultant.preferred_time || "Morning (9:00 AM – 12:00 PM IST)"}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs py-1 px-3">
                    {consultant.availability || "Flexible Slots Available"}
                  </Badge>
                </div>
              </motion.div>

            </div>

            {/* Right Column: Booking Widget & Social Links */}
            <div className="space-y-6">
              
              {/* Sticky Booking Widget */}
              <div className="bg-gradient-card border border-primary/30 rounded-3xl p-6 shadow-xl sticky top-24 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="font-display font-bold text-lg text-foreground">Book Session</h3>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                    Instant Slot
                  </Badge>
                </div>

                {/* Duration Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Choose Session Duration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDuration(30)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        selectedDuration === 30
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow"
                          : "bg-secondary/60 border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <div className="text-sm font-semibold">30 Mins</div>
                      <div className="text-xs opacity-90 mt-0.5">{formatPrice(consultant.pricing_30 || consultant.pricing_60)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDuration(60)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        selectedDuration === 60
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow"
                          : "bg-secondary/60 border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <div className="text-sm font-semibold">60 Mins</div>
                      <div className="text-xs opacity-90 mt-0.5">{formatPrice(consultant.pricing_60)}</div>
                    </button>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="bg-secondary/40 border border-border/80 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Consultation Fee</span>
                    <span className="font-medium text-foreground">{formatPrice(price)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Platform Service</span>
                    <span className="text-green-500 font-medium">Included</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border/60">
                    <span>Total Payable</span>
                    <span className="text-primary text-base">{formatPrice(price)}</span>
                  </div>
                </div>

                {/* Action CTA */}
                <Button
                  onClick={() => navigate(`/booking?consultant=${consultant.id}&duration=${selectedDuration}`)}
                  className="w-full glow-gold py-6 text-sm font-bold rounded-2xl"
                >
                  Proceed to Book Session
                </Button>

                <p className="text-[10px] text-center text-muted-foreground">
                  🔒 100% Secure encrypted transaction & summary report guaranteed.
                </p>

                {/* Social Links Section */}
                {(socialLinks.linkedin || socialLinks.twitter || socialLinks.instagram || socialLinks.youtube || socialLinks.website) && (
                  <div className="pt-4 border-t border-border/80 space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Social & Online Handles
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {socialLinks.linkedin && (
                        <a
                          href={socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-secondary/80 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                          aria-label="LinkedIn"
                        >
                          <Linkedin size={16} />
                        </a>
                      )}
                      {socialLinks.instagram && (
                        <a
                          href={socialLinks.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-secondary/80 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                          aria-label="Instagram"
                        >
                          <Instagram size={16} />
                        </a>
                      )}
                      {socialLinks.youtube && (
                        <a
                          href={socialLinks.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-secondary/80 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                          aria-label="YouTube"
                        >
                          <Youtube size={16} />
                        </a>
                      )}
                      {socialLinks.twitter && (
                        <a
                          href={socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-secondary/80 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                          aria-label="Twitter"
                        >
                          <Twitter size={16} />
                        </a>
                      )}
                      {socialLinks.website && (
                        <a
                          href={socialLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-secondary/80 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                          aria-label="Website"
                        >
                          <Globe size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

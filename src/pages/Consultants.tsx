import { useRef, useState } from "react";
import { motion, useInView, useMotionValue, useTransform } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorksModal from "@/components/HowItWorksModal";
import { SkeletonGrid } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consultantsService } from "@/services/consultants";
import { OFFICIAL_CATEGORIES, categoriesService } from "@/services/categories";
import { useCurrency } from "@/contexts/CurrencyContext";
import { BadgeCheck, Zap, Star, Search, Tag, MapPin, Briefcase, ArrowRight, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function Particle({ x, y, size, delay, dur }: { x: string; y: string; size: number; delay: number; dur: number }) {
  return (
    <motion.div className="absolute rounded-full bg-primary/25 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -20, 0], opacity: [0.1, 0.45, 0.1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }} />
  );
}

const PARTICLES = [
  { x: "6%",  y: "20%", size: 5, delay: 0,   dur: 5   },
  { x: "90%", y: "15%", size: 4, delay: 1.2, dur: 6   },
  { x: "80%", y: "65%", size: 6, delay: 2,   dur: 7   },
  { x: "10%", y: "70%", size: 4, delay: 0.6, dur: 5.5 },
  { x: "50%", y: "5%",  size: 3, delay: 1.8, dur: 6.5 },
];

function ConsultantCard({ c, index }: { c: any; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const { formatPrice } = useCurrency();
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);
  const isClientRole = !isAdminRole && !isConsultantRole;

  const getInitials = (name: string) => {
    if (!name) return "C";
    return name.split(" ").map(p => p[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -8, transition: { duration: 0.25 } }}
      onClick={() => navigate(`/consultants/${c.id}`)}
      className="group relative bg-gradient-card border border-border rounded-3xl p-6 overflow-hidden cursor-pointer flex flex-col justify-between hover:border-primary/50 transition-all duration-300"
      style={{ boxShadow: "0 4px 24px -8px hsl(45 100% 50% / 0.06)" }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(45 100% 50% / 0.09) 0%, transparent 70%)" }} />
      {/* Top accent line */}
      <motion.div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-primary to-amber-400 rounded-t-3xl"
        initial={{ width: 0 }} animate={inView ? { width: "70%" } : {}}
        transition={{ duration: 0.7, delay: (index % 3) * 0.1 + 0.3 }} />

      <div>
        {/* Header Avatar + Name + Verified Badge */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="w-14 h-14 rounded-2xl border-2 border-primary/20 shadow-md overflow-hidden shrink-0 group-hover:border-primary transition-colors">
            <AvatarImage src={c.image_url || undefined} alt={c.name} className="object-cover" />
            <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
              {getInitials(c.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-200 truncate">
                {c.name}
              </h3>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold shrink-0">
                <BadgeCheck className="h-3 w-3 text-primary" />
                <span>Verified</span>
              </div>
            </div>

            <p className="text-xs text-gradient-gold font-medium mt-0.5 truncate">{c.title}</p>
            
            {c.location && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                {c.location}
              </p>
            )}
          </div>
        </div>

        {/* Categories / Expertise badges */}
        {((c.categories && c.categories.length > 0) || (c.expertise && c.expertise.length > 0)) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(c.categories && c.categories.length > 0 ? c.categories : c.expertise).slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">{c.bio}</p>
      </div>

      {/* Price + Profile Link + CTA */}
      <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-auto">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">From</p>
          <p className="font-display font-bold text-foreground text-base">
            {formatPrice(c.pricing_60)}
            <span className="text-[11px] text-muted-foreground font-normal"> / hr</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs rounded-full border-border hover:border-primary hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/consultants/${c.id}`);
            }}
          >
            <User className="w-3 h-3 mr-1" />
            Profile
          </Button>

          {isClientRole && (
            <Button
              size="sm"
              className="glow-gold-sm text-xs rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/booking?consultant=${c.id}`);
              }}
            >
              Book
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ConsultantsPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [4, -4]);
  const rotateY = useTransform(mouseX, [-300, 300], [-4, 4]);

  const { data: consultants, isLoading } = useQuery({
    queryKey: ["consultants", "active"],
    queryFn: () => consultantsService.getAll(true),
  });

  const { data: dbCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll(),
  });

  const categories = ["All", ...Array.from(new Set([
    ...(dbCategories?.map(c => c.name) || []),
    ...OFFICIAL_CATEGORIES
  ]))];

  const filtered = consultants?.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    const targetCat = selectedCategory.toLowerCase();

    // Search query filter
    const matchesSearch = !query || 
      (c.name || "").toLowerCase().includes(query) ||
      (c.title || "").toLowerCase().includes(query) ||
      (c.bio || "").toLowerCase().includes(query) ||
      (Array.isArray(c.expertise) && c.expertise.some(exp => exp.toLowerCase().includes(query))) ||
      (Array.isArray(c.categories) && c.categories.some(cat => cat.toLowerCase().includes(query)));

    // Category filter
    const matchesCategory = selectedCategory === "All" ||
      (Array.isArray(c.categories) && c.categories.some(cat => 
        cat.toLowerCase() === targetCat || 
        cat.toLowerCase().includes(targetCat) || 
        targetCat.includes(cat.toLowerCase())
      )) ||
      (Array.isArray(c.expertise) && c.expertise.some(exp => 
        exp.toLowerCase() === targetCat || 
        exp.toLowerCase().includes(targetCat) || 
        targetCat.includes(exp.toLowerCase())
      )) ||
      (c.title || "").toLowerCase().includes(targetCat) ||
      (c.bio || "").toLowerCase().includes(targetCat);

    return matchesSearch && matchesCategory;
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true });

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* ── Hero ── */}
      <section
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative pt-36 pb-20 bg-gradient-hero overflow-hidden"
      >
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
        {[320, 500, 680].map((s, i) => (
          <motion.div key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 pointer-events-none"
            style={{ width: s, height: s }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.15 - i * 0.04, 0.05, 0.15 - i * 0.04] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }} />
        ))}
        {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

        <div className="container mx-auto px-6 text-center relative z-10 max-w-4xl">
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/8 mb-7"
            initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">Industry Specialists</span>
          </motion.div>

          <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
            <motion.h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}>
              Explore Verified{" "}
              <span className="relative inline-block">
                <span className="text-gradient-gold">Consultants</span>
                <motion.div className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-amber-400"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h1>
          </motion.div>

          <motion.p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
            Direct 1-on-1 access to vetted leaders across 29 business sectors.
          </motion.p>

          {/* Search Box */}
          <motion.div className="mt-8 max-w-md mx-auto relative"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, category, or industry skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-6 bg-gradient-card border-border focus:border-primary rounded-full text-sm shadow-xl"
            />
          </motion.div>

          {/* How process works modal link */}
          <motion.div className="mt-6 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <span className="text-xs text-muted-foreground">New to Foundarly?</span>
            <HowItWorksModal showText buttonText="How booking works" />
          </motion.div>
        </div>
      </section>

      {/* ── Filter + Grid ── */}
      <section className="py-12 bg-background relative">
        <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-7xl">

          {/* Category Filter Pills (Scrollable) */}
          <motion.div ref={headerRef} className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar scroll-smooth"
            initial={{ opacity: 0, y: 20 }} animate={headerInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
            <span className="text-xs font-semibold text-muted-foreground shrink-0 uppercase tracking-wider mr-2">
              Filter Industry:
            </span>
            {categories.map((cat, i) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary shadow-sm glow-gold-sm font-semibold"
                    : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>

          {/* Grid or Empty */}
          {isLoading ? (
            <SkeletonGrid count={6} cols={3} avatar={true} />
          ) : filtered && filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((c, i) => <ConsultantCard key={c.id} c={c} index={i} />)}
            </div>
          ) : (
            <div className="text-center py-20 bg-secondary/20 border border-border/80 rounded-3xl max-w-md mx-auto">
              <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-bold text-lg text-foreground mb-1">No Consultants Found</h3>
              <p className="text-xs text-muted-foreground mb-4">
                No experts matched your search query or selected category.
              </p>
              <Button size="sm" variant="outline" onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}>
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

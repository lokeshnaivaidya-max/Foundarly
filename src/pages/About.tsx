import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, useInView, useScroll, useSpring } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Search, UserCheck, CalendarCheck, Video, FileText, Star, ArrowRight, Zap, Shield, Users, TrendingUp } from "lucide-react";

// ── Floating particle ─────────────────────────────────────────────────────────
function Particle({ x, y, size, delay, dur }: { x: string; y: string; size: number; delay: number; dur: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-primary/30 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -24, 0], opacity: [0.15, 0.5, 0.15], scale: [1, 1.4, 1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Animated SVG ring ─────────────────────────────────────────────────────────
function Ring({ size, opacity, delay, speed = 5 }: { size: number; opacity: number; delay: number; speed?: number }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 pointer-events-none"
      style={{ width: size, height: size }}
      animate={{ scale: [1, 1.06, 1], opacity: [opacity, opacity * 0.4, opacity] }}
      transition={{ duration: speed, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

const PARTICLES = [
  { x: "8%",  y: "18%", size: 5,  delay: 0,   dur: 5   },
  { x: "88%", y: "12%", size: 4,  delay: 1.2, dur: 6   },
  { x: "78%", y: "68%", size: 7,  delay: 2,   dur: 7   },
  { x: "12%", y: "72%", size: 4,  delay: 0.6, dur: 5.5 },
  { x: "52%", y: "8%",  size: 3,  delay: 1.8, dur: 6.5 },
  { x: "92%", y: "48%", size: 5,  delay: 3,   dur: 4.5 },
  { x: "4%",  y: "48%", size: 3,  delay: 2.5, dur: 7   },
  { x: "62%", y: "88%", size: 4,  delay: 0.9, dur: 5.8 },
];

const STATS = [
  { icon: Users,      value: "500+",  label: "Founders Served"    },
  { icon: Shield,     value: "100%",  label: "Verified Experts"   },
  { icon: TrendingUp, value: "4.9★",  label: "Average Rating"     },
  { icon: Zap,        value: "1-on-1",label: "Private Sessions"   },
];

const storyParagraphs = [
  {
    text: "Foundarly was born from a simple observation: the most transformative conversations in a founder's journey happen one-on-one, behind closed doors, with someone who's been there before.",
    highlight: false,
  },
  {
    text: "We saw a gap in the market — not for another marketplace of generic advice, but for a curated, premium environment where ambitious professionals could access real expertise from verified leaders.",
    highlight: false,
  },
  {
    text: "Every consultant on Foundarly is handpicked. Every session is private. Every interaction is designed to deliver clarity, strategy, and forward momentum.",
    highlight: false,
  },
  {
    text: "We believe that the right conversation at the right time can change everything. That's the experience we're committed to delivering — one session at a time.",
    highlight: true,
  },
];

// ── Steps data ────────────────────────────────────────────────────────────────
const steps = [
  { icon: Search,       number: "01", title: "Discover Your Expert",    desc: "Browse our curated roster of verified consultants. Filter by industry, expertise, and availability to find the perfect match for your challenge.", color: "from-amber-400 to-yellow-500", shadow: "shadow-amber-400/30" },
  { icon: UserCheck,    number: "02", title: "Review Their Profile",     desc: "Explore each consultant's background, qualifications, and session pricing. Every profile is handpicked and verified by the Foundarly team.", color: "from-yellow-500 to-orange-400", shadow: "shadow-yellow-400/30" },
  { icon: CalendarCheck,number: "03", title: "Book & Pay Securely",      desc: "Choose your session duration — 30 or 60 minutes — pick a date and time, and complete your secure payment through the platform.", color: "from-orange-400 to-amber-500", shadow: "shadow-orange-400/30" },
  { icon: Video,        number: "04", title: "Attend Your Session",      desc: "Join your private one-on-one consultation. Come prepared with your goals — your consultant will guide you with clarity and strategy.", color: "from-amber-500 to-yellow-400", shadow: "shadow-amber-500/30" },
  { icon: FileText,     number: "05", title: "Receive Your Summary",     desc: "After every session, your consultant delivers a personalised PDF report outlining the advice, action points, and recommendations discussed.", color: "from-yellow-400 to-amber-400", shadow: "shadow-yellow-500/30" },
  { icon: Star,         number: "06", title: "Leave Your Feedback",      desc: "Share your experience. Your review helps the community and ensures every consultant on Foundarly maintains the highest standard of excellence.", color: "from-amber-400 to-yellow-500", shadow: "shadow-amber-400/30" },
];

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = step.icon;

  return (
    <motion.div
      ref={ref}
      className="relative flex items-start gap-5 md:gap-8"
      initial={{ opacity: 0, x: -40 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Connector line */}
      {index < steps.length - 1 && (
        <motion.div
          className="absolute left-[2.1rem] md:left-[2.6rem] top-[5rem] w-0.5 h-16 md:h-20"
          style={{ background: "linear-gradient(180deg, hsl(45 100% 50% / 0.5), hsl(45 100% 50% / 0.04))" }}
          initial={{ scaleY: 0, originY: 0 }}
          animate={inView ? { scaleY: 1 } : {}}
          transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
        />
      )}

      {/* Icon bubble */}
      <motion.div
        className={`relative z-10 flex-shrink-0 w-[4.2rem] h-[4.2rem] md:w-[5.2rem] md:h-[5.2rem] rounded-2xl bg-gradient-to-br ${step.color} flex flex-col items-center justify-center shadow-xl ${step.shadow}`}
        style={{ boxShadow: `0 16px 36px -8px hsl(45 100% 50% / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.3)` }}
        whileHover={{ scale: 1.1, rotate: -4 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Icon className="h-5 w-5 md:h-6 md:w-6 text-white drop-shadow" />
        <span className="text-[10px] font-bold text-white/80 mt-0.5">{step.number}</span>
      </motion.div>

      {/* Card */}
      <motion.div
        className="flex-1 bg-gradient-card border border-border rounded-2xl p-5 md:p-7 group cursor-default"
        whileHover={{ y: -4, boxShadow: "0 20px 48px -12px hsl(45 100% 50% / 0.18)", borderColor: "hsl(45 100% 50% / 0.4)" }}
        transition={{ duration: 0.25 }}
      >
        <h3 className="font-display text-lg md:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-200">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
      </motion.div>
    </motion.div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
  const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[92vh] flex items-center justify-center bg-gradient-hero overflow-hidden"
    >
      {/* Grain overlay */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />

      {/* Radial gold glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/6 blur-[140px]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/4 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-amber-400/5 blur-[80px]" />
      </div>

      {/* Animated rings */}
      <Ring size={360} opacity={0.18} delay={0} speed={5} />
      <Ring size={560} opacity={0.10} delay={1} speed={6} />
      <Ring size={760} opacity={0.06} delay={2} speed={7} />
      <Ring size={960} opacity={0.03} delay={3} speed={8} />

      {/* Floating particles */}
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      {/* Rotating SVG — top right */}
      <motion.svg className="absolute top-16 right-10 md:right-24 opacity-[0.12] pointer-events-none"
        width="200" height="200" viewBox="0 0 200 200"
        animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }}>
        <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1" strokeDasharray="10 7" />
        <circle cx="100" cy="100" r="65" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.6" strokeDasharray="5 10" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.4" strokeDasharray="3 12" />
      </motion.svg>

      {/* Rotating SVG — bottom left */}
      <motion.svg className="absolute bottom-20 left-8 md:left-20 opacity-[0.10] pointer-events-none"
        width="140" height="140" viewBox="0 0 140 140"
        animate={{ rotate: -360 }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }}>
        <polygon points="70,6 134,106 6,106" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1.2" />
        <polygon points="70,28 112,96 28,96" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.6" />
      </motion.svg>

      {/* Decorative diamond — top left */}
      <motion.svg className="absolute top-32 left-12 opacity-[0.08] pointer-events-none"
        width="80" height="80" viewBox="0 0 80 80"
        animate={{ rotate: [0, 45, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}>
        <rect x="20" y="20" width="40" height="40" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1.5" />
        <rect x="30" y="30" width="20" height="20" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.8" />
      </motion.svg>

      {/* Content */}
      <div className="container mx-auto px-6 text-center relative z-10 pt-20">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/8 mb-8"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">Our Story</span>
        </motion.div>

        {/* Headline with 3D tilt */}
        <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
          <motion.h1
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          >
            The Vision{" "}
            <span className="relative inline-block">
              <span className="text-gradient-gold">Behind</span>
              {/* Underline accent */}
              <motion.div
                className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-amber-400"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 1.1 }}
              />
            </span>
            <br />
            <span className="text-gradient-gold">Foundarly</span>
          </motion.h1>
        </motion.div>

        {/* Subtext */}
        <motion.p
          className="mt-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
        >
          By the Founders. For the Founders.
        </motion.p>

        {/* Scroll cue */}
        <motion.div
          className="mt-14 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <span className="text-xs text-muted-foreground/60 tracking-widest uppercase">Scroll to explore</span>
          <motion.div
            className="w-5 h-8 rounded-full border border-primary/30 flex items-start justify-center pt-1.5"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className="w-1 h-2 rounded-full bg-primary"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Story Section ─────────────────────────────────────────────────────────────
function StorySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const ySpring = useSpring(y, { stiffness: 80, damping: 20 });

  return (
    <section className="py-28 relative overflow-hidden bg-gradient-dark">
      {/* Background SVG grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid-about" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-about)" />
        </svg>
      </div>

      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-400/4 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        {/* Section label */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          ref={ref}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/6 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">Our Mission</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold">
            Why We Built <span className="text-gradient-gold">Foundarly</span>
          </h2>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-10 items-start">

          {/* Left — story paragraphs */}
          <div className="space-y-6">
            {storyParagraphs.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.12 }}
                className="relative pl-5"
              >
                {/* Left accent bar */}
                <motion.div
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary to-amber-400/30"
                  initial={{ scaleY: 0, originY: 0 }}
                  animate={inView ? { scaleY: 1 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
                />
                <p className={`leading-relaxed ${item.highlight ? "font-semibold text-foreground text-base md:text-lg text-gradient-gold" : "text-muted-foreground text-sm md:text-base"}`}>
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Right — branded card with parallax */}
          <motion.div style={{ y: ySpring }} className="relative">
            {/* Main card */}
            <motion.div
              className="relative bg-gradient-card border border-border rounded-3xl p-8 md:p-10 overflow-hidden"
              initial={{ opacity: 0, x: 40, rotateY: 8 }}
              animate={inView ? { opacity: 1, x: 0, rotateY: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{ boxShadow: "0 32px 80px -20px hsl(45 100% 50% / 0.15), 0 0 0 1px hsl(45 100% 50% / 0.08)" }}
              whileHover={{ boxShadow: "0 40px 100px -20px hsl(45 100% 50% / 0.25), 0 0 0 1px hsl(45 100% 50% / 0.15)" }}
            >
              {/* Corner glow */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/12 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-amber-400/8 blur-2xl pointer-events-none" />

              {/* F logo */}
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-8 shadow-xl"
                style={{ boxShadow: "0 16px 40px -8px hsl(45 100% 50% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.3)" }}
                animate={{ rotate: [0, 2, -2, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="font-display text-2xl font-bold text-white">F</span>
              </motion.div>

              <h3 className="font-display text-2xl font-bold mb-3">
                Premium by <span className="text-gradient-gold">Design</span>
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Every detail of Foundarly is crafted to deliver a world-class consulting experience — from the moment you land on the platform to the PDF summary in your inbox.
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {["Handpicked Experts", "Private Sessions", "Verified Profiles", "Secure Payments"].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Floating stat badge */}
            <motion.div
              className="absolute -bottom-5 -left-5 bg-card border border-border rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.7, type: "spring", stiffness: 200 }}
              style={{ boxShadow: "0 12px 32px -8px hsl(45 100% 50% / 0.2)" }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Star className="h-4 w-4 text-primary fill-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">4.9 / 5.0</p>
                <p className="text-[10px] text-muted-foreground">Avg. Session Rating</p>
              </div>
            </motion.div>

            {/* Floating users badge */}
            <motion.div
              className="absolute -top-5 -right-5 bg-card border border-border rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.85, type: "spring", stiffness: 200 }}
              style={{ boxShadow: "0 12px 32px -8px hsl(45 100% 50% / 0.2)" }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">500+ Founders</p>
                <p className="text-[10px] text-muted-foreground">Served & Growing</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="py-16 bg-gradient-card border-y border-border relative overflow-hidden">
      {/* Subtle gold shimmer line */}
      <motion.div
        className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
        initial={{ scaleX: 0, originX: 0 }}
        animate={inView ? { scaleX: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.2 }}
        style={{ width: "100%" }}
      />

      <div className="container mx-auto px-6 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ icon: Icon, value, label }, i) => (
            <motion.div
              key={label}
              className="flex flex-col items-center text-center gap-3"
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-display text-2xl md:text-3xl font-bold text-gradient-gold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How It Works Section ──────────────────────────────────────────────────────
function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-28 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full bg-primary/4 blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 max-w-3xl relative z-10">
        <motion.div
          ref={ref}
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/6 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">The Process</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold">
            How <span className="text-gradient-gold">Foundarly works</span>?
          </h2>
          <p className="mt-4 text-muted-foreground text-sm max-w-md mx-auto">
            From discovery to your personalised session summary — here's your journey.
          </p>
        </motion.div>

        <div className="space-y-8">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <HeroSection />
      <StorySection />
      <StatsBar />
      <HowItWorksSection />
      <Footer />
    </div>
  );
}

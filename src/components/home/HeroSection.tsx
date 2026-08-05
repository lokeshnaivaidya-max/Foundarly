import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, BadgeCheck, Video } from "lucide-react";
import Lottie from "lottie-react";
import { useAuth } from "@/contexts/AuthContext";

function Particle({ x, y, size, delay, dur }: { x: string; y: string; size: number; delay: number; dur: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-primary/25 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -18, 0], opacity: [0.1, 0.4, 0.1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

const PARTICLES = [
  { x: "5%", y: "20%", size: 5, delay: 0, dur: 5.5 },
  { x: "92%", y: "15%", size: 4, delay: 1.2, dur: 6 },
  { x: "84%", y: "65%", size: 6, delay: 2, dur: 7 },
  { x: "8%", y: "68%", size: 3, delay: 0.7, dur: 5 },
];

function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [4, -4]);
  const rotateY = useTransform(mouseX, [-300, 300], [-4, 4]);

  const [lottieData, setLottieData] = useState<any>(null);

  useEffect(() => {
    fetch("/HELLO EXPERT.json")
      .then(r => r.json())
      .then(setLottieData)
      .catch(() => {});
  }, []);

  const { profile, isAdmin } = useAuth();
  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);

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
      className="relative min-h-screen bg-gradient-hero overflow-hidden flex items-center"
    >
      {/* Background effects */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />

      {/* Animated rings */}
      {[300, 480, 640].map((s, i) => (
        <motion.div
          key={s}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 pointer-events-none"
          style={{ width: s, height: s }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.15 - i * 0.04, 0.05, 0.15 - i * 0.04] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Decorative SVG */}
      <motion.svg
        className="absolute top-10 left-16 opacity-[0.09] pointer-events-none hidden lg:block"
        width="140"
        height="140"
        viewBox="0 0 140 140"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="70" cy="70" r="62" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1" strokeDasharray="8 6" />
        <circle cx="70" cy="70" r="42" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.5" strokeDasharray="4 8" />
      </motion.svg>

      {/* Particles */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      {/* Content — two-column split */}
      <div className="container mx-auto px-6 relative z-10 pt-24 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16 min-h-[calc(100vh-12rem)]">

          {/* LEFT — Text content */}
          <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-primary font-sans text-sm font-semibold tracking-[0.2em] uppercase mb-5"
            >
              Premium 1-on-1 Consulting
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
            >
              Strategic Conversations That{" "}
              <span className="text-gradient-gold">Move You Forward.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-5 text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed"
            >
              Private 1-on-1 video consultations with industry experts in career growth,
              business strategy, and personal transformation.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="mt-8 flex flex-col sm:flex-row gap-4"
            >
              {isAdminRole ? (
                <Link to="/admin">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" className="text-base px-8 py-6 glow-gold">
                      Admin Dashboard
                    </Button>
                  </motion.div>
                </Link>
              ) : isConsultantRole ? (
                <Link to="/consultant/dashboard">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" className="text-base px-8 py-6 glow-gold">
                      Consultant Dashboard
                    </Button>
                  </motion.div>
                </Link>
              ) : (
                <Link to="/booking">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" className="text-base px-8 py-6 glow-gold">
                      Book Your Session
                    </Button>
                  </motion.div>
                </Link>
              )}
              <Link to="/consultants">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="outline" size="lg" className="text-base px-8 py-6 border-border hover:border-primary/50 hover:bg-secondary">
                    Explore Experts
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="mt-10 flex flex-wrap items-center gap-5 text-xs text-muted-foreground"
            >
              {[
                { icon: Shield, label: "Secure Payments" },
                { icon: BadgeCheck, label: "Verified Experts" },
                { icon: Video, label: "Confidential Sessions" },
              ].map(({ icon: Icon, label }, i) => (
                <motion.span
                  key={label}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 + i * 0.15 }}
                >
                  <Icon size={14} className="text-primary" /> {label}
                </motion.span>
              ))}
            </motion.div>
          </div>

          {/* RIGHT — Lottie animation */}
          <motion.div
            className="w-full lg:w-1/2 flex items-center justify-center lg:justify-end"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          >
            {lottieData ? (
              <motion.div
                className="w-full max-w-[480px] lg:max-w-[560px]"
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              >
                <Lottie animationData={lottieData} loop autoplay />
              </motion.div>
            ) : (
              /* Placeholder while loading */
              <div className="w-full max-w-[480px] lg:max-w-[560px] aspect-square rounded-3xl bg-primary/5 border border-primary/10 animate-pulse" />
            )}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
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
    </section>
  );
}

export default HeroSection;

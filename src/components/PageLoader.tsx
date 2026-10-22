import { motion } from "framer-motion";

// ── Full-page loader (for auth-gated pages and screen reloads) ───────────────
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4 select-none relative overflow-hidden">
      {/* Background radial gold glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[380px] h-[260px] bg-primary/10 rounded-full blur-[90px] -z-10" />
      </div>

      <div className="relative flex flex-col items-center justify-center">
        <motion.div
          className="relative w-16 h-16 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        >
          {/* Outer ring */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(45 100% 50% / 0.15)" strokeWidth="3" />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="#F5A623"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="44 132"
            />
          </svg>
          {/* Inner pulsating gold monogram */}
          <motion.div
            className="w-7 h-7 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-primary font-serif font-bold text-xs"
            animate={{ scale: [0.95, 1.1, 0.95] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            F
          </motion.div>
        </motion.div>

        {/* Brand label */}
        <p className="font-serif font-bold text-sm tracking-widest text-foreground mt-4">
          FOUNDARLY
        </p>
      </div>

      {text && (
        <motion.p
          className="text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

// ── Inline section loader (for card and section-level loading) ───────────────
export function SectionLoader({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 select-none">
      <motion.div
        className="w-10 h-10 relative flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      >
        <svg className="w-full h-full" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="17" fill="none" stroke="hsl(45 100% 50% / 0.15)" strokeWidth="3" />
          <circle
            cx="20" cy="20" r="17"
            fill="none"
            stroke="#F5A623"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="28 84"
          />
        </svg>
      </motion.div>
      {text && (
        <motion.p
          className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0 -translate-x-full"
      animate={{ translateX: ["−100%", "200%"] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }}
      style={{
        background: "linear-gradient(90deg, transparent, hsl(45 100% 50% / 0.06), transparent)",
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, avatar = false }: { lines?: number; avatar?: boolean }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-6 overflow-hidden relative">
      <Shimmer />
      {avatar && (
        <div className="w-14 h-14 rounded-full bg-muted mb-4 mx-auto" />
      )}
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded-full w-3/4" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <div key={i} className={`h-3 bg-muted rounded-full ${i === lines - 2 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

// ── Skeleton grid ─────────────────────────────────────────────────────────────
export function SkeletonGrid({ count = 3, cols = 3, avatar = false }: { count?: number; cols?: number; avatar?: boolean }) {
  const colClass = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", 4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" }[cols] ?? "grid-cols-1 sm:grid-cols-3";
  return (
    <div className={`grid ${colClass} gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
        >
          <SkeletonCard avatar={avatar} />
        </motion.div>
      ))}
    </div>
  );
}

// ── Skeleton list (for bookings / FAQs) ──────────────────────────────────────
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="bg-gradient-card border border-border rounded-2xl p-6 overflow-hidden relative"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <Shimmer />
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded-full w-1/3" />
              <div className="h-3 bg-muted rounded-full w-1/4" />
            </div>
            <div className="h-6 w-16 bg-muted rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-3 bg-muted rounded-full" />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

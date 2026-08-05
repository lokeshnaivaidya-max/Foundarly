import { motion } from "framer-motion";

// ── Full-page loader (for auth-gated pages) ──────────────────────────────────
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <motion.div
        className="relative w-16 h-16"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      >
        {/* Outer ring */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(45 100% 50% / 0.15)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke="hsl(45 100% 50%)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="44 132"
          />
        </svg>
        {/* Inner dot */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-3 h-3 rounded-full bg-primary" />
        </motion.div>
      </motion.div>

      <motion.p
        className="text-sm text-muted-foreground"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {text}
      </motion.p>
    </div>
  );
}

// ── Inline spinner (for section-level loading) ───────────────────────────────
export function SectionLoader({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <motion.div
        className="relative w-12 h-12"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      >
        <svg className="w-full h-full" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(45 100% 50% / 0.15)" strokeWidth="3" />
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke="hsl(45 100% 50%)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="32 96"
          />
        </svg>
      </motion.div>
      {text && (
        <motion.p
          className="text-sm text-muted-foreground"
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

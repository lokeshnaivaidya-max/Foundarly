import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { testimonialsService } from "@/services/testimonials";

function StarRow({ rating, animate = false }: { rating: number; animate?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={animate ? { scale: 1, opacity: 1 } : {}}
          transition={{ delay: i * 0.07, type: "spring", stiffness: 400 }}
        >
          <Star
            className={`h-4 w-4 ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`}
          />
        </motion.div>
      ))}
    </div>
  );
}

function TestimonialCard({ t, index }: { t: any; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="relative bg-gradient-card border border-border rounded-2xl p-6 flex flex-col gap-4 group overflow-hidden"
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(45 100% 50% / 0.06) 0%, transparent 70%)" }} />

      {/* Quote icon */}
      <Quote className="h-7 w-7 text-primary/20 shrink-0" />

      {/* Review text */}
      <p className="text-sm text-foreground/80 leading-relaxed flex-1 italic">
        "{t.review}"
      </p>

      {/* Stars */}
      <StarRow rating={t.rating} animate={inView} />

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-primary font-bold text-sm">
            {t.client_name?.charAt(0)?.toUpperCase() || "U"}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t.client_name}</p>
          {t.consultant_name && (
            <p className="text-xs text-muted-foreground">
              Consulted: <span className="text-primary/80">{t.consultant_name}</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function TestimonialsSection() {
  const { data: rawTestimonials, isLoading } = useQuery({
    queryKey: ["testimonials", "published"],
    queryFn: () => testimonialsService.getAllWithConsultant(),
  });

  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true });

  if (isLoading || !rawTestimonials || rawTestimonials.length === 0) return null;

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(45 100% 50% / 0.04) 0%, transparent 70%)" }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          ref={headerRef}
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Testimonials</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            What Our <span className="text-gradient-gold">Clients Say</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm">
            Real feedback from founders and professionals who've had sessions on Foundarly.
          </p>
        </motion.div>

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {rawTestimonials.map((t: any, i: number) => (
            <TestimonialCard key={t.id} t={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

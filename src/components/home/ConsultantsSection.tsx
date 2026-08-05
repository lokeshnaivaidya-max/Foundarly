import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { consultantsService } from "@/services/consultants";
import { useCurrency } from "@/contexts/CurrencyContext";
import { SkeletonGrid } from "@/components/PageLoader";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ConsultantsSection() {
  const { formatPrice } = useCurrency();
  const { profile, isAdmin } = useAuth();
  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);
  const isClientRole = !isAdminRole && !isConsultantRole;
  const { data: consultants, isLoading } = useQuery({
    queryKey: ['consultants', 'active'],
    queryFn: () => consultantsService.getAll(true),
  });

  if (isLoading) {
    return (
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <div className="h-3 bg-muted rounded-full w-24 mx-auto mb-3" />
            <div className="h-8 bg-muted rounded-full w-56 mx-auto" />
          </div>
          <SkeletonGrid count={4} cols={4} avatar={false} />
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Dot grid */}
      <svg className="absolute bottom-0 left-0 w-64 h-64 opacity-[0.04] pointer-events-none" viewBox="0 0 200 200">
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => (
            <circle key={`${row}-${col}`} cx={col * 25 + 12} cy={row * 25 + 12} r="2" fill="hsl(45,100%,50%)" />
          ))
        )}
      </svg>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Featured</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Meet Our <span className="text-gradient-gold">Experts</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {consultants?.slice(0, 4).map((c, i) => (
            <motion.div
              key={c.id}
              className="group bg-gradient-card border border-border rounded-2xl p-6 flex flex-col justify-between text-left relative overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              whileHover={{ y: -8, boxShadow: "0 24px 48px -12px hsl(45 100% 50% / 0.2)" }}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />

              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors">{c.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.title}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold shrink-0">
                    <BadgeCheck className="h-3 w-3 text-primary" />
                    <span>Verified</span>
                  </div>
                </div>

                {c.expertise && c.expertise.length > 0 && (
                  <span className="inline-block my-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    {c.expertise[0]}
                  </span>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border/60">
                <p className="font-sans text-lg font-bold text-foreground">
                  {formatPrice(c.pricing_60)}
                  <span className="text-sm text-muted-foreground font-normal"> / session</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60">*Prices may vary — rates can go up or down</p>

                {isClientRole && (
                  <Link to={`/booking?consultant=${c.id}`} className="mt-3 block w-full relative z-10">
                    <Button variant="outline" size="sm" className="w-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all text-xs">
                      Book Now
                    </Button>
                  </Link>
                )}
              </div>

              {/* Bottom accent */}
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary/60 to-transparent"
                initial={{ width: 0 }}
                whileInView={{ width: "50%" }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 + 0.5, duration: 0.8 }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

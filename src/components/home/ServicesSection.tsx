import { Rocket, BarChart3, Star } from "lucide-react";
import { motion } from "framer-motion";

const services = [
  {
    icon: Rocket,
    title: "Career Acceleration",
    description: "Navigate career transitions, negotiate leadership roles, and build a strategic path to your next milestone.",
    svg: (
      <svg viewBox="0 0 80 80" className="absolute -bottom-4 -right-4 w-24 h-24 opacity-5 pointer-events-none">
        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 60 L40 20 L60 60 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    icon: BarChart3,
    title: "Business Strategy",
    description: "Refine your business model, optimize operations, and build scalable strategies with seasoned entrepreneurs.",
    svg: (
      <svg viewBox="0 0 80 80" className="absolute -bottom-4 -right-4 w-24 h-24 opacity-5 pointer-events-none">
        <rect x="10" y="40" width="12" height="30" fill="currentColor" />
        <rect x="34" y="25" width="12" height="45" fill="currentColor" />
        <rect x="58" y="10" width="12" height="60" fill="currentColor" />
      </svg>
    ),
  },
  {
    icon: Star,
    title: "Personal Growth",
    description: "Develop executive presence, overcome limiting beliefs, and cultivate the mindset of high-performing leaders.",
    svg: (
      <svg viewBox="0 0 80 80" className="absolute -bottom-4 -right-4 w-24 h-24 opacity-5 pointer-events-none">
        <polygon points="40,5 50,30 75,30 55,48 63,73 40,57 17,73 25,48 5,30 30,30" fill="currentColor" />
      </svg>
    ),
  },
];

export default function ServicesSection() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Decorative dots */}
      <svg className="absolute top-0 right-0 w-64 h-64 opacity-[0.04] pointer-events-none" viewBox="0 0 200 200">
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
          <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">What We Offer</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Focused Consulting. <span className="text-gradient-gold">Real Results.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              className="group relative bg-gradient-card border border-border rounded-2xl p-8 overflow-hidden cursor-default"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              whileHover={{ y: -6, boxShadow: "0 20px 40px -12px hsl(45 100% 50% / 0.2)" }}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

              {/* Background SVG shape */}
              <div className="text-primary">{service.svg}</div>

              <motion.div
                className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300"
                whileHover={{ rotate: 10, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <service.icon size={24} className="text-primary" />
              </motion.div>

              <h3 className="font-display text-xl font-semibold mb-3 group-hover:text-primary transition-colors">{service.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>

              {/* Bottom accent line */}
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary/60 to-transparent"
                initial={{ width: 0 }}
                whileInView={{ width: "40%" }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.4, duration: 0.8 }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { ShieldCheck, Video, BadgeCheck, CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";

const badges = [
  { icon: ShieldCheck, label: "Secure Online Payments" },
  { icon: Video, label: "Confidential Video Consultations" },
  { icon: BadgeCheck, label: "Verified Expert Profiles" },
  { icon: CalendarCheck, label: "Instant Booking Confirmation" },
];

export default function TrustSection() {
  return (
    <section className="py-20 bg-background relative overflow-hidden">
      {/* Subtle wave SVG */}
      <svg className="absolute bottom-0 left-0 w-full opacity-[0.04] pointer-events-none" viewBox="0 0 1440 80" preserveAspectRatio="none">
        <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="hsl(45,100%,50%)" />
      </svg>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="flex flex-wrap justify-center gap-4 md:gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {badges.map((b, i) => (
            <motion.div
              key={b.label}
              className="flex items-center gap-3 bg-secondary/50 border border-border rounded-full px-5 py-3 cursor-default"
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ scale: 1.05, borderColor: "hsl(45 100% 50% / 0.4)", boxShadow: "0 4px 20px -4px hsl(45 100% 50% / 0.2)" }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, repeatDelay: 4 }}
              >
                <b.icon size={18} className="text-primary" />
              </motion.div>
              <span className="text-sm font-medium text-foreground">{b.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

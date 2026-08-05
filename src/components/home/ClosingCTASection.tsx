import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

export default function ClosingCTASection() {
  const { profile, isAdmin } = useAuth();
  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);

  return (
    <section className="py-24 bg-gradient-hero relative overflow-hidden">
      {/* Animated SVG rings */}
      {[300, 500, 700].map((size, i) => (
        <motion.div
          key={size}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 pointer-events-none"
          style={{ width: size, height: size }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 4 + i, delay: i * 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Gold glow center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-primary/8 blur-[80px] rounded-full pointer-events-none" />

      {/* Decorative SVG — left */}
      <motion.svg
        className="absolute left-8 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block"
        width="100" height="100" viewBox="0 0 100 100"
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1" strokeDasharray="6 4" />
        <circle cx="50" cy="50" r="28" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.5" strokeDasharray="3 6" />
      </motion.svg>

      {/* Decorative SVG — right */}
      <motion.svg
        className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block"
        width="80" height="80" viewBox="0 0 80 80"
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <polygon points="40,4 76,68 4,68" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1" />
        <polygon points="40,18 62,58 18,58" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.5" />
      </motion.svg>

      <div className="container mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <motion.h2
            className="font-display text-3xl md:text-5xl font-bold max-w-3xl mx-auto leading-tight"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Your Next Breakthrough Starts With{" "}
            <span className="text-gradient-gold">One Conversation.</span>
          </motion.h2>

          <motion.p
            className="mt-6 text-muted-foreground text-lg max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Connect with a verified expert and take the next step in your journey.
          </motion.p>

          <motion.div
            className="inline-block mt-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            {isAdminRole ? (
              <Link to="/admin">
                <Button size="lg" className="text-base px-10 py-6 glow-gold relative overflow-hidden group">
                  <motion.span
                    className="absolute inset-0 bg-white/10 rounded-md"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  Go to Admin Dashboard
                </Button>
              </Link>
            ) : isConsultantRole ? (
              <Link to="/consultant/dashboard">
                <Button size="lg" className="text-base px-10 py-6 glow-gold relative overflow-hidden group">
                  <motion.span
                    className="absolute inset-0 bg-white/10 rounded-md"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  Go to Consultant Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/booking">
                <Button size="lg" className="text-base px-10 py-6 glow-gold relative overflow-hidden group">
                  <motion.span
                    className="absolute inset-0 bg-white/10 rounded-md"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  Book a Private Session
                </Button>
              </Link>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

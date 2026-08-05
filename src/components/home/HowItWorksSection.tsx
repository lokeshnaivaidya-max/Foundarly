import { UserSearch, CalendarCheck, CreditCard, Video } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { icon: UserSearch, title: "Choose Your Expert", description: "Browse curated profiles and select the right consultant for your goals.", color: "from-amber-400 to-yellow-500" },
  { icon: CalendarCheck, title: "Book Your Session", description: "Pick a date and time that works perfectly for your schedule.", color: "from-yellow-500 to-orange-400" },
  { icon: CreditCard, title: "Secure Payment", description: "Complete your booking with our encrypted Razorpay payment flow.", color: "from-orange-400 to-amber-500" },
  { icon: Video, title: "Join Your Session", description: "Connect via private video for your one-on-one consultation.", color: "from-amber-500 to-yellow-400" },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24 bg-gradient-dark relative overflow-hidden">
      {/* Background SVG grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Glow blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">How Foundarly Works?</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            From Booking to <span className="text-gradient-gold">Breakthrough</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connector line desktop */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className="text-center relative group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
            >
              <motion.div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/20`}
                whileHover={{ scale: 1.12, rotate: 6 }}
                transition={{ type: "spring", stiffness: 300 }}
                style={{ boxShadow: "0 8px 32px -8px hsl(45 100% 50% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.25)" }}
              >
                <step.icon size={26} className="text-white drop-shadow" />
              </motion.div>

              {/* Step number badge */}
              <motion.div
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.3, type: "spring" }}
              >
                {i + 1}
              </motion.div>

              <h3 className="font-display text-lg font-semibold mt-2 mb-2 group-hover:text-primary transition-colors">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

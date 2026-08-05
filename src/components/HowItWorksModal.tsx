import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, Search, UserCheck, CalendarCheck, Video, FileText, Star, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const BOOKING_PROCESS_STEPS = [
  {
    step: 1,
    title: "Find Your Ideal Expert",
    desc: "Explore verified consultants across 29 specialized industry categories or use smart search to match your exact business challenge.",
    icon: Search
  },
  {
    step: 2,
    title: "Inspect Verified Profile",
    desc: "Review qualifications, background, past client ratings, session rates, availability, and preferred consultation hours.",
    icon: UserCheck
  },
  {
    step: 3,
    title: "Select Slot & Apply Offers",
    desc: "Choose a 30 or 60 minute duration, select your preferred date & time, and enter your referral code for instant price discounts.",
    icon: CalendarCheck
  },
  {
    step: 4,
    title: "Secure Instant Payment",
    desc: "Pay safely via encrypted UPI or card payment with instant booking confirmation and calendar sync.",
    icon: CheckCircle2
  },
  {
    step: 5,
    title: "Attend Private Consultation",
    desc: "Join your private 1-on-1 video session in Foundarly's encrypted meeting room directly from your dashboard.",
    icon: Video
  },
  {
    step: 6,
    title: "Receive Summary & Report",
    desc: "Get an actionable consultation summary PDF with key recommendations, next steps, and review options after the call.",
    icon: FileText
  }
];

export interface HowItWorksModalProps {
  buttonText?: string;
  showText?: boolean;
  className?: string;
}

export default function HowItWorksModal({ buttonText, showText = false, className = "" }: HowItWorksModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors cursor-pointer group focus:outline-none ${className}`}
            aria-label="How Foundarly Works Help"
          >
            <motion.div
              whileHover={{ scale: 1.15, rotate: 12 }}
              whileTap={{ scale: 0.9 }}
              className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </motion.div>
            {showText && (
              <span className="text-xs font-semibold tracking-wide underline underline-offset-4 decoration-primary/40 group-hover:decoration-primary">
                {buttonText || "How process works?"}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="bg-background/95 border-border backdrop-blur-md text-xs py-1.5 px-3 rounded-lg shadow-lg">
          Click for complete booking guide
        </TooltipContent>
      </Tooltip>

      {/* Animated Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md z-40"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative w-full max-w-2xl bg-gradient-card border border-primary/30 rounded-3xl p-6 md:p-8 shadow-2xl z-50 overflow-hidden my-8 max-h-[85vh] flex flex-col"
            >
              {/* Background ambient glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/80 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground">
                      How <span className="text-gradient-gold">Foundarly Works</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">Simple 6-step hassle-free booking & consultation process</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="py-6 space-y-4 overflow-y-auto pr-1">
                {BOOKING_PROCESS_STEPS.map((s, index) => {
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={s.step}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/40 border border-border/60 hover:border-primary/40 transition-all duration-200 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                            STEP 0{s.step}
                          </span>
                          <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                            {s.title}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border/80 flex items-center justify-between shrink-0">
                <span className="text-xs text-muted-foreground">Ready to get started?</span>
                <Button size="sm" onClick={() => setIsOpen(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full px-5">
                  Got It, Thanks!
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

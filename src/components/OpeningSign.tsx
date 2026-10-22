"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Signature } from "@/components/Signature";
import { ArrowRight, Sparkles } from "lucide-react";

interface OpeningSignProps {
  /** Callback fired when intro completes or is skipped */
  onComplete?: () => void;
  /** Force display regardless of sessionStorage */
  forceShow?: boolean;
}

export function OpeningSign({ onComplete, forceShow = false }: OpeningSignProps) {
  const [visible, setVisible] = useState(() => {
    if (forceShow) return true;
    try {
      // Show on first visit per browser session
      const shown = sessionStorage.getItem("foundarly_opening_sign_shown");
      return !shown;
    } catch {
      return true;
    }
  });

  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Allow skip button after 0.8s
    const skipTimer = setTimeout(() => setCanSkip(true), 800);

    // Auto-dismiss after 3.6s (signature animation is 3s)
    const dismissTimer = setTimeout(() => {
      dismiss();
    }, 3600);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(dismissTimer);
    };
  }, [visible]);

  const dismiss = () => {
    try {
      sessionStorage.setItem("foundarly_opening_sign_shown", "true");
    } catch {
      // Ignore
    }
    setVisible(false);
    onComplete?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="opening-sign-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999] bg-[#0c0d10] text-[#f5f5f7] flex flex-col items-center justify-center p-6 select-none overflow-hidden"
        >
          {/* Ambient luxury radial gold glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            <div className="w-[600px] h-[400px] bg-[#F5A623]/15 rounded-full blur-[140px] -z-10 animate-pulse" />
            <div className="absolute top-1/4 left-1/3 w-48 h-48 bg-[#F5A623]/10 rounded-full blur-[90px] -z-10" />
          </div>

          <div className="relative flex flex-col items-center text-center max-w-xl mx-auto">
            {/* Header pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
            >
              <Sparkles className="w-3 h-3 text-[#F5A623]" />
              <span>Welcome to</span>
            </motion.div>

            {/* The Foundarly Signature Animation (3s duration, #F5A623 gold color) */}
            <div className="py-2">
              <Signature
                text="Foundarly"
                color="#F5A623"
                fontSize={56}
                duration={3}
                once={true}
                className="drop-shadow-[0_0_35px_rgba(245,166,35,0.45)]"
              />
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.4 }}
              className="text-xs sm:text-sm font-sans tracking-[0.18em] uppercase text-neutral-400 mt-2 font-medium"
            >
              Premium 1-on-1 Business Mentorship & Consulting
            </motion.p>

            {/* Accent divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1.8, delay: 0.6, ease: "easeOut" }}
              className="h-[1px] w-48 bg-gradient-to-r from-transparent via-[#F5A623]/60 to-transparent my-6"
            />

            {/* Skip / Enter button */}
            {canSkip && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                onClick={dismiss}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-neutral-400 hover:text-[#F5A623] border border-neutral-800 hover:border-[#F5A623]/40 bg-neutral-900/60 backdrop-blur transition-all cursor-pointer"
              >
                <span>Enter Website</span>
                <ArrowRight className="w-3 h-3" />
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OpeningSign;

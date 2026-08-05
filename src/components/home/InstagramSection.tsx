import { motion } from "framer-motion";
import { Instagram, QrCode, ExternalLink, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

export const INSTAGRAM_OFFICIAL_URL = "https://www.instagram.com/foundarlybusinessworld_in?utm_source=qr&igsh=dmVxNm8wNW93aHV5";

export default function InstagramSection() {
  return (
    <section className="py-20 relative bg-background/50 overflow-hidden border-t border-border/50">
      {/* Background accents */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-pink-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-purple-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/80 to-card/60 p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Subtle Instagram Gradient Border Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column - Content & CTA */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-pink-500 text-xs font-semibold uppercase tracking-wider">
                <Instagram size={16} />
                <span>Foundarly Business World</span>
              </div>

              <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                Connect with us on <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500">Instagram</span>
              </h2>

              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                Follow <span className="text-foreground font-semibold">@foundarlybusinessworld_in</span> for daily business tactics, consultant spotlights, networking updates, and exclusive behind-the-scenes founder content.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                  <CheckCircle size={16} className="text-rose-500 shrink-0" />
                  <span>Daily Business Tips & Insights</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                  <CheckCircle size={16} className="text-rose-500 shrink-0" />
                  <span>Consultant Q&A Sessions</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                  <CheckCircle size={16} className="text-rose-500 shrink-0" />
                  <span>Community Events & Live Reels</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                  <CheckCircle size={16} className="text-rose-500 shrink-0" />
                  <span>Instant Network Updates</span>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <a
                  href={INSTAGRAM_OFFICIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-semibold px-6 shadow-lg shadow-rose-500/20 gap-2">
                    <Instagram size={18} />
                    Follow @foundarlybusinessworld_in
                  </Button>
                </a>
                <a
                  href={INSTAGRAM_OFFICIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                    Open Instagram <ExternalLink size={14} />
                  </Button>
                </a>
              </div>
            </div>

            {/* Right Column - QR Code Card */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <motion.div
                className="w-full max-w-xs bg-background/90 border border-border/80 rounded-2xl p-6 shadow-xl text-center space-y-4 relative group"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                  <QrCode size={16} />
                  <span>Scan to Follow</span>
                </div>

                {/* QR Code Canvas */}
                <div className="p-4 bg-white rounded-xl shadow-inner inline-block border border-gray-100">
                  <QRCodeSVG
                    value={INSTAGRAM_OFFICIAL_URL}
                    size={160}
                    bgColor={"#FFFFFF"}
                    fgColor={"#000000"}
                    level={"H"}
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    @foundarlybusinessworld_in
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Scan with your phone camera to open Instagram
                  </p>
                </div>

                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    <Sparkles size={12} /> Official Account
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

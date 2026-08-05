import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Youtube, Instagram, PlayCircle, Sparkles } from "lucide-react";

export default function Footer() {
  const { profile, isAdmin } = useAuth();
  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);

  return (
    <footer className="border-t border-border/80 bg-background/95 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand Info & Video CTA */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold text-gradient-gold">Foundarly</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold tracking-wider uppercase">
                Premium
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              By the Founders. For the Founders. The premier elite network for verified expert advisory and strategic consulting.
            </p>

            {/* Social Icons & Watch Intro Video Pill Button */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-secondary/50 border border-border p-1 rounded-full">
                <a
                  href="https://youtube.com/@foundarly?si=ZHlc2Swj3Rtm37Kn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube Channel"
                  title="Foundarly YouTube Channel"
                  className="w-7 h-7 rounded-full bg-background flex items-center justify-center text-muted-foreground hover:text-red-500 hover:scale-110 transition-all duration-200"
                >
                  <Youtube size={14} />
                </a>
                <a
                  href="https://www.instagram.com/foundarlybusinessworld_in?utm_source=qr&igsh=dmVxNm8wNW93aHV5"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Foundarly Instagram"
                  className="w-7 h-7 rounded-full bg-background flex items-center justify-center text-muted-foreground hover:text-pink-500 hover:scale-110 transition-all duration-200"
                >
                  <Instagram size={14} />
                </a>
              </div>

              <a
                href="https://youtu.be/L2ndHKr9Q5Y?si=TE35364lR-3dY94F"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 shadow-sm transition-all duration-300 hover:scale-105"
              >
                <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Watch Intro Video</span>
              </a>
            </div>
          </div>

          {/* Navigation Column 1 */}
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/80 mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Explore Experts
                </Link>
              </li>
              <li>
                <Link to="/network" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Founder Network
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Pricing
                </Link>
              </li>
              <li>
                {isAdminRole ? (
                  <Link to="/admin" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                    Admin Dashboard
                  </Link>
                ) : isConsultantRole ? (
                  <Link to="/consultant/dashboard" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                    Consultant Dashboard
                  </Link>
                ) : (
                  <Link to="/booking" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                    Book a Session
                  </Link>
                )}
              </li>
            </ul>
          </div>

          {/* Navigation Column 2 */}
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/80 mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Our Story
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/faqs" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  FAQs
                </Link>
              </li>
              <li>
                <Link to="/apply-consultant" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Become a Consultant
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Column 3 */}
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/80 mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/networking-terms" className="text-muted-foreground hover:text-primary transition-colors inline-block hover:translate-x-0.5 duration-200">
                  Community Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-border/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Foundarly. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>By Founders • For Founders</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

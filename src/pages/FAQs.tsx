import { useState, useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorksModal from "@/components/HowItWorksModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { faqsService, FAQ } from "@/services/faqs";
import { SkeletonList } from "@/components/PageLoader";
import { HelpCircle, MessageCircle, Search } from "lucide-react";

function Particle({ x, y, size, delay, dur }: { x: string; y: string; size: number; delay: number; dur: number }) {
  return (
    <motion.div className="absolute rounded-full bg-primary/25 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -18, 0], opacity: [0.1, 0.4, 0.1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }} />
  );
}

const PARTICLES = [
  { x: "6%",  y: "22%", size: 5, delay: 0,   dur: 5.5 },
  { x: "91%", y: "16%", size: 4, delay: 1.2, dur: 6   },
  { x: "82%", y: "68%", size: 6, delay: 2,   dur: 7   },
  { x: "9%",  y: "70%", size: 3, delay: 0.7, dur: 5   },
];

function FAQItem({ faq, index }: { faq: FAQ; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
    >
      <AccordionItem
        value={faq.id}
        className="group bg-card/90 hover:bg-card border border-border/80 hover:border-primary/40 data-[state=open]:border-primary/60 data-[state=open]:bg-secondary/20 data-[state=open]:shadow-lg data-[state=open]:shadow-primary/5 rounded-2xl px-5 sm:px-7 overflow-hidden transition-all duration-300 mb-3.5 relative"
      >
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary opacity-0 group-data-[state=open]:opacity-100 transition-opacity duration-300" />
        <AccordionTrigger className="text-left py-5 sm:py-6 gap-4 hover:no-underline [&[data-state=open]>svg]:rotate-180 [&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:text-primary shrink-0">
          <div className="flex items-center gap-3.5 flex-1 pr-2">
            <span className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground group-data-[state=open]:border-primary transition-all duration-300">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-display font-semibold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors duration-200">
              {faq.question}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="text-muted-foreground/90 text-sm sm:text-base leading-relaxed pb-6 pt-1 pl-10 sm:pl-11 pr-2">
          {faq.answer}
        </AccordionContent>
      </AccordionItem>
    </motion.div>
  );
}

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [4, -4]);
  const rotateY = useTransform(mouseX, [-300, 300], [-4, 4]);

  useEffect(() => {
    faqsService.getAll().then(setFaqs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filteredFaqs = faqs.filter(f => 
    !searchQuery.trim() ||
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* ── Hero ── */}
      <section ref={containerRef} onMouseMove={handleMouseMove}
        className="relative pt-36 pb-16 bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
        {[300, 480, 640].map((s, i) => (
          <motion.div key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 pointer-events-none"
            style={{ width: s, height: s }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.15 - i * 0.04, 0.05, 0.15 - i * 0.04] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }} />
        ))}
        <motion.svg className="absolute top-10 right-16 opacity-[0.09] pointer-events-none" width="140" height="140" viewBox="0 0 140 140"
          animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
          <circle cx="70" cy="70" r="62" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1" strokeDasharray="8 6" />
          <circle cx="70" cy="70" r="42" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="0.5" strokeDasharray="4 8" />
        </motion.svg>
        <motion.svg className="absolute bottom-8 left-12 opacity-[0.07] pointer-events-none" width="90" height="90" viewBox="0 0 90 90"
          animate={{ rotate: -360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>
          <polygon points="45,4 86,68 4,68" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="1.2" />
        </motion.svg>
        {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/8 mb-7"
            initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">Support</span>
          </motion.div>
          <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
            <motion.h1 className="font-display text-5xl md:text-6xl font-bold leading-tight"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}>
              Frequently Asked{" "}
              <span className="relative inline-block">
                <span className="text-gradient-gold">Questions</span>
                <motion.div className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-amber-400"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h1>
          </motion.div>
          <motion.p className="mt-5 text-muted-foreground max-w-md mx-auto text-sm md:text-base"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
            Everything you need to know about Foundarly and how it works.
          </motion.p>

          {/* Search Box */}
          <motion.div className="mt-8 max-w-md mx-auto relative"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search questions (e.g. commission, consultant, confidentiality)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-6 bg-gradient-card border-border focus:border-primary rounded-full text-sm shadow-xl"
            />
          </motion.div>

          <motion.div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <span>Need step-by-step guide?</span>
            <HowItWorksModal showText buttonText="How Foundarly Works" />
          </motion.div>
        </div>
      </section>

      {/* ── FAQ List ── */}
      <section className="py-16 bg-background relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-6 max-w-3xl relative z-10">
          {loading ? (
            <SkeletonList count={5} />
          ) : filteredFaqs.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 bg-secondary/20 rounded-2xl border border-border">
              No questions matched your search query "{searchQuery}".
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-0">
              {filteredFaqs.map((faq, i) => <FAQItem key={faq.id} faq={faq} index={i} />)}
            </Accordion>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

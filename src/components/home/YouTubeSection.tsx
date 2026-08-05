import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Youtube, ExternalLink, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const YOUTUBE_CHANNEL_URL = "https://youtube.com/@foundarly?si=ZHlc2Swj3Rtm37Kn";
export const FEATURED_VIDEO_URL = "https://youtu.be/L2ndHKr9Q5Y?si=TE35364lR-3dY94F";
export const FEATURED_VIDEO_ID = "L2ndHKr9Q5Y";

export default function YouTubeSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const thumbnailUrl = `https://img.youtube.com/vi/${FEATURED_VIDEO_ID}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${FEATURED_VIDEO_ID}?autoplay=1&rel=0`;

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  return (
    <section className="py-20 relative bg-background overflow-hidden border-t border-border/50">
      {/* Glow Effects */}
      <div className="absolute top-1/2 -left-32 w-96 h-96 bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold uppercase tracking-wider mb-4">
            <Youtube size={16} className="animate-pulse" />
            <span>Official Youtube Channel</span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Watch & Learn on <span className="text-gradient-gold">Foundarly</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            Gain exclusive insights, expert interviews, and strategic startup guidance from top industry leaders.
          </p>
        </motion.div>

        {/* Main Video Card Container */}
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-4 md:p-6 shadow-2xl overflow-hidden relative"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Embedded Player or Interactive Thumbnail */}
              <div className="lg:col-span-7 relative group rounded-2xl overflow-hidden bg-black aspect-video shadow-lg border border-border/60">
                {isPlaying ? (
                  <iframe
                    src={embedUrl}
                    title="Foundarly Featured YouTube Video"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <div className="relative w-full h-full cursor-pointer" onClick={() => setIsPlaying(true)}>
                    <img
                      src={thumbnailUrl}
                      alt="Foundarly Featured Video"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center">
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-600/50 border-2 border-white/20 group-hover:bg-red-500 transition-colors"
                        aria-label="Play Video"
                      >
                        <Play size={32} className="fill-white translate-x-0.5" />
                      </motion.button>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-xs text-white/80">
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 font-mono">
                        FEATURED
                      </span>
                      <span className="bg-red-600 px-2 py-0.5 rounded text-white font-bold">
                        HD
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info & CTAs */}
              <div className="lg:col-span-5 flex flex-col justify-center gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>Featured Video</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold leading-tight">
                    Foundarly: Accelerate Your Business Growth
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Watch our official video to learn how Foundarly empowers entrepreneurs with 1-on-1 expert advisory, direct networking, and actionable market strategies.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <a
                    href={FEATURED_VIDEO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 gap-2 font-medium">
                      <ExternalLink size={16} />
                      Watch on YouTube
                    </Button>
                  </a>
                  <a
                    href={YOUTUBE_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 font-medium shadow-lg shadow-red-600/20">
                      <Youtube size={18} />
                      Visit Our Channel
                    </Button>
                  </a>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Official Channel: @foundarly</span>
                  <button
                    onClick={handleOpenModal}
                    className="text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    Open Theater Modal
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Theater Modal View */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <Youtube size={20} className="text-red-600" />
                  <span className="font-display font-semibold text-sm">Foundarly Official Video</span>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={embedUrl}
                  title="Foundarly YouTube Video Modal"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>

              <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-card">
                <div>
                  <h4 className="font-bold text-base">Subscribe to Foundarly on YouTube</h4>
                  <p className="text-xs text-muted-foreground">Get notified about our latest founder stories and masterclasses.</p>
                </div>
                <div className="flex gap-3">
                  <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-2">
                      <Youtube size={16} /> Subscribe
                    </Button>
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

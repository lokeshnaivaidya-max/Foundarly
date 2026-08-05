import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { SkeletonGrid } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { pricingService, PricingTier } from "@/services/pricing";
import { useAuth } from "@/contexts/AuthContext";

export default function PricingPage() {
  const { formatPrice } = useCurrency();
  const { profile, isAdmin } = useAuth();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminRole = isAdmin || profile?.role === "admin";
  const isConsultantRole = !isAdminRole && (profile?.role === "consultant" || profile?.is_consultant);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const data = await pricingService.getAll(true); // Only active tiers
      setTiers(data);
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Pricing</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">Invest in <span className="text-gradient-gold">Clarity</span></h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Transparent pricing. No hidden fees. Premium value.</p>
          </AnimatedSection>

          {loading ? (
            <SkeletonGrid count={1} cols={1} />
          ) : tiers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Pricing information coming soon.</p>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              {(() => {
                const mainTier = tiers.find(t => t.duration_minutes === 60) || tiers.find(t => t.is_popular) || tiers[0];
                return (
                  <AnimatedSection>
                    <div className="relative bg-gradient-card border border-primary/40 glow-gold-sm rounded-lg p-8 flex flex-col">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full">Most Popular</span>
                      <h3 className="font-display text-xl font-semibold mb-2">{mainTier.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">30-60 min session</p>
                      <p className="text-4xl font-bold text-foreground mb-6">{formatPrice(mainTier.price)}</p>
                      <ul className="space-y-3 flex-1 mb-8">
                        {mainTier.features.map((f, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check size={16} className="text-primary mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isAdminRole ? (
                        <Link to="/admin">
                          <Button className="w-full glow-gold-sm" variant="default">
                            Admin Dashboard
                          </Button>
                        </Link>
                      ) : isConsultantRole ? (
                        <Link to="/consultant/dashboard">
                          <Button className="w-full glow-gold-sm" variant="default">
                            Consultant Dashboard
                          </Button>
                        </Link>
                      ) : (
                        <Link to="/booking">
                          <Button className="w-full glow-gold-sm" variant="default">
                            Book Now
                          </Button>
                        </Link>
                      )}
                    </div>
                  </AnimatedSection>
                );
              })()}
              <p className="text-center text-xs text-muted-foreground mt-4">* Prices are indicative and may vary — rates can go higher or lower based on consultant expertise, session complexity, and market conditions.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

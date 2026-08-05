import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import ConsultantsSection from "@/components/home/ConsultantsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import TrustSection from "@/components/home/TrustSection";
import ClosingCTASection from "@/components/home/ClosingCTASection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <ServicesSection />
        <HowItWorksSection />
        <ConsultantsSection />
        <TestimonialsSection />
        <TrustSection />
        <ClosingCTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

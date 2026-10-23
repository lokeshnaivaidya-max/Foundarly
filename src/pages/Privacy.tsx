import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { SEO } from "@/components/SEO";
import { Shield, Lock, Eye, FileText, Mail } from "lucide-react";

const sections = [
  {
    title: "1. Information We Collect",
    body: "When you create an account or book a consultation on Foundarly, we collect basic personal identifying information such as your name, email address, and optional phone number. When submitting a consultation payment via manual UPI transfer, we collect the 12-digit Unique Transaction Reference (UTR) and an optional payment screenshot receipt for administrative verification.",
  },
  {
    title: "2. How We Use Your Information",
    body: "Your information is used strictly to operate the Foundarly platform: scheduling 1-on-1 consultations, dispatching meeting invitations and booking updates via Titan SMTP email, verifying manual UPI payment transfers, enabling secure video access via Agora/WebRTC with a 7-day post-session rejoin window, and providing customer support.",
  },
  {
    title: "3. Manual UPI Payment & Financial Security",
    body: "Foundarly does not collect, process, or store credit/debit card numbers, CVVs, netbanking passwords, or UPI PINs. All payments are initiated by you through your trusted banking or UPI application directly to Foundarly's official merchant accounts. Submitted UTR transaction IDs and receipt screenshots are stored in private, Row Level Security-protected storage buckets solely for payment reconciliation.",
  },
  {
    title: "4. Confidentiality of Video Consultations",
    body: "All consultations occur in secure, peer-to-peer or RTC encrypted rooms. Foundarly does not record, listen to, or store video/audio contents of your 1-on-1 sessions. Any advisory notes or summary documents exchanged between clients and consultants remain strictly confidential.",
  },
  {
    title: "5. Third-Party Service Providers & Sub-processors",
    body: "To provide our services, Foundarly integrates with trusted infrastructure partners: Supabase (cloud database, user authentication, and encrypted asset storage), Agora RTC (real-time video and audio stream communication), and Titan Email / Nodemailer (transactional booking notifications). All sub-processors are bound by strict security and confidentiality obligations.",
  },
  {
    title: "6. No Sale or Commercial Exploitation of Data",
    body: "Foundarly will never sell, rent, monetize, or trade your personal data, consultation details, or transaction records to third-party advertisers or data brokers under any circumstances.",
  },
  {
    title: "7. Cookies & Analytics Preference",
    body: "Foundarly utilizes essential cookies for authentication and session management. Optional analytics cookies are only activated when you explicitly grant consent via our cookie banner. You can update your cookie preferences at any time.",
  },
  {
    title: "8. Data Retention & Account Deletion",
    body: "You have the right to request deletion of your account at any time via the 'Account & Security' panel in My Bookings. Upon deletion, your personal identity and profile details are permanently anonymized. Please note that completed booking audit entries and financial payment receipts must be retained in an anonymized state to satisfy statutory tax, anti-fraud, and accounting compliance obligations.",
  },
  {
    title: "9. Security Contact & Inquiries",
    body: "If you have questions regarding this Privacy Policy, your rights under applicable data protection laws, or wish to report a security inquiry, please contact our data team at hello@foundarlybusinessworld.in.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy - Foundarly"
        description="Learn how Foundarly protects your personal information, session confidentiality, manual UPI verification details, and privacy rights."
        url="https://foundarly.in/privacy"
      />
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Legal &amp; Privacy</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Privacy <span className="text-gradient-gold">Policy</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              Your privacy and confidentiality are central to Foundarly. This policy outlines our technical and organizational data handling practices.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.title} className="bg-gradient-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary shrink-0" />
                    {section.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection className="mt-8">
            <div className="bg-gradient-card border border-border/80 rounded-xl p-5 text-center text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">Operational Notice &amp; Legal Review Flag</p>
              This document reflects Foundarly's actual technical implementation (manual UPI verification, Agora video, Supabase persistence). Final legal compliance should be reviewed by qualified corporate counsel.
              <p className="mt-2 text-muted-foreground/80">© {new Date().getFullYear()} Foundarly Business World. All rights reserved.</p>
            </div>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { SEO } from "@/components/SEO";
import { Users, Briefcase, Video, CreditCard, RotateCcw, AlertTriangle } from "lucide-react";

const clientTerms = [
  {
    title: "1. Eligibility & Platform Registration",
    body: "Users must be at least 18 years of age (or at least 15 with parental/guardian authorization) to register and schedule consultations on Foundarly. You agree to provide accurate, truthful details when creating your account.",
  },
  {
    title: "2. Manual UPI Payment & Verification Workflow",
    body: "Consultation bookings require pre-payment via manual UPI transfer by scanning Foundarly's official QR code or transferring to the designated UPI VPA/bank account. After making the transfer, you must enter the authentic 12-digit UTR (Unique Transaction Reference) number and optionally upload receipt proof. Bookings remain in 'Payment Pending' status until verified and approved by the Foundarly administration team.",
  },
  {
    title: "3. 1-on-1 Video Consultations & 7-Day Rejoin Access",
    body: "Confirmed consultations take place in private video rooms powered by Agora RTC. To provide outstanding mentorship value, Foundarly grants participants access to rejoin the original meeting room for up to 7 calendar days after session completion for follow-up questions and mutual reviews.",
  },
  {
    title: "4. Rescheduling & Cancellation Policy",
    body: "Clients may request to reschedule an upcoming consultation before the scheduled start time through the My Bookings portal. Reschedule requests are submitted directly to the consultant for acceptance. Cancellations submitted prior to administrative payment verification will cancel the booking without charge; verified and completed sessions are non-refundable.",
  },
  {
    title: "5. Refund & Dispute Resolution",
    body: "If a scheduled consultation cannot be delivered due to consultant absence or verified technical platform interruption on Foundarly's infrastructure, clients may submit a dispute through support. Eligible refunds are verified and processed manually by administrators within 5 to 7 business days.",
  },
  {
    title: "6. Code of Conduct & Confidentiality",
    body: "All participants must maintain professional, respectful decorum. Harassment, verbal abuse, intellectual property infringement, or unauthorized distribution of consultation recordings is strictly prohibited and results in immediate account termination.",
  },
];

const consultantTerms = [
  {
    title: "1. Verified Qualifications & Professional Standing",
    body: "Consultants must provide genuine, verifiable credentials, professional background, and domain expertise during the onboarding application. Misleading statements or impersonation are grounds for immediate delisting.",
  },
  {
    title: "2. Independent Professional Contractor Status",
    body: "Consultants provide advisory services as independent contractors and not as employees or legal agents of Foundarly. Consultants are responsible for their own professional advice, tax obligations, and quality of mentorship.",
  },
  {
    title: "3. Session Attendance & Follow-up Support",
    body: "Consultants are expected to join scheduled sessions punctually. When requested by a client within the 7-day post-meeting eligibility period, consultants agree to provide reasonable clarification, follow-up guidance, or session summary notes.",
  },
  {
    title: "4. Non-Circumvention & Platform Integrity",
    body: "To protect community integrity, consultants agree not to solicit clients for off-platform financial transactions or circumvent Foundarly's booking and verification channels for relationships initiated on Foundarly.",
  },
  {
    title: "5. Platform Commission & Payouts (Business Policy Flag)",
    body: "Platform commission is deducted on completed sessions (standard 30% platform fee, subject to the consultant contract agreement). Consultant earnings are accumulated and disbursed via verified payout requests approved by administrators.",
  },
];

function TermsSection({ title, icon: Icon, items, accent }: {
  title: string;
  icon: any;
  items: { title: string; body: string }[];
  accent: string;
}) {
  return (
    <AnimatedSection className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.title} className="bg-gradient-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>
    </AnimatedSection>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Terms & Conditions - Foundarly"
        description="Review the terms and conditions for clients and consultants on Foundarly, including manual UPI payments, session guidelines, and 7-day rejoin access."
        url="https://foundarly.in/terms"
      />
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Terms of Service</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Terms &amp; <span className="text-gradient-gold">Conditions</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              These terms govern your access to Foundarly's 1-on-1 business mentorship platform, manual UPI payments, video sessions, and consultant workflows.
            </p>
          </AnimatedSection>

          <TermsSection
            title="Terms for Clients"
            icon={Users}
            items={clientTerms}
            accent="bg-primary/10 text-primary"
          />

          <TermsSection
            title="Terms for Consultants"
            icon={Briefcase}
            items={consultantTerms}
            accent="bg-amber-500/10 text-amber-500"
          />

          <AnimatedSection>
            <div className="bg-gradient-card border border-border/80 rounded-xl p-5 text-center text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">Business Confirmation Notice</p>
              Platform fee percentages, minimum age thresholds, and commercial payout schedules reflect current platform configuration and remain subject to final confirmation by the platform owner.
              <p className="mt-2 text-muted-foreground/80">© {new Date().getFullYear()} Foundarly Business World. All rights reserved.</p>
            </div>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}

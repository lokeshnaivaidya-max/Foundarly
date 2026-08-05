import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { Users, Briefcase } from "lucide-react";

const userTerms = [
  {
    title: "1. Minimum Age Requirement",
    body: "Users must be at least 15 years old to access and use the Foundarly platform. By using the platform, users confirm that they meet this age requirement.",
  },
  {
    title: "2. Payment Policy",
    body: "Users are required to complete payment before accessing any consultation services on Foundarly. All payments are processed securely through the platform.",
  },
  {
    title: "3. Refund Policy",
    body: "In cases where payment-related issues occur from the Foundarly platform's end, the payment made by the user will be eligible for a refund, subject to internal verification.",
  },
  {
    title: "4. Reviews and Feedback",
    body: "Users are allowed to submit reviews or complaints regarding consultants. Foundarly will review such feedback and, after proper inspection, strict action may be taken against consultants if necessary.",
  },
  {
    title: "5. Tax Responsibility",
    body: "Foundarly is responsible for handling all applicable taxes, including GST and other statutory obligations, where applicable under governing laws.",
  },
  {
    title: "6. Data Privacy and Confidentiality",
    body: "All information shared by users during consultations is treated as confidential. Foundarly does not store sensitive consultation data or sell user data to any third-party entities.",
  },
  {
    title: "7. Dispute Disclaimer",
    body: "Foundarly acts as a platform connecting users and consultants. In the event of disputes between users and consultants, Foundarly is not legally responsible, but will make reasonable efforts to help resolve the issue.",
  },
  {
    title: "8. Respectful Conduct",
    body: "Users must maintain respectful and professional communication with consultants. Any form of abuse, harassment, or inappropriate behavior may result in suspension or termination of the user's account.",
  },
];

const consultantTerms = [
  {
    title: "1. Accurate Information & Portfolio",
    body: "Consultants must provide accurate, up-to-date professional information, including their experience, qualifications, and portfolio. Any false or misleading information may lead to removal from the platform.",
  },
  {
    title: "2. Independent Consultant Status",
    body: "Consultants on Foundarly act as independent professionals and not employees of Foundarly. While being part of the Foundarly community, consultants are responsible for maintaining professionalism and accountability in their services.",
  },
  {
    title: "3. Post-Consultation Documentation",
    body: "After completing a consultation session, consultants are required to provide a summary or report in PDF format, outlining the advice, recommendations, or guidance given to the user.",
  },
  {
    title: "4. No External Relationships",
    body: "Consultants must not create personal business relationships, partnerships, or off-platform transactions with users during or after consultations. All professional interactions must remain within the Foundarly platform.",
  },
  {
    title: "5. Platform Commission",
    body: "Foundarly will charge a 30% platform commission on each completed consultation. The remaining amount will be paid to the consultant according to the platform's payment process.",
  },
];

function TermsSection({ title, icon: Icon, items, accent }: {
  title: string;
  icon: any;
  items: { title: string; body: string }[];
  accent: string;
}) {
  return (
    <AnimatedSection className="mb-16">
      <div className="flex items-center gap-3 mb-8">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.title} className="bg-gradient-card border border-border rounded-lg p-6">
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
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Legal</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Terms &amp; <span className="text-gradient-gold">Conditions</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              These terms are based on the discussion held on 11th March. If there are any changes, please inform within 24 hours.
            </p>
          </AnimatedSection>

          <TermsSection
            title="For Users"
            icon={Users}
            items={userTerms}
            accent="bg-rose-500/10 text-rose-400"
          />

          <TermsSection
            title="For Consultants"
            icon={Briefcase}
            items={consultantTerms}
            accent="bg-primary/10 text-primary"
          />

          <AnimatedSection>
            <div className="bg-gradient-card border border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Foundarly. These terms are subject to change. Users and consultants will be notified of any updates.
            </div>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}

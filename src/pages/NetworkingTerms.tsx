import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";

const terms = [
  {
    title: "1. Purpose & Access",
    body: "The Foundarly Networking Hub is a professional space for entrepreneurs and business owners. It is open to all registered Foundarly users aged 18 and above.",
  },
  {
    title: "2. Respectful Conduct",
    body: "All members are expected to be professional, kind, and supportive. Harassment, hate speech, discrimination, and personal attacks of any kind are strictly prohibited.",
  },
  {
    title: "3. No Spam or Excessive Self-Promotion",
    body: "You may share your business in introductions, but repeatedly promoting products or services, or sending unsolicited sales messages to other members, is not permitted.",
  },
  {
    title: "4. Protect Confidentiality",
    body: "Do not share other members' private information, direct messages, or confidential business details without their explicit permission.",
  },
  {
    title: "5. Quality Advice Disclaimer",
    body: "Advice shared within the community is peer guidance only and does not constitute professional consultation. For critical business decisions, we strongly recommend booking a paid Expert session on Foundarly.",
  },
  {
    title: "6. Content Ownership",
    body: "You retain ownership of the content you post. By posting, you grant Foundarly the right to display it publicly on the platform. Do not share copyrighted or proprietary content without the necessary rights.",
  },
  {
    title: "7. Moderation & Enforcement",
    body: "Foundarly reserves the right to remove content that violates these terms. Members may be warned, suspended, or permanently banned for serious or repeated violations.",
  },
  {
    title: "8. No Liability",
    body: "Foundarly is not responsible for advice shared by members, or for any connections, partnerships, or transactions that arise from community interactions. Always conduct your own due diligence.",
  },
  {
    title: "9. Commercial Activity",
    body: "MLM schemes, pyramid schemes, and using the community primarily as a sales channel are strictly prohibited. Genuine professional networking is encouraged.",
  },
  {
    title: "10. Termination",
    body: "You may leave the community at any time. Foundarly may remove members for violations of these terms. Upon removal, your profile will be deleted; however, posts will remain attributed to 'Former Member'.",
  },
];

export default function NetworkingTermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Legal</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Networking <span className="text-gradient-gold">Community Terms</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              By participating in the Foundarly Networking Hub, you agree to the following terms and community guidelines.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <div className="space-y-4">
              {terms.map((item) => (
                <div key={item.title} className="bg-gradient-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection className="mt-8">
            <div className="bg-gradient-card border border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Foundarly. These community terms are subject to change. Members will be notified of any significant updates.
            </div>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}

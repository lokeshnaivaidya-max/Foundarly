import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";

const sections = [
  {
    title: "1. Information We Collect",
    body: "When you create an account or book a consultation on Foundarly, we collect basic personal information such as your name, email address, and payment details. We also collect usage data to improve the platform experience.",
  },
  {
    title: "2. How We Use Your Information",
    body: "Your information is used solely to operate and improve the Foundarly platform — including processing bookings, facilitating consultations, sending confirmations, and providing customer support. We do not use your data for unrelated purposes.",
  },
  {
    title: "3. Confidentiality of Consultation Data",
    body: "All information shared during consultations is treated as strictly confidential. Foundarly does not store sensitive consultation content or share it with any third parties. Consultants are also bound by confidentiality obligations.",
  },
  {
    title: "4. No Sale of User Data",
    body: "Foundarly does not sell, rent, or trade your personal data to any third-party entities under any circumstances. Your data belongs to you.",
  },
  {
    title: "5. Payment Security",
    body: "All payments are processed through a secure, encrypted payment gateway. Foundarly does not store your card or banking details directly on our servers.",
  },
  {
    title: "6. Data Storage & Security",
    body: "We take reasonable technical and organisational measures to protect your data from unauthorised access, loss, or misuse. Your data is stored on secure servers and access is strictly controlled.",
  },
  {
    title: "7. Cookies",
    body: "Foundarly uses cookies to maintain your session and improve your experience on the platform. You can disable cookies in your browser settings, though some features may not function correctly without them.",
  },
  {
    title: "8. Third-Party Services",
    body: "Foundarly may use trusted third-party services (such as payment processors and analytics tools) to operate the platform. These providers are contractually obligated to handle your data securely and only for the purposes we specify.",
  },
  {
    title: "9. Your Rights",
    body: "You have the right to access, update, or request deletion of your personal data at any time. To exercise these rights, please contact us through the platform support chat.",
  },
  {
    title: "10. Changes to This Policy",
    body: "Foundarly may update this Privacy Policy from time to time. Any significant changes will be communicated to users via email or a notice on the platform. Continued use of the platform after changes constitutes acceptance of the updated policy.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Legal</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Privacy <span className="text-gradient-gold">Policy</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              Your privacy matters to us. This policy explains how Foundarly collects, uses, and protects your personal information.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.title} className="bg-gradient-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-2">{section.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection className="mt-8">
            <div className="bg-gradient-card border border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Foundarly. This policy is subject to change. Users will be notified of any significant updates.
            </div>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}

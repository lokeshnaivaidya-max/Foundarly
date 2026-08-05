import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  canonical?: string;
  structuredData?: object;
}

export function SEO({
  title = 'foundarly - Expert Business Consultation & Professional Consulting Services',
  description = 'Connect with top-rated business consultants for personalized 1-on-1 video consultations. Get expert advice on strategy, growth, marketing, finance, and more.',
  keywords = 'business consultation, expert consultants, business advice, professional consulting, business growth, startup consulting',
  image = 'https://foundarly.in/og-image.jpg',
  url = 'https://foundarly.in',
  type = 'website',
  author = 'foundarly',
  publishedTime,
  modifiedTime,
  noindex = false,
  canonical,
  structuredData,
}: SEOProps) {
  const fullTitle = title.includes('foundarly') ? title : `${title} | foundarly`;
  const canonicalUrl = canonical || url;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="foundarly" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:locale" content="en_US" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:site" content="@foundarly" />
      <meta name="twitter:creator" content="@foundarly" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={fullTitle} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

// Pre-configured SEO for common pages
export const HomeSEO = () => (
  <SEO
    title="foundarly - Expert Business Consultation & Professional Consulting Services"
    description="Connect with top-rated business consultants for personalized 1-on-1 video consultations. Get expert advice on strategy, growth, marketing, finance, and more. Book 30 or 60-minute sessions with verified industry experts."
    keywords="business consultation, expert consultants, business advice, professional consulting, business growth, startup consulting, business strategy, marketing consultant, financial advisor, 1-on-1 consultation"
    url="https://foundarly.in"
    structuredData={{
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "foundarly",
      "url": "https://foundarly.in",
      "logo": "https://foundarly.in/logo.png",
      "description": "Expert business consultation and professional consulting services",
      "sameAs": [
        "https://twitter.com/foundarly",
        "https://linkedin.com/company/foundarly",
        "https://facebook.com/foundarly"
      ]
    }}
  />
);

export const ConsultantsSEO = () => (
  <SEO
    title="Expert Business Consultants - Find Your Perfect Advisor"
    description="Browse our network of verified business consultants. Filter by expertise, pricing, and availability. Book 1-on-1 video consultations with industry experts in strategy, marketing, finance, and more."
    keywords="business consultants, expert advisors, professional consultants, business experts, consultant directory, find consultant, hire consultant"
    url="https://foundarly.in/consultants"
    structuredData={{
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Business Consultants",
      "description": "List of verified business consultants available for consultation",
      "url": "https://foundarly.in/consultants"
    }}
  />
);

export const BookingSEO = () => (
  <SEO
    title="Book a Consultation - Schedule Your Expert Session"
    description="Book a personalized 1-on-1 video consultation with our expert business consultants. Choose 30 or 60-minute sessions. Secure payment via Razorpay. Instant confirmation."
    keywords="book consultation, schedule consultation, book expert session, consultation booking, online consultation, video consultation booking"
    url="https://foundarly.in/booking"
    structuredData={{
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Business Consultation Booking",
      "description": "Book personalized 1-on-1 video consultations with expert business consultants",
      "provider": {
        "@type": "Organization",
        "name": "foundarly"
      },
      "serviceType": "Business Consultation",
      "areaServed": "Worldwide"
    }}
  />
);

export const AboutSEO = () => (
  <SEO
    title="About foundarly - Your Trusted Business Consultation Platform"
    description="Learn about foundarly's mission to connect businesses with expert consultants. Discover our platform, values, and commitment to providing quality professional consulting services."
    keywords="about foundarly, business consultation platform, professional consulting, expert network, consultation services"
    url="https://foundarly.in/about"
  />
);

export const ContactSEO = () => (
  <SEO
    title="Contact Us - Get in Touch with foundarly"
    description="Have questions about our consultation services? Contact foundarly's support team. We're here to help you connect with the right business consultant for your needs."
    keywords="contact foundarly, customer support, consultation help, get in touch, contact support"
    url="https://foundarly.in/contact"
  />
);

export const LoginSEO = () => (
  <SEO
    title="Login - Access Your foundarly Account"
    description="Login to your foundarly account to manage bookings, view consultation history, and connect with expert business consultants."
    url="https://foundarly.in/login"
    noindex={true}
  />
);

export const SignupSEO = () => (
  <SEO
    title="Sign Up - Create Your foundarly Account"
    description="Create a free foundarly account to book consultations with expert business consultants. Get started in minutes and access personalized professional advice."
    url="https://foundarly.in/signup"
    noindex={true}
  />
);

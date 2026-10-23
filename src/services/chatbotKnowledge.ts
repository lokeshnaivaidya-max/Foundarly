/**
 * Foundarly Comprehensive Website Knowledge Base
 * 
 * Source of truth for all public information about Foundarly:
 * - Purpose, mission, how it works
 * - Services, categories, and verified consultants
 * - Pricing, session durations, and referral discounts (INR)
 * - Availability, working windows, buffer times, and blocked dates
 * - Booking instructions and status workflows
 * - Payment methods (UPI, Bank Transfer, Razorpay, UTR verification)
 * - Rescheduling and cancellation policies
 * - Meeting access, scheduled start in IST, 7-day rejoin window, and camera test
 * - Public FAQs, support contact, and navigation
 */

export interface KnowledgeTopic {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  teluguKeywords?: string[];
  summary: string;
  detailedResponse: string;
  suggestedFollowUps: string[];
  actionLinks?: { label: string; url: string }[];
}

export const SUPPORT_EMAIL = 'hello@foundarlybusinessworld.in';
export const PLATFORM_TIMEZONE = 'Asia/Kolkata (IST, UTC+05:30)';

export const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  // 0. GREETING & WELCOME
  {
    id: 'welcome_greeting',
    category: 'About Foundarly',
    title: 'Welcome to Foundarly',
    keywords: [
      'hi', 'hello', 'hey', 'greetings', 'namaste', 'start', 'good morning', 'good afternoon', 'good evening', 'help'
    ],
    teluguKeywords: [
      'namaskaram', 'namaste', 'halo', 'bagunnara', 'hi foundarly'
    ],
    summary: 'Warm greeting and overview of Foundarly Assistant capabilities.',
    detailedResponse:
      `Hello! 👋 Welcome to **Foundarly**.\n\n` +
      `I am your guide for everything on our platform:\n` +
      `• **Consultants**: Browse verified business, tech, marketing, and finance mentors\n` +
      `• **Consultation Fees**: Check transparent 30-min & 60-min session pricing\n` +
      `• **Booking**: Select dates, time slots (IST), and apply referral codes\n` +
      `• **Payments**: UPI QR scan (GPay, PhonePe, Paytm) & Bank Transfer verification\n` +
      `• **Video Meetings**: Browser rooms with lobby countdown & 7-day post-meeting rejoin\n\n` +
      `How can I help you today?`,
    suggestedFollowUps: [
      'How do I book a consultation?',
      'What are the consultation fees?',
      'Which consultants are available?',
      'How does UPI payment work?'
    ],
    actionLinks: [
      { label: 'Browse Consultants', url: '/consultants' },
      { label: 'Book a Session', url: '/booking' }
    ]
  },

  // 1. ABOUT FOUNDARLY
  {
    id: 'about_foundarly',
    category: 'About Foundarly',
    title: 'About Foundarly Platform',
    keywords: [
      'about', 'what is foundarly', 'who are you', 'company', 'mission',
      'foundarly platform', 'overview', 'introduce', 'explain foundarly',
      'purpose', 'vision', 'what does this website do', 'services offered'
    ],
    teluguKeywords: [
      'foundarly ante enti', 'e website enti', 'em chestundi', 'deni gurinchi', 'cheppandi'
    ],
    summary: 'Foundarly is a premier 1-on-1 business mentorship and expert consulting platform.',
    detailedResponse: 
      `**Foundarly** is a premier 1-on-1 business mentorship and executive consulting platform.\n\n` +
      `We connect founders, entrepreneurs, and professionals with verified industry consultants for personalized video consultations in strategy, marketing, technology, finance, and operations.\n\n` +
      `**Core Highlights:**\n` +
      `• Verified industry specialists with proven track records\n` +
      `• Flexible 30-minute and 60-minute video sessions\n` +
      `• Secure browser-based video meeting rooms with screen sharing\n` +
      `• **7-Day Post-Meeting Rejoin Window** for follow-up questions\n` +
      `• Convenient Indian payments via UPI QR scan and Bank Transfer (NEFT/IMPS)\n` +
      `• Professional networking community for startups and consultants`,
    suggestedFollowUps: [
      'How does consultation booking work?',
      'What are the consultation fees?',
      'Which consultants are available?'
    ],
    actionLinks: [
      { label: 'Explore Consultants', url: '/consultants' },
      { label: 'About Us Page', url: '/about' }
    ]
  },

  // 2. HOW IT WORKS
  {
    id: 'how_it_works',
    category: 'About Foundarly',
    title: 'How Foundarly Works',
    keywords: [
      'how it works', 'process', 'steps', 'consultation process', 'procedure',
      'how does it work', 'getting started', 'guide'
    ],
    teluguKeywords: [
      'ela panichestundi', 'steps enti', 'process enti', 'ela use cheyali'
    ],
    summary: 'Simple 4-step process: Discover, Schedule, Pay, and Meet.',
    detailedResponse:
      `Using Foundarly is simple and structured in 4 steps:\n\n` +
      `1. **Discover Your Consultant**: Browse our verified experts by category, experience, and ratings on the [Consultants](/consultants) page.\n` +
      `2. **Choose Slot & Duration**: Pick a 30 or 60-minute session and select an available time slot in India Standard Time (IST).\n` +
      `3. **Complete Payment**: Pay conveniently via UPI (Google Pay, PhonePe, Paytm) or Bank Transfer and submit your 12-digit UTR reference ID.\n` +
      `4. **Join 1-on-1 Video Session**: Upon prompt administrator verification, you receive email confirmation with your dedicated HD video meeting room link!`,
    suggestedFollowUps: [
      'How to book a consultation?',
      'What are the payment options?',
      'How to test my camera and mic?'
    ],
    actionLinks: [
      { label: 'Book a Session', url: '/booking' },
      { label: 'How It Works Guide', url: '/about' }
    ]
  },

  // 3. CONSULTANTS & VERIFICATION
  {
    id: 'consultants_info',
    category: 'Consultants & Experts',
    title: 'Verified Consultants',
    keywords: [
      'consultant', 'consultants', 'experts', 'advisors', 'mentors',
      'who are the consultants', 'verified', 'expert qualifications', 'consultant credentials',
      'find consultant', 'industry experts'
    ],
    teluguKeywords: [
      'consultants evaru', 'experts evaru unnaru', 'consultant unnaara', 'evaru unnaru'
    ],
    summary: 'Verified business leaders, founders, and industry veterans across key domains.',
    detailedResponse:
      `Our consultants are vetted industry professionals, startup founders, and functional leaders across:\n\n` +
      `• **Business Strategy & Growth**: Scaling, pivot planning, business models\n` +
      `• **Marketing & Brand**: Performance marketing, SEO, social media, customer acquisition\n` +
      `• **Technology & Product**: System architecture, software roadmaps, AI integration\n` +
      `• **Finance & Funding**: Pitch preparation, financial forecasting, unit economics\n` +
      `• **Operations & HR**: Team building, leadership, talent acquisition\n\n` +
      `Each consultant profile displays their background, years of experience, languages spoken, client reviews, and hourly rates.`,
    suggestedFollowUps: [
      'Which consultants are available today?',
      'What are the consultation fees?',
      'How can I become a consultant?'
    ],
    actionLinks: [
      { label: 'Browse All Consultants', url: '/consultants' },
      { label: 'Apply as Consultant', url: '/apply-consultant' }
    ]
  },

  // 4. CONSULTATION PRICING
  {
    id: 'pricing_info',
    category: 'Pricing & Plans',
    title: 'Consultation Pricing and Fees',
    keywords: [
      'pricing', 'price', 'fee', 'fees', 'cost', 'charges', 'how much',
      'rate', 'rates', 'inr', 'rupees', '30 min price', '60 min price',
      'consultation cost', 'cheap', 'expensive', 'discount', 'referral'
    ],
    teluguKeywords: [
      'fees entha', 'cost entha', 'entha charge chestaru', 'rate entha', 'amount entha', 'discount unda'
    ],
    summary: 'Transparent pricing in INR per consultant for 30-min and 60-min sessions.',
    detailedResponse:
      `Consultation fees on Foundarly are transparently displayed in **Indian Rupees (INR / ₹)** and depend on the consultant and session length:\n\n` +
      `• **30-Minute Quick Consultation**: Typically starting from **₹900 – ₹1,000**\n` +
      `• **60-Minute Comprehensive Deep Dive**: Typically starting from **₹1,299 – ₹1,800**\n\n` +
      `**Key Pricing Rules:**\n` +
      `• Rates are validated server-side to guarantee integrity.\n` +
      `• You can enter a valid **Referral Code** during booking for instant discounts.\n` +
      `• Changes to consultant fees apply only to future bookings — historical bookings always retain their original booked price.`,
    suggestedFollowUps: [
      'How do I apply a referral code?',
      'What payment methods are accepted?',
      'Book a consultation now'
    ],
    actionLinks: [
      { label: 'View Pricing Table', url: '/pricing' },
      { label: 'Book a Session', url: '/booking' }
    ]
  },

  // 5. CONSULTANT AVAILABILITY & WORKING HOURS
  {
    id: 'availability_schedule',
    category: 'Availability & Scheduling',
    title: 'Consultant Availability & Time Slots',
    keywords: [
      'availability', 'available', 'schedule', 'working hours', 'timing', 'slots',
      'time slots', 'time zone', 'ist', 'weekdays', 'holidays', 'blocked dates',
      'when are you open', 'morning slots', 'evening slots', 'buffer'
    ],
    teluguKeywords: [
      'epudu available', 'timings enti', 'slots unnaya', 'time slots eppudu', 'repu available unnaara'
    ],
    summary: 'Consultants configure custom weekly windows and rest buffers in India Standard Time (IST).',
    detailedResponse:
      `All appointments on Foundarly operate in **India Standard Time (IST: UTC+05:30)**.\n\n` +
      `**Availability Features:**\n` +
      `• **Multi-window Working Hours**: Consultants configure morning (e.g. 10:00 AM – 1:00 PM) and evening shifts (e.g. 3:00 PM – 6:00 PM).\n` +
      `• **Live Slot Generation**: When you pick a date on the booking page, available slots are generated dynamically in real time.\n` +
      `• **Double-Booking Protection**: Booked slots are locked immediately so two clients cannot book the same slot.\n` +
      `• **Holidays & Off Days**: Blocked dates and off days are clearly labeled so you never book an unavailable date.\n` +
      `• **15-Minute Buffer**: For today's date, slots starting within 15 minutes cannot be booked to ensure readiness.`,
    suggestedFollowUps: [
      'How to book a specific time slot?',
      'Can I reschedule if I miss my time?',
      'Check consultant working hours'
    ],
    actionLinks: [
      { label: 'Select Slots & Book', url: '/booking' },
      { label: 'View Consultants', url: '/consultants' }
    ]
  },

  // 6. BOOKING PROCESS & STATUSES
  {
    id: 'booking_process',
    category: 'Booking & Reservations',
    title: 'Booking Instructions & Booking Statuses',
    keywords: [
      'how to book', 'book', 'booking', 'reserve', 'schedule appointment',
      'booking steps', 'booking status', 'pending', 'confirmed', 'my bookings',
      'find my booking', 'where is my booking'
    ],
    teluguKeywords: [
      'ela book cheyali', 'booking ela cheskovali', 'booking status ela chudali', 'status enti'
    ],
    summary: 'Book easily online and track status under My Bookings.',
    detailedResponse:
      `**How to Book a Consultation:**\n` +
      `1. Visit the [Booking Page](/booking).\n` +
      `2. Select your consultant, duration (30 or 60 min), date, and available time slot.\n` +
      `3. Fill in your name, email, and consultation topic.\n` +
      `4. Submit and complete your payment on the UPI confirmation page.\n\n` +
      `**Booking Status Meaning:**\n` +
      `• **Pending**: Booking created; awaiting payment proof verification.\n` +
      `• **Confirmed**: Payment verified! Your video meeting room is unlocked.\n` +
      `• **Completed**: Session concluded. 7-day rejoin and review submission unlocked.\n` +
      `• **Cancelled / Rejected**: Appointment cancelled; slot released.\n\n` +
      `You can check all your appointments at any time under [My Bookings](/my-bookings).`,
    suggestedFollowUps: [
      'Where do I enter UPI transaction ID?',
      'How to join the video meeting?',
      'How do I cancel or reschedule?'
    ],
    actionLinks: [
      { label: 'Book a Session', url: '/booking' },
      { label: 'My Bookings', url: '/my-bookings' }
    ]
  },

  // 7. PAYMENTS, UPI & BANK TRANSFER
  {
    id: 'payments_upi',
    category: 'Payments & Billing',
    title: 'Payment Methods & Manual Verification',
    keywords: [
      'payment', 'pay', 'upi', 'qr code', 'gpay', 'phonepe', 'paytm',
      'bank transfer', 'utr', 'transaction id', 'reference id', 'verify payment',
      'payment verification', 'manual review', 'account number', 'ifsc'
    ],
    teluguKeywords: [
      'payment ela cheyali', 'upi unda', 'qr code ekkada', 'payment success ayindi', 'utr ekkada ivvali'
    ],
    summary: 'Pay securely via UPI QR scan (GPay, PhonePe, Paytm) or NEFT/IMPS bank transfer.',
    detailedResponse:
      `Foundarly supports convenient, verified Indian payment methods with transparent manual administrator review:\n\n` +
      `**1. UPI Payment (Recommended):**\n` +
      `• Scan the official UPI QR Code on the [UPI Payment Page](/upi-payment) using any UPI app (Google Pay, PhonePe, Paytm, BHIM).\n` +
      `• Official UPI ID: **aagarwal1019@oksbi** (Account Holder: Abhishek Agarwal).\n\n` +
      `**2. Direct Bank Transfer (NEFT / IMPS):**\n` +
      `• Bank: Kotak Mahindra Bank | Champapet Branch\n` +
      `• Account No: **4549460820** | IFSC: **KKBK0007474**\n\n` +
      `**Verification Workflow:**\n` +
      `• After payment, submit your **12-digit UPI UTR / Bank Reference Number** on the payment page.\n` +
      `• Our administration team reviews and verifies transactions (typically within 10–30 minutes during business hours).\n` +
      `• Once verified, your booking updates to Confirmed and your video meeting link is dispatched via email and unlocked under [My Bookings](/my-bookings).`,
    suggestedFollowUps: [
      'What if my payment is not verified yet?',
      'Can I get a refund?',
      'View my pending payments'
    ],
    actionLinks: [
      { label: 'Payment Page', url: '/upi-payment' },
      { label: 'My Bookings', url: '/my-bookings' }
    ]
  },

  // 8. RESCHEDULING & CANCELLATIONS
  {
    id: 'reschedule_cancel',
    category: 'Policies & Changes',
    title: 'Rescheduling and Cancellation Policies',
    keywords: [
      'reschedule', 'change time', 'change date', 'cancel', 'cancellation',
      'postpone', 'refund', 'refund policy', 'can i cancel', 'money back'
    ],
    teluguKeywords: [
      'time change cheyavacha', 'reschedule ela', 'cancel cheyavacha', 'refund vastunda', 'date marchukovaccha'
    ],
    summary: 'Submit reschedule requests directly from My Bookings for consultant approval.',
    detailedResponse:
      `**Rescheduling Your Session:**\n` +
      `• You can request a reschedule directly from [My Bookings](/my-bookings) by clicking **Reschedule**.\n` +
      `• Propose a new date and available time slot for the consultant.\n` +
      `• The consultant reviews the request. Your original session time remains active until the consultant approves the new timing.\n` +
      `• Duplicate reschedule requests are prevented while a request is pending.\n\n` +
      `**Cancellation & Refunds:**\n` +
      `• If you need to cancel, contact support at **hello@foundarlybusinessworld.in** or use the cancellation option under My Bookings before session start.\n` +
      `• For verified cancellations made at least 24 hours in advance, refunds are processed according to our [Terms of Service](/terms).`,
    suggestedFollowUps: [
      'How to view my bookings?',
      'Contact support email',
      'What if the consultant does not join?'
    ],
    actionLinks: [
      { label: 'Manage in My Bookings', url: '/my-bookings' },
      { label: 'Terms & Policies', url: '/terms' }
    ]
  },

  // 9. VIDEO MEETINGS & 7-DAY REJOIN
  {
    id: 'meetings_rejoin',
    category: 'Meetings & Video',
    title: 'Meeting Rooms & 7-Day Rejoin Window',
    keywords: [
      'meeting', 'video call', 'room', 'join', 'link', 'countdown', 'lobby',
      'camera', 'microphone', 'rejoin', '7 day', '7-day', 'post meeting',
      'agora', 'webrtc', 'screen share', 'join meeting'
    ],
    teluguKeywords: [
      'meeting ela join avvali', 'video call ela', 'camera ravatledhu', 'meeting link ekkada', 'join avvatledhu'
    ],
    summary: 'Join in-browser video calls with screen sharing and a 7-day post-meeting rejoin window.',
    detailedResponse:
      `**Joining Your Consultation Meeting:**\n` +
      `• Access your room at \`/meeting/:roomId\` or directly from [My Bookings](/my-bookings) by clicking **Join Meeting**.\n` +
      `• No software downloads required — calls run directly in your browser with WebRTC and Agora HD audio/video.\n` +
      `• The room countdown unlocks **5 minutes before the scheduled start time (IST)**.\n` +
      `• When you join the lobby, the consultant receives an instant notification.\n\n` +
      `**Exclusive 7-Day Post-Meeting Rejoin:**\n` +
      `• After a session ends, your meeting room remains open for **7 full days**!\n` +
      `• Re-enter the room anytime within 7 days to clarify discussion points, review shared action items, or ask follow-up questions.\n\n` +
      `**Testing Devices:**\n` +
      `• Use our free [Camera & Mic Test](/camera-test) tool before joining to ensure your devices work smoothly.`,
    suggestedFollowUps: [
      'Test camera and microphone',
      'What if video or audio is not working?',
      'Where is my meeting room link?'
    ],
    actionLinks: [
      { label: 'Camera & Mic Test', url: '/camera-test' },
      { label: 'My Bookings', url: '/my-bookings' }
    ]
  },

  // 10. TROUBLESHOOTING & TECHNICAL HELP
  {
    id: 'troubleshooting',
    category: 'Troubleshooting & Support',
    title: 'Troubleshooting Meetings & Browser Permissions',
    keywords: [
      'troubleshoot', 'issue', 'problem', 'not working', 'camera not working',
      'mic not working', 'black screen', 'echo', 'permission denied',
      'cannot join', 'error', 'audio issue', 'video issue'
    ],
    teluguKeywords: [
      'panicheyatledu', 'problem vastondi', 'camera error', 'sound ravatledu', 'mic issue'
    ],
    summary: 'Quick fixes for browser permissions, camera/mic access, and network connection.',
    detailedResponse:
      `**Common Troubleshooting Fixes:**\n\n` +
      `1. **Camera / Mic Permission Denied:**\n` +
      `   • Click the lock/settings icon in your browser address bar.\n` +
      `   • Set Camera and Microphone to **Allow**, then refresh the page.\n\n` +
      `2. **Test Devices Prior to Call:**\n` +
      `   • Visit our [Camera Test](/camera-test) page to test video feed and microphone levels.\n\n` +
      `3. **Supported Browsers:**\n` +
      `   • Use recent versions of Google Chrome, Firefox, Apple Safari, or Microsoft Edge.\n\n` +
      `4. **Meeting Link Not Opening:**\n` +
      `   • Check [My Bookings](/my-bookings) to verify your booking status is **Confirmed**.\n` +
      `   • If still encountering issues, contact us at **hello@foundarlybusinessworld.in**.`,
    suggestedFollowUps: [
      'Open Camera Test page',
      'Check my booking status',
      'Contact support email'
    ],
    actionLinks: [
      { label: 'Camera Test Page', url: '/camera-test' },
      { label: 'Support Email', url: 'mailto:hello@foundarlybusinessworld.in' }
    ]
  },

  // 11. REVIEWS & TESTIMONIALS
  {
    id: 'reviews_feedback',
    category: 'Reviews & Community',
    title: 'Client Reviews and Ratings',
    keywords: [
      'review', 'reviews', 'rating', 'feedback', 'testimonial', 'testimonials',
      'how to give review', 'rate consultant', 'star rating'
    ],
    teluguKeywords: [
      'review ela ivvali', 'rating ela', 'feedback ivvacha'
    ],
    summary: 'Completed sessions allow clients to submit verified 1-to-5 star ratings.',
    detailedResponse:
      `After your consultation session is marked as **Completed**, you can share your feedback:\n\n` +
      `• Visit the review link: \`/review/:bookingId\` or navigate to your completed booking in [My Bookings](/my-bookings).\n` +
      `• Submit a 1 to 5 star rating and honest written review.\n` +
      `• Verified reviews help maintain the highest standard of consulting quality across Foundarly.`,
    suggestedFollowUps: [
      'How to book another consultation?',
      'View verified consultant testimonials',
      'Check completed bookings'
    ],
    actionLinks: [
      { label: 'My Bookings', url: '/my-bookings' },
      { label: 'Testimonials on Home', url: '/home' }
    ]
  },

  // 12. BECOME A CONSULTANT
  {
    id: 'apply_consultant',
    category: 'Consultants & Experts',
    title: 'Become a Consultant on Foundarly',
    keywords: [
      'become a consultant', 'apply', 'join as consultant', 'consultant application',
      'work as consultant', 'teach', 'mentor on foundarly', 'hiring consultants',
      'consultant signup'
    ],
    teluguKeywords: [
      'consultant ga ela apply cheyali', 'join avvacha', 'nenu kuda consult cheyavacha'
    ],
    summary: 'Apply to join Foundarly roster and monetize your specialized expertise.',
    detailedResponse:
      `Are you an industry veteran, founder, or subject matter expert? You can apply to offer paid consultations on Foundarly!\n\n` +
      `**How to Apply:**\n` +
      `1. Visit the [Apply as Consultant](/apply-consultant) page.\n` +
      `2. Submit your background, domain expertise, LinkedIn profile, and session rate expectations.\n` +
      `3. Our leadership team reviews every application within **3 to 5 business days**.\n` +
      `4. Once approved, you gain access to the **Consultant Dashboard** to set your schedule, availability windows, and manage earnings.`,
    suggestedFollowUps: [
      'Open consultant application form',
      'What are the fees for consultants?',
      'About the platform'
    ],
    actionLinks: [
      { label: 'Apply as Consultant', url: '/apply-consultant' },
      { label: 'About Foundarly', url: '/about' }
    ]
  },

  // 13. PROFESSIONAL NETWORKING HUB
  {
    id: 'networking_hub',
    category: 'Networking & Community',
    title: 'Professional Networking Hub',
    keywords: [
      'network', 'networking', 'hub', 'channels', 'groups', 'community',
      'startup showcase', 'chat with members', 'connect'
    ],
    teluguKeywords: [
      'networking ante enti', 'community unda', 'groups unnaya'
    ],
    summary: 'Join topic channels, peer groups, and showcase your startup to other professionals.',
    detailedResponse:
      `The **Foundarly Network Hub** connects professionals, entrepreneurs, and mentors in an interactive community space:\n\n` +
      `• **Topic Channels**: Discuss business trends, marketing, technology, and funding.\n` +
      `• **Peer Groups**: Collaborate with industry peers facing similar growth challenges.\n` +
      `• **Startup Showcase**: Present your company or product to gain visibility and feedback.\n` +
      `• Read our [Networking Terms](/networking-terms) to ensure a safe, collaborative environment.`,
    suggestedFollowUps: [
      'Open the Network Hub',
      'Read networking guidelines',
      'How to book a consultant'
    ],
    actionLinks: [
      { label: 'Visit Network Hub', url: '/network' },
      { label: 'Networking Terms', url: '/networking-terms' }
    ]
  },

  // 14. CONTACT & CUSTOMER SUPPORT
  {
    id: 'contact_support',
    category: 'Contact & Support',
    title: 'Contact Support & Help Desk',
    keywords: [
      'contact', 'support', 'help', 'email', 'phone', 'customer care',
      'reach out', 'complaint', 'assistance', 'talk to human'
    ],
    teluguKeywords: [
      'contact number enti', 'support email enti', 'ela contact avvali', 'help kavali'
    ],
    summary: 'Get in touch with Foundarly support at hello@foundarlybusinessworld.in.',
    detailedResponse:
      `Our dedicated customer support team is here to assist you:\n\n` +
      `• **Official Support Email**: [hello@foundarlybusinessworld.in](mailto:hello@foundarlybusinessworld.in)\n` +
      `• **Business Hours**: Monday to Saturday, 9:00 AM – 7:00 PM IST\n` +
      `• **Response Time**: Usually within 2 to 4 hours (maximum 24 hours)\n` +
      `• **Headquarters**: India (Operating globally)\n\n` +
      `For quick answers to common questions, you can also review our comprehensive [FAQs](/faqs) page.`,
    suggestedFollowUps: [
      'View FAQs',
      'Read Terms of Service',
      'Book a consultation'
    ],
    actionLinks: [
      { label: 'Send an Email', url: 'mailto:hello@foundarlybusinessworld.in' },
      { label: 'Browse FAQs', url: '/faqs' }
    ]
  },

  // 15. WEBSITE NAVIGATION & SITEMAP
  {
    id: 'navigation_sitemap',
    category: 'Website Navigation',
    title: 'Website Pages & Navigation',
    keywords: [
      'pages', 'navigation', 'links', 'where is', 'sitemap', 'menu', 'browse'
    ],
    teluguKeywords: [
      'pages ekkada unnayi', 'links enti'
    ],
    summary: 'Quick guide to all publicly accessible sections of Foundarly.',
    detailedResponse:
      `Here is a quick navigation guide to Foundarly's main sections:\n\n` +
      `• **[Home & Overview](/)**: Hero, featured consultants, services, and client testimonials\n` +
      `• **[Consultants Directory](/consultants)**: Full roster of verified advisors with search & filters\n` +
      `• **[Book a Session](/booking)**: Step-by-step appointment scheduling with dynamic slots\n` +
      `• **[My Bookings](/my-bookings)**: Track your active, completed, or pending consultations\n` +
      `• **[Pricing & Plans](/pricing)**: Transparent consultation session tiers in INR\n` +
      `• **[Network Hub](/network)**: Professional channels, groups, and startup showcase\n` +
      `• **[Blog & Insights](/blog)**: Articles on leadership, strategy, and business growth\n` +
      `• **[Camera & Mic Test](/camera-test)**: Free hardware diagnostic tool for meetings\n` +
      `• **[Apply as Consultant](/apply-consultant)**: Application portal to join our expert roster\n` +
      `• **[FAQs](/faqs)**: Answers to frequent questions on booking, payments, and meetings`,
    suggestedFollowUps: [
      'Browse Consultants',
      'Book a consultation',
      'How to contact support'
    ],
    actionLinks: [
      { label: 'Consultants Directory', url: '/consultants' },
      { label: 'Pricing Overview', url: '/pricing' }
    ]
  }
];

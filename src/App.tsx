import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { getMeetingRedirect, clearMeetingRedirect } from "@/utils/meetingRedirect";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AIChatWidget from "@/components/AIChatWidget";
import { CookieConsent } from "@/components/CookieConsent";
import { PaymentRealtimeListener } from "@/components/PaymentRealtimeListener";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

// Eager load primary landing page for maximum initial load performance
import Index from "./pages/Index";

// Lazy-load secondary and role-specific routes with resilient retry and chunk recovery
const Consultants = lazyWithRetry(() => import("./pages/Consultants"), { pageName: "Consultants" });
const Booking = lazyWithRetry(() => import("./pages/Booking"), { pageName: "Booking" });
const MyBookings = lazyWithRetry(() => import("./pages/MyBookings"), { pageName: "MyBookings" });
const NetworkHub = lazyWithRetry(() => import("./pages/NetworkHub"), { pageName: "NetworkHub" });
const ChannelView = lazyWithRetry(() => import("./pages/ChannelView"), { pageName: "ChannelView" });
const Pricing = lazyWithRetry(() => import("./pages/Pricing"), { pageName: "Pricing" });
const About = lazyWithRetry(() => import("./pages/About"), { pageName: "About" });
const Blog = lazyWithRetry(() => import("./pages/Blog"), { pageName: "Blog" });
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"), { pageName: "BlogPost" });
const FAQs = lazyWithRetry(() => import("./pages/FAQs"), { pageName: "FAQs" });
const Login = lazyWithRetry(() => import("./pages/Login"), { pageName: "Login" });
const ResetPasswordPage = lazyWithRetry(() => import("./pages/ResetPassword"), { pageName: "ResetPassword" });
const AdminLoginPage = lazyWithRetry(() => import("./pages/AdminLogin"), { pageName: "AdminLogin" });
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), { pageName: "NotFound" });
const ApplyConsultant = lazyWithRetry(() => import("./pages/ApplyConsultant"), { pageName: "ApplyConsultant" });
const Terms = lazyWithRetry(() => import("./pages/Terms"), { pageName: "Terms" });
const Privacy = lazyWithRetry(() => import("./pages/Privacy"), { pageName: "Privacy" });
const NetworkingTerms = lazyWithRetry(() => import("./pages/NetworkingTerms"), { pageName: "NetworkingTerms" });
const Meeting = lazyWithRetry(() => import("./pages/Meeting"), { pageName: "Meeting" });
const CameraTest = lazyWithRetry(() => import("./pages/CameraTest"), { pageName: "CameraTest" });
const Review = lazyWithRetry(() => import("./pages/Review"), { pageName: "Review" });
const UPIPaymentPage = lazyWithRetry(() => import("./pages/UPIPayment"), { pageName: "UPIPayment" });
const ConsultantDashboard = lazyWithRetry(() => import("./pages/ConsultantDashboard"), { pageName: "ConsultantDashboard" });
const ConsultantProfile = lazyWithRetry(() => import("./pages/ConsultantProfile"), { pageName: "ConsultantProfile" });

// Lazy-load Admin routes with resilient retry
const AdminLayout = lazyWithRetry(() => import("./components/admin/AdminLayout"), { pageName: "AdminLayout" });
const AdminOverview = lazyWithRetry(() => import("./pages/admin/AdminOverview"), { pageName: "AdminOverview" });
const AdminContent = lazyWithRetry(() => import("./pages/admin/AdminContent"), { pageName: "AdminContent" });
const AdminTestimonials = lazyWithRetry(() => import("./pages/admin/AdminTestimonials"), { pageName: "AdminTestimonials" });
const AdminConsultants = lazyWithRetry(() => import("./pages/admin/AdminConsultants"), { pageName: "AdminConsultants" });
const AdminAvailabilityPricing = lazyWithRetry(() => import("./pages/admin/AdminAvailabilityPricing"), { pageName: "AdminAvailabilityPricing" });
const AdminBookings = lazyWithRetry(() => import("./pages/admin/AdminBookings"), { pageName: "AdminBookings" });
const AdminBlog = lazyWithRetry(() => import("./pages/admin/AdminBlog"), { pageName: "AdminBlog" });
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"), { pageName: "AdminUsers" });
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"), { pageName: "AdminSettings" });
const AdminFAQs = lazyWithRetry(() => import("./pages/admin/AdminFAQs"), { pageName: "AdminFAQs" });
const AdminPricing = lazyWithRetry(() => import("./pages/admin/AdminPricing"), { pageName: "AdminPricing" });
const AdminNetworkingChannels = lazyWithRetry(() => import("./pages/admin/AdminNetworkingChannels"), { pageName: "AdminNetworkingChannels" });
const AdminNetworkingGroups = lazyWithRetry(() => import("./pages/admin/AdminNetworkingGroups"), { pageName: "AdminNetworkingGroups" });
const AdminNetworkingMessages = lazyWithRetry(() => import("./pages/admin/AdminNetworkingMessages"), { pageName: "AdminNetworkingMessages" });
const AdminNetworkingShowcases = lazyWithRetry(() => import("./pages/admin/AdminNetworkingShowcases"), { pageName: "AdminNetworkingShowcases" });
const AdminNetworkingReports = lazyWithRetry(() => import("./pages/admin/AdminNetworkingReports"), { pageName: "AdminNetworkingReports" });
const AdminConsultantApplications = lazyWithRetry(() => import("./pages/admin/AdminConsultantApplications"), { pageName: "AdminConsultantApplications" });
const AdminCategories = lazyWithRetry(() => import("./pages/admin/AdminCategories"), { pageName: "AdminCategories" });
const AdminReferrals = lazyWithRetry(() => import("./pages/admin/AdminReferrals"), { pageName: "AdminReferrals" });
const DeveloperPortal = lazyWithRetry(() => import("./pages/admin/DeveloperPortal"), { pageName: "DeveloperPortal" });
const AdminAdministrators = lazyWithRetry(() => import("./pages/admin/AdminAdministrators"), { pageName: "AdminAdministrators" });
const AdminPayouts = lazyWithRetry(() => import("./pages/admin/AdminPayouts"), { pageName: "AdminPayouts" });
const AdminPayments = lazyWithRetry(() => import("./pages/admin/AdminPayments"), { pageName: "AdminPayments" });
const UPIVerification = lazyWithRetry(() => import("./pages/admin/UPIVerification"), { pageName: "UPIVerification" });

import { RolePreviewProvider } from "@/contexts/RolePreviewContext";
import RolePreviewBanner from "@/components/RolePreviewBanner";

const queryClient = new QueryClient();

function MeetingRedirectHandler() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    if (location.pathname === '/' || location.pathname === '/home') {
      const meetingTarget = getMeetingRedirect(location.state, location.search);
      if (meetingTarget) {
        clearMeetingRedirect();
        navigate(meetingTarget, { replace: true });
      }
    }
  }, [user, loading, location.pathname, location.search, location.state, navigate]);

  return null;
}

function CanonicalDomainEnforcer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hostname = window.location.hostname;
    // Exempt local development and preview environments
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.run.app')
    ) {
      return;
    }

    // Already on the official canonical production domain
    if (hostname === 'www.foundarlybusinessworld.in') {
      return;
    }

    if (
      hostname === 'foundarlybusinessworld.in' ||
      hostname === 'foundarly-delta.vercel.app' ||
      hostname.endsWith('.vercel.app') ||
      hostname === 'foundarly.com' ||
      hostname === 'www.foundarly.com'
    ) {
      const canonicalOrigin = 'https://www.foundarlybusinessworld.in';
      const target = canonicalOrigin + window.location.pathname + window.location.search + window.location.hash;
      window.location.replace(target);
    }
  }, []);

  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <CanonicalDomainEnforcer />
                  <MeetingRedirectHandler />
                  <RolePreviewProvider>
                    <RolePreviewBanner />
                    <PaymentRealtimeListener />
                    <AIChatWidget />
                    <CookieConsent />
                    <Suspense fallback={<PageLoader text="Loading..." />}>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/home" element={<Index />} />
                        <Route path="/consultants" element={<Consultants />} />
                        <Route path="/consultants/:id" element={<ConsultantProfile />} />
                        <Route path="/consultant/profile/:id" element={<ConsultantProfile />} />
                        <Route path="/booking" element={<Booking />} />
                        <Route path="/my-bookings" element={
                          <ProtectedRoute>
                            <MyBookings />
                          </ProtectedRoute>
                        } />
                        <Route path="/consultant" element={
                          <ProtectedRoute allowedRoles={['consultant', 'admin']}>
                            <ConsultantDashboard />
                          </ProtectedRoute>
                        } />
                        <Route path="/consultant/dashboard" element={
                          <ProtectedRoute allowedRoles={['consultant', 'admin']}>
                            <ConsultantDashboard />
                          </ProtectedRoute>
                        } />
                        <Route path="/consultant-dashboard" element={
                          <ProtectedRoute allowedRoles={['consultant', 'admin']}>
                            <ConsultantDashboard />
                          </ProtectedRoute>
                        } />
                        <Route path="/network" element={
                          <ProtectedRoute>
                            <NetworkHub />
                          </ProtectedRoute>
                        } />
                        <Route path="/network/channel/:id" element={<ChannelView />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:id" element={<BlogPost />} />
                        <Route path="/faqs" element={<FAQs />} />
                        <Route path="/apply-consultant" element={<ApplyConsultant />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/networking-terms" element={<NetworkingTerms />} />
                        <Route path="/camera-test" element={<CameraTest />} />
                        <Route path="/meeting/:roomId" element={<Meeting />} />
                        <Route path="/meeting/booking/:bookingId" element={<Meeting />} />
                        <Route path="/review/:bookingId" element={<Review />} />
                        <Route path="/upi-payment" element={<UPIPaymentPage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/admin/login" element={<AdminLoginPage />} />
                        <Route
                          path="/admin"
                          element={
                            <ProtectedRoute requireAdmin>
                              <AdminLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<AdminOverview />} />
                          <Route path="developer" element={<DeveloperPortal />} />
                          <Route path="developer/logs" element={<DeveloperPortal defaultTab="logs" />} />
                          <Route path="administrators" element={<ProtectedRoute requireSuperAdmin><AdminAdministrators /></ProtectedRoute>} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="settings" element={<AdminSettings />} />
                          <Route path="pricing" element={<AdminPricing />} />
                          <Route path="bookings" element={<AdminBookings />} />
                          <Route path="payouts" element={<AdminPayouts />} />
                          <Route path="payments" element={<AdminPayments />} />
                          <Route path="upi-verification" element={<UPIVerification />} />
                          <Route path="consultants" element={<AdminConsultants />} />
                          <Route path="availability-pricing" element={<AdminAvailabilityPricing />} />
                          <Route path="consultation-settings" element={<AdminAvailabilityPricing />} />
                          <Route path="consultant-applications" element={<AdminConsultantApplications />} />
                          <Route path="content" element={<AdminContent />} />
                          <Route path="categories" element={<AdminCategories />} />
                          <Route path="referrals" element={<AdminReferrals />} />
                          <Route path="testimonials" element={<AdminTestimonials />} />
                          <Route path="blog" element={<AdminBlog />} />
                          <Route path="faqs" element={<AdminFAQs />} />
                          <Route path="networking/channels" element={<AdminNetworkingChannels />} />
                          <Route path="networking/groups" element={<AdminNetworkingGroups />} />
                          <Route path="networking/messages" element={<AdminNetworkingMessages />} />
                          <Route path="networking/showcases" element={<AdminNetworkingShowcases />} />
                          <Route path="networking/reports" element={<AdminNetworkingReports />} />
                        </Route>
                        <Route path="/404" element={<NotFound />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </RolePreviewProvider>
                </BrowserRouter>
              </TooltipProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

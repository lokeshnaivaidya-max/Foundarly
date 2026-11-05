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

// Eager load primary landing page for maximum initial load performance
import Index from "./pages/Index";

// Lazy-load secondary and role-specific routes with React.lazy
const Consultants = lazy(() => import("./pages/Consultants"));
const Booking = lazy(() => import("./pages/Booking"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const NetworkHub = lazy(() => import("./pages/NetworkHub"));
const ChannelView = lazy(() => import("./pages/ChannelView"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const FAQs = lazy(() => import("./pages/FAQs"));
const Login = lazy(() => import("./pages/Login"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const AdminLoginPage = lazy(() => import("./pages/AdminLogin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ApplyConsultant = lazy(() => import("./pages/ApplyConsultant"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NetworkingTerms = lazy(() => import("./pages/NetworkingTerms"));
const Meeting = lazy(() => import("./pages/Meeting"));
const CameraTest = lazy(() => import("./pages/CameraTest"));
const Review = lazy(() => import("./pages/Review"));
const UPIPaymentPage = lazy(() => import("./pages/UPIPayment"));
const ConsultantDashboard = lazy(() => import("./pages/ConsultantDashboard"));
const ConsultantProfile = lazy(() => import("./pages/ConsultantProfile"));

// Lazy-load Admin routes
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminTestimonials = lazy(() => import("./pages/admin/AdminTestimonials"));
const AdminConsultants = lazy(() => import("./pages/admin/AdminConsultants"));
const AdminAvailabilityPricing = lazy(() => import("./pages/admin/AdminAvailabilityPricing"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminFAQs = lazy(() => import("./pages/admin/AdminFAQs"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminNetworkingChannels = lazy(() => import("./pages/admin/AdminNetworkingChannels"));
const AdminNetworkingGroups = lazy(() => import("./pages/admin/AdminNetworkingGroups"));
const AdminNetworkingMessages = lazy(() => import("./pages/admin/AdminNetworkingMessages"));
const AdminNetworkingShowcases = lazy(() => import("./pages/admin/AdminNetworkingShowcases"));
const AdminNetworkingReports = lazy(() => import("./pages/admin/AdminNetworkingReports"));
const AdminConsultantApplications = lazy(() => import("./pages/admin/AdminConsultantApplications"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));
const DeveloperPortal = lazy(() => import("./pages/admin/DeveloperPortal"));
const AdminAdministrators = lazy(() => import("./pages/admin/AdminAdministrators"));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const UPIVerification = lazy(() => import("./pages/admin/UPIVerification"));

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

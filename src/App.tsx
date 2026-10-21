import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AIChatWidget from "@/components/AIChatWidget";
import { CookieConsent } from "@/components/CookieConsent";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Consultants from "./pages/Consultants";
import Booking from "./pages/Booking";
import MyBookings from "./pages/MyBookings";
import NetworkHub from "./pages/NetworkHub";
import ChannelView from "./pages/ChannelView";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import FAQs from "./pages/FAQs";
import Login from "./pages/Login";
import AdminLoginPage from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminContent from "./pages/admin/AdminContent";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminConsultants from "./pages/admin/AdminConsultants";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminBlog from "./pages/admin/AdminBlog";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminFAQs from "./pages/admin/AdminFAQs";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminNetworkingChannels from "./pages/admin/AdminNetworkingChannels";
import AdminNetworkingGroups from "./pages/admin/AdminNetworkingGroups";
import AdminNetworkingMessages from "./pages/admin/AdminNetworkingMessages";
import AdminNetworkingShowcases from "./pages/admin/AdminNetworkingShowcases";
import AdminNetworkingReports from "./pages/admin/AdminNetworkingReports";
import AdminConsultantApplications from "./pages/admin/AdminConsultantApplications";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminReferrals from "./pages/admin/AdminReferrals";
import DeveloperPortal from "./pages/admin/DeveloperPortal";
import AdminAdministrators from "./pages/admin/AdminAdministrators";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminPayments from "./pages/admin/AdminPayments";
import UPIVerification from "./pages/admin/UPIVerification";
import ApplyConsultant from "./pages/ApplyConsultant";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NetworkingTerms from "./pages/NetworkingTerms";
import Meeting from "./pages/Meeting";
import CameraTest from "./pages/CameraTest";
import Review from "./pages/Review";
import UPIPaymentPage from "./pages/UPIPayment";
import ConsultantDashboard from "./pages/ConsultantDashboard";
import ConsultantProfile from "./pages/ConsultantProfile";

import { RolePreviewProvider } from "@/contexts/RolePreviewContext";
import RolePreviewBanner from "@/components/RolePreviewBanner";

const queryClient = new QueryClient();

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
                  <RolePreviewProvider>
                    <RolePreviewBanner />
                    <AIChatWidget />
                    <CookieConsent />
                    <Routes>
                    <Route path="/" element={<Consultants />} />
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
                    <Route path="/review/:bookingId" element={<Review />} />
                    <Route path="/upi-payment" element={<UPIPaymentPage />} />
                    <Route path="/login" element={<Login />} />
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
                      <Route path="users" element={<ProtectedRoute requireSuperAdmin><AdminUsers /></ProtectedRoute>} />
                      <Route path="settings" element={<ProtectedRoute requireSuperAdmin><AdminSettings /></ProtectedRoute>} />
                      <Route path="pricing" element={<ProtectedRoute requireSuperAdmin><AdminPricing /></ProtectedRoute>} />
                      <Route path="bookings" element={<ProtectedRoute requireSuperAdmin><AdminBookings /></ProtectedRoute>} />
                      <Route path="payouts" element={<ProtectedRoute requireSuperAdmin><AdminPayouts /></ProtectedRoute>} />
                      <Route path="payments" element={<ProtectedRoute requireSuperAdmin><AdminPayments /></ProtectedRoute>} />
                      <Route path="upi-verification" element={<ProtectedRoute requireSuperAdmin><UPIVerification /></ProtectedRoute>} />
                      <Route path="consultants" element={<ProtectedRoute requireSuperAdmin><AdminConsultants /></ProtectedRoute>} />
                      <Route path="consultant-applications" element={<ProtectedRoute requireSuperAdmin><AdminConsultantApplications /></ProtectedRoute>} />
                      <Route path="content" element={<ProtectedRoute requireSuperAdmin><AdminContent /></ProtectedRoute>} />
                      <Route path="categories" element={<ProtectedRoute requireSuperAdmin><AdminCategories /></ProtectedRoute>} />
                      <Route path="referrals" element={<ProtectedRoute requireSuperAdmin><AdminReferrals /></ProtectedRoute>} />
                      <Route path="testimonials" element={<ProtectedRoute requireSuperAdmin><AdminTestimonials /></ProtectedRoute>} />
                      <Route path="blog" element={<AdminBlog />} />
                      <Route path="faqs" element={<AdminFAQs />} />
                      <Route path="networking/channels" element={<ProtectedRoute requireSuperAdmin><AdminNetworkingChannels /></ProtectedRoute>} />
                      <Route path="networking/groups" element={<ProtectedRoute requireSuperAdmin><AdminNetworkingGroups /></ProtectedRoute>} />
                      <Route path="networking/messages" element={<ProtectedRoute requireSuperAdmin><AdminNetworkingMessages /></ProtectedRoute>} />
                      <Route path="networking/showcases" element={<ProtectedRoute requireSuperAdmin><AdminNetworkingShowcases /></ProtectedRoute>} />
                      <Route path="networking/reports" element={<ProtectedRoute requireSuperAdmin><AdminNetworkingReports /></ProtectedRoute>} />
                    </Route>
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
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

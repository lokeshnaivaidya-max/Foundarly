import { useState, useEffect } from "react";
import { 
  CalendarCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users, 
  UserCheck, 
  IndianRupee, 
  CreditCard,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import { supabase } from "@/lib/supabase";
import { bookingsService } from "@/services/bookings";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function AdminOverview() {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    totalUsers: 0,
    totalConsultants: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });

  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    console.log("[AdminOverview] fetchDashboardData called");
    try {
      // 1. Fetch Bookings using bookingsService.getAll()
      console.log('[AdminOverview] Fetching bookings via bookingsService.getAll()...');
      const bookings = await bookingsService.getAll();
      console.log('[AdminOverview] Loaded bookings count:', bookings.length);

      const totalBookings = bookings.length;
      const pendingBookings = bookings.filter(b => b.status === 'pending').length;
      const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
      const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

      // Calculate total revenue from paid/confirmed bookings
      const totalRevenue = bookings
        .filter(b => b.payment_status === 'paid' || b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + Number(b.session_price || 0), 0);

      // 2. Fetch UPI Payments
      let pendingPaymentsCount = 0;
      let paymentsList: any[] = [];
      try {
        const { data: paymentsData, error: paymentsErr } = await supabase
          .from('upi_payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (!paymentsErr && paymentsData) {
          paymentsList = paymentsData;
          pendingPaymentsCount = paymentsData.filter(p => p.status === 'pending').length;
        }
      } catch (err) {
        console.warn("UPI payments query warning:", err);
      }

      // 3. Fetch Consultants Count
      let consultantsCount = 0;
      try {
        const { count, error: consultantsErr } = await supabase
          .from('consultants')
          .select('*', { count: 'exact', head: true });
        
        if (!consultantsErr && count !== null) {
          consultantsCount = count;
        }
      } catch (err) {
        console.warn("Consultants query warning:", err);
      }

      // 4. Fetch Profiles / Users Count
      let usersCount = 0;
      try {
        const { count, error: usersErr } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (!usersErr && count !== null) {
          usersCount = count;
        }
      } catch (err) {
        console.warn("Profiles query warning:", err);
      }

      setStats({
        totalBookings,
        pendingBookings,
        confirmedBookings,
        cancelledBookings,
        totalUsers: usersCount,
        totalConsultants: consultantsCount,
        totalRevenue,
        pendingPayments: pendingPaymentsCount,
      });

      setRecentBookings(bookings.slice(0, 5));
      setRecentPayments(paymentsList.slice(0, 5));
    } catch (error) {
      console.error("Failed to load admin dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log("[AdminOverview] useEffect fired");
    fetchDashboardData();

    // Subscribe to realtime changes in bookings and upi_payments
    const bookingsChannel = supabase
      .channel('admin-dashboard-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upi_payments' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const statCardsData = [
    {
      label: "Total Bookings",
      value: String(stats.totalBookings),
      icon: CalendarCheck,
      trend: "All-time bookings",
    },
    {
      label: "Pending Bookings",
      value: String(stats.pendingBookings),
      icon: Clock,
      trend: "Awaiting confirmation",
    },
    {
      label: "Confirmed Bookings",
      value: String(stats.confirmedBookings),
      icon: CheckCircle2,
      trend: "Scheduled & active",
    },
    {
      label: "Cancelled Bookings",
      value: String(stats.cancelledBookings),
      icon: XCircle,
      trend: "Cancelled sessions",
    },
    {
      label: "Total Users",
      value: String(stats.totalUsers),
      icon: Users,
      trend: "Registered accounts",
    },
    {
      label: "Total Consultants",
      value: String(stats.totalConsultants),
      icon: UserCheck,
      trend: "Active advisors",
    },
    {
      label: "Total Revenue",
      value: formatPrice(stats.totalRevenue),
      icon: IndianRupee,
      trend: "Verified earnings",
    },
    {
      label: "Pending Payments",
      value: String(stats.pendingPayments),
      icon: CreditCard,
      trend: "Needs verification",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time analytics and live statistics from Supabase database.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCardsData.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Recent Bookings</h2>
              <p className="text-xs text-muted-foreground">Latest consultation requests</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary"
              onClick={() => navigate("/admin/bookings")}
            >
              View All
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Loading recent bookings...</div>
          ) : recentBookings.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              No bookings submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b) => (
                <div 
                  key={b.id} 
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-background transition-colors cursor-pointer"
                  onClick={() => navigate("/admin/bookings")}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.date).toLocaleDateString()} at {b.time}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold text-primary">{formatPrice(b.session_price || 0)}</p>
                    <Badge variant="outline" className={`text-[10px] uppercase ${
                      b.status === "confirmed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                      b.status === "pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    }`}>
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payment Submissions */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Pending Payment Verifications</h2>
              <p className="text-xs text-muted-foreground">Submitted transaction details</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary"
              onClick={() => navigate("/admin/bookings")}
            >
              Manage
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Loading recent payments...</div>
          ) : recentPayments.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              No pending payment submissions.
            </div>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((p) => (
                <div 
                  key={p.id} 
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-background transition-colors cursor-pointer"
                  onClick={() => navigate("/admin/bookings")}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{p.customer_name}</p>
                      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                        {p.transaction_id.slice(0, 10)}...
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.customer_email}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold text-primary">{formatPrice(p.payment_amount)}</p>
                    <Badge variant="outline" className={`text-[10px] uppercase ${
                      p.status === "verified" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                      p.status === "pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    }`}>
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

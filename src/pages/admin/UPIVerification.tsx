import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { upiPaymentService, UPIPayment } from "@/services/upiPayment";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  Eye,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function UPIVerificationPage() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

  const [payments, setPayments] = useState<UPIPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<UPIPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<UPIPayment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    loadPayments();
    loadStats();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [payments, searchQuery, statusFilter]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await upiPaymentService.getAllPayments();
      setPayments(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await upiPaymentService.getPaymentStats();
      setStats(data);
    } catch (error: any) {
      console.error("Failed to load stats:", error);
    }
  };

  const filterPayments = () => {
    let filtered = [...payments];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.customer_name.toLowerCase().includes(query) ||
        p.customer_email.toLowerCase().includes(query) ||
        p.customer_phone.includes(query) ||
        p.transaction_id.toLowerCase().includes(query)
      );
    }

    setFilteredPayments(filtered);
  };

  const handleViewDetails = (payment: UPIPayment) => {
    setSelectedPayment(payment);
    setAdminNotes(payment.admin_notes || "");
    setShowDetailsModal(true);
  };

  const handleVerify = async () => {
    if (!selectedPayment || !user) return;

    setVerifying(true);
    try {
      await upiPaymentService.verifyPayment(
        selectedPayment.id,
        user.id,
        adminNotes
      );

      toast.success("Payment verified successfully!");
      setShowDetailsModal(false);
      loadPayments();
      loadStats();
    } catch (error: any) {
      toast.error(error.message || "Failed to verify payment");
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !user) return;

    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setVerifying(true);
    try {
      await upiPaymentService.rejectPayment(
        selectedPayment.id,
        user.id,
        adminNotes
      );

      toast.success("Payment rejected");
      setShowDetailsModal(false);
      loadPayments();
      loadStats();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject payment");
    } finally {
      setVerifying(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Customer Name",
      "Email",
      "Phone",
      "Transaction ID",
      "Amount",
      "Status",
      "Verified At",
    ];

    const rows = filteredPayments.map(p => [
      new Date(p.created_at).toLocaleDateString(),
      p.customer_name,
      p.customer_email,
      p.customer_phone,
      p.transaction_id,
      p.payment_amount,
      p.status,
      p.verified_at ? new Date(p.verified_at).toLocaleDateString() : "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upi-payments-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredPayments.length} payments`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Pending</Badge>;
      case 'verified':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Verified</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">UPI Payment Verification</h1>
        <p className="text-muted-foreground">
          Verify and manage UPI payment requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-6 border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6 border-red-500/30 bg-red-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-6 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(stats.totalAmount)}</p>
            </div>
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or transaction ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {(['all', 'pending', 'verified', 'rejected'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredPayments.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Payments Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Transaction ID</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No payments found
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <motion.tr
                    key={payment.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b hover:bg-secondary/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="text-sm">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(payment.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{payment.customer_name}</div>
                      <div className="text-sm text-muted-foreground">{payment.customer_email}</div>
                    </td>
                    <td className="p-4">
                      <code className="text-sm bg-secondary px-2 py-1 rounded">
                        {payment.transaction_id}
                      </code>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-primary">
                        {formatPrice(payment.payment_amount)}
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(payment)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Review and verify payment information
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(selectedPayment.status)}
              </div>

              {/* Customer Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedPayment.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedPayment.customer_phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedPayment.customer_email}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Transaction ID</p>
                    <code className="text-sm bg-secondary px-2 py-1 rounded block mt-1">
                      {selectedPayment.transaction_id}
                    </code>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="text-xl font-bold text-primary mt-1">
                      {formatPrice(selectedPayment.payment_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{selectedPayment.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted On</p>
                    <p className="font-medium">
                      {new Date(selectedPayment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Booking Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Session Duration</p>
                    <p className="font-medium">{selectedPayment.session_duration} minutes</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Booking Date</p>
                    <p className="font-medium">{selectedPayment.booking_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Booking Time</p>
                    <p className="font-medium">{selectedPayment.booking_time}</p>
                  </div>
                </div>
                {selectedPayment.booking_message && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Message</p>
                    <p className="text-sm bg-secondary p-3 rounded">
                      {selectedPayment.booking_message}
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              {selectedPayment.status === 'pending' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Admin Notes
                  </label>
                  <Textarea
                    placeholder="Add verification notes or rejection reason..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              )}

              {/* Existing Notes (if verified/rejected) */}
              {selectedPayment.status !== 'pending' && selectedPayment.admin_notes && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Admin Notes</label>
                  <p className="text-sm bg-secondary p-3 rounded">
                    {selectedPayment.admin_notes}
                  </p>
                  {selectedPayment.verified_at && (
                    <p className="text-xs text-muted-foreground">
                      {selectedPayment.status === 'verified' ? 'Verified' : 'Rejected'} on{' '}
                      {new Date(selectedPayment.verified_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              {selectedPayment.status === 'pending' && (
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify Payment
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={verifying}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Payment
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

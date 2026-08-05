import React, { useState, useEffect } from "react";
import { upiPaymentService, UPIPayment } from "@/services/upiPayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileImage,
  RefreshCw,
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  ExternalLink,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface AdminPaymentHistoryProps {
  className?: string;
}

export const AdminPaymentHistory: React.FC<AdminPaymentHistoryProps> = ({ className = "" }) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<UPIPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  
  const [selectedPayment, setSelectedPayment] = useState<UPIPayment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await upiPaymentService.getAllPayments();
      setPayments(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    paymentId: string, 
    newStatus: 'verified' | 'rejected' | 'pending',
    notes?: string
  ) => {
    try {
      setActionLoading(true);
      toast.loading(`Updating payment status to ${newStatus}...`, { id: "update-status" });
      
      await upiPaymentService.updatePaymentStatus(
        paymentId,
        newStatus,
        notes || adminNotes
      );

      toast.success(`Payment marked as ${newStatus}!`, { id: "update-status" });
      setShowModal(false);
      setSelectedPayment(null);
      setAdminNotes("");
      await fetchPayments();
    } catch (error: any) {
      toast.error(error.message || "Failed to update payment status", { id: "update-status" });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      p.customer_name?.toLowerCase().includes(q) ||
      p.customer_email?.toLowerCase().includes(q) ||
      p.customer_phone?.includes(q) ||
      p.transaction_id?.toLowerCase().includes(q) ||
      p.booking_id?.toLowerCase().includes(q);

    return matchesStatus && matchesQuery;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Verified
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20">
            <XCircle className="w-3.5 h-3.5 mr-1" /> Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
            <Clock className="w-3.5 h-3.5 mr-1" /> Pending
          </Badge>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header & Controls */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Manual Payment Records
              </CardTitle>
              <CardDescription>
                View and verify UPI transactions, screenshots, and payment status updates.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchPayments}
              disabled={loading}
              className="self-start sm:self-auto gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, transaction ID, booking ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border text-xs font-medium">
              <Filter className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
              {(['all', 'pending', 'verified', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-md transition-all capitalize ${
                    statusFilter === st
                      ? 'bg-background shadow-xs text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p>Loading payment history...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-12 text-center border rounded-xl bg-muted/10">
              <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium text-foreground">No payments found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium text-xs uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Transaction / UTR ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Proof</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div>{p.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{p.customer_email}</div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {p.transaction_id || "N/A"}
                      </td>

                      <td className="px-4 py-3 font-medium text-foreground">
                        ₹{p.payment_amount}
                      </td>

                      <td className="px-4 py-3">
                        {getStatusBadge(p.status)}
                      </td>

                      <td className="px-4 py-3">
                        {p.proof_url ? (
                          <button
                            onClick={() => {
                              setSelectedImage(p.proof_url!);
                              setShowImageModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                          >
                            <FileImage className="w-3.5 h-3.5" /> View
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(p);
                            setAdminNotes(p.admin_notes || "");
                            setShowModal(true);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Review
                        </Button>

                        {p.status === 'pending' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2.5"
                              onClick={() => handleUpdateStatus(p.id, 'verified')}
                            >
                              Verify
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={() => handleUpdateStatus(p.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Payment Details & Verification</span>
              {selectedPayment && getStatusBadge(selectedPayment.status)}
            </DialogTitle>
            <DialogDescription>
              Review customer details and payment confirmation.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border">
                <div>
                  <span className="text-xs text-muted-foreground block">Customer Name</span>
                  <span className="font-medium">{selectedPayment.customer_name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Amount</span>
                  <span className="font-semibold text-primary">₹{selectedPayment.payment_amount}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Transaction / UTR ID</span>
                  <span className="font-mono text-xs font-bold">{selectedPayment.transaction_id}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Booking ID</span>
                  <span className="font-mono text-xs truncate block">{selectedPayment.booking_id || "N/A"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Email</span>
                  <span className="text-xs truncate block">{selectedPayment.customer_email}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Phone</span>
                  <span className="text-xs">{selectedPayment.customer_phone || "N/A"}</span>
                </div>
              </div>

              {selectedPayment.proof_url && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Payment Screenshot Proof</span>
                  <div className="border rounded-xl p-2 bg-black/5 dark:bg-white/5 text-center">
                    <img
                      src={selectedPayment.proof_url}
                      alt="Proof"
                      className="max-h-48 mx-auto rounded-lg object-contain cursor-pointer"
                      onClick={() => {
                        setSelectedImage(selectedPayment.proof_url!);
                        setShowImageModal(true);
                      }}
                    />
                    <a
                      href={selectedPayment.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Open full size in new tab
                    </a>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Admin Notes / Reason</span>
                <Textarea
                  placeholder="Optional notes or rejection reason..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Close
            </Button>

            {selectedPayment && (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(selectedPayment.id, 'rejected')}
                >
                  Reject Payment
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(selectedPayment.id, 'verified')}
                >
                  Verify & Approve
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-2xl p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Payment Screenshot</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="p-2 text-center">
              <img
                src={selectedImage}
                alt="Payment Screenshot Full"
                className="max-h-[75vh] mx-auto rounded-lg object-contain shadow-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentHistory;

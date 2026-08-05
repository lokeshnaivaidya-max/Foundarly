import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, CheckCircle, XCircle, Clock, Eye, 
  Filter, Search, Download, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { motion } from "framer-motion";

interface PayoutRequest {
  id: string;
  consultant_id: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_details: any;
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
  consultants?: {
    name: string;
    email: string;
    user_id: string;
  };
}

export default function AdminPayouts() {
  const { formatPrice } = useCurrency();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      // Check if payout_requests table exists first
      const { data, error } = await supabase
        .from("payout_requests")
        .select(`
          *,
          consultants (
            name,
            email,
            user_id
          )
        `)
        .order("requested_at", { ascending: false });

      if (error) {
        // If table doesn't exist, show helpful message
        if (error.code === 'PGRST116' || error.message?.includes('relation "payout_requests" does not exist')) {
          console.warn("Payout requests table not found. Database migration needed.");
          setPayouts([]);
          toast.info("Payout system not set up yet. Please run database migrations.");
          return;
        }
        throw error;
      }
      
      setPayouts(data || []);
    } catch (error) {
      console.error("Error loading payouts:", error);
      
      // Check if it's a missing table error
      if (error.message?.includes('relation "payout_requests" does not exist')) {
        setPayouts([]);
        toast.info("Payout system not set up yet. Please run database migrations.");
      } else {
        toast.error("Failed to load payout requests");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (payoutId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        admin_notes: adminNotes || null,
      };

      if (newStatus === "approved" || newStatus === "paid") {
        updateData.processed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("payout_requests")
        .update(updateData)
        .eq("id", payoutId);

      if (error) throw error;

      toast.success(`Payout ${newStatus}`);
      setDetailsOpen(false);
      setSelectedPayout(null);
      setAdminNotes("");
      loadPayouts();
    } catch (error) {
      console.error("Error updating payout:", error);
      toast.error("Failed to update payout");
    }
  };

  const openDetails = (payout: PayoutRequest) => {
    setSelectedPayout(payout);
    setAdminNotes(payout.admin_notes || "");
    setDetailsOpen(true);
  };

  const filteredPayouts = payouts.filter((payout) => {
    const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
    const matchesSearch = 
      payout.consultants?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.consultants?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    pending: payouts.filter(p => p.status === "pending").length,
    approved: payouts.filter(p => p.status === "approved").length,
    paid: payouts.filter(p => p.status === "paid").length,
    rejected: payouts.filter(p => p.status === "rejected").length,
    totalPending: payouts
      .filter(p => p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0),
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Payout Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage consultant withdrawal requests
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
              Pending
            </Badge>
          </div>
          <p className="text-2xl font-bold">{stats.pending}</p>
          <p className="text-sm text-muted-foreground">
            {formatPrice(stats.totalPending)} total
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-5 w-5 text-blue-500" />
            <Badge variant="outline" className="text-blue-500 border-blue-500">
              Approved
            </Badge>
          </div>
          <p className="text-2xl font-bold">{stats.approved}</p>
          <p className="text-sm text-muted-foreground">Ready to pay</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <Badge variant="outline" className="text-green-500 border-green-500">
              Paid
            </Badge>
          </div>
          <p className="text-2xl font-bold">{stats.paid}</p>
          <p className="text-sm text-muted-foreground">Completed</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <Badge variant="outline" className="text-destructive border-destructive">
              Rejected
            </Badge>
          </div>
          <p className="text-2xl font-bold">{stats.rejected}</p>
          <p className="text-sm text-muted-foreground">Declined</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by consultant name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payouts List */}
      <div className="space-y-4">
        {filteredPayouts.length === 0 ? (
          <Card className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">No payout requests</h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter !== "all" 
                ? `No ${statusFilter} payout requests found`
                : "Payout requests will appear here"}
            </p>
            {payouts.length === 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-blue-600 mb-2">
                  <strong>Database Setup Required</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Run the consultant earnings system migration to enable payout requests.
                  Check the database folder for setup instructions.
                </p>
              </div>
            )}
          </Card>
        ) : (
          filteredPayouts.map((payout, index) => (
            <motion.div
              key={payout.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-bold text-lg">
                        {payout.consultants?.name || "Unknown Consultant"}
                      </h3>
                      <Badge
                        variant={
                          payout.status === "paid" ? "default" :
                          payout.status === "approved" ? "outline" :
                          payout.status === "rejected" ? "destructive" :
                          "secondary"
                        }
                      >
                        {payout.status === "paid" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {payout.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                        {payout.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-bold text-lg text-primary">
                          {formatPrice(payout.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Method</p>
                        <p className="font-medium capitalize">
                          {payout.payment_method.replace("_", " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">
                          {payout.consultants?.email || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Requested</p>
                        <p className="font-medium">
                          {new Date(payout.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {payout.admin_notes && (
                      <div className="mt-3 p-3 bg-secondary rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Admin Note:</span> {payout.admin_notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDetails(payout)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Details
                    </Button>
                    {payout.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(payout.id, "approved")}
                          className="gap-2 bg-blue-500 hover:bg-blue-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDetails(payout)}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    {payout.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(payout.id, "paid")}
                        className="gap-2 bg-green-500 hover:bg-green-600"
                      >
                        <DollarSign className="h-4 w-4" />
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payout Request Details</DialogTitle>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-6">
              {/* Consultant Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Consultant</Label>
                  <p className="font-bold text-lg">
                    {selectedPayout.consultants?.name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">
                    {selectedPayout.consultants?.email || "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-bold text-xl text-primary">
                    {formatPrice(selectedPayout.amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className="mt-1">{selectedPayout.status}</Badge>
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Payment Method: {selectedPayout.payment_method.replace("_", " ")}
                </Label>
                <Card className="p-4 bg-secondary">
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(selectedPayout.payment_details, null, 2)}
                  </pre>
                </Card>
              </div>

              {/* Admin Notes */}
              <div>
                <Label htmlFor="notes">Admin Notes</Label>
                <Textarea
                  id="notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this payout request..."
                  className="mt-2"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailsOpen(false);
                    setSelectedPayout(null);
                    setAdminNotes("");
                  }}
                >
                  Cancel
                </Button>
                {selectedPayout.status === "pending" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus(selectedPayout.id, "rejected")}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedPayout.id, "approved")}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                  </>
                )}
                {selectedPayout.status === "approved" && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedPayout.id, "paid")}
                    className="gap-2 bg-green-500 hover:bg-green-600"
                  >
                    <DollarSign className="h-4 w-4" />
                    Mark as Paid
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

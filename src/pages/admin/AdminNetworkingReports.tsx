import { useState, useEffect } from "react";
import { Search, CheckCircle, XCircle, Eye, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { adminNetworkingService } from "@/services/adminNetworking";
import { toast } from "sonner";

export default function AdminNetworkingReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await adminNetworkingService.getAllReports();
      setReports(data);
    } catch (error: any) {
      console.error('Error loading reports in AdminNetworkingReports:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        fullError: error,
      });
      toast.error(`Failed to load reports: ${error?.message || error?.details || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (report: any, status: 'resolved' | 'dismissed') => {
    try {
      await adminNetworkingService.updateReportStatus(report.id, status);
      toast.success(`Report ${status}`);
      loadReports();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error("Failed to update status");
    }
  };

  const deleteReportedContent = async (report: any) => {
    try {
      if (report.message_id) {
        await adminNetworkingService.deleteMessageAdmin(report.message_id);
        await adminNetworkingService.updateReportStatus(report.id, 'resolved');
        toast.success("Message deleted and report resolved");
      } else if (report.showcase_id) {
        await adminNetworkingService.deleteShowcaseAdmin(report.showcase_id);
        await adminNetworkingService.updateReportStatus(report.id, 'resolved');
        toast.success("Showcase deleted and report resolved");
      }
      loadReports();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error("Failed to delete content");
    }
  };

  const filtered = reports.filter((r) =>
    r.reason.toLowerCase().includes(search.toLowerCase()) ||
    r.reporter?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading reports...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Content Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {reports.filter(r => r.status === 'pending').length} pending reports
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Reporter</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Reason</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Reported</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="text-sm font-medium">
                  {report.reporter?.full_name || 'Unknown'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {report.message_id ? 'Message' : 'Showcase'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {report.reason}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      report.status === 'resolved' ? 'default' :
                      report.status === 'dismissed' ? 'secondary' :
                      'destructive'
                    }
                    className="text-xs"
                  >
                    {report.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(report.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedReport(report);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {report.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReportedContent(report)}
                          title="Delete Content & Resolve"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(report, 'resolved')}
                          title="Mark Resolved"
                        >
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(report, 'dismissed')}
                          title="Dismiss"
                        >
                          <XCircle className="h-4 w-4 text-orange-400" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View Report Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Report Details</DialogTitle>
            <DialogDescription>Review reported content and take action</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Reporter:</span>
                  <p className="font-medium">{selectedReport.reporter?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium">{selectedReport.message_id ? 'Message' : 'Showcase'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{selectedReport.status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Reported:</span>
                  <p className="font-medium">{new Date(selectedReport.created_at).toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground text-sm">Reason:</span>
                <div className="mt-2 p-4 bg-secondary/30 rounded-lg">
                  <p className="text-sm">{selectedReport.reason}</p>
                </div>
              </div>

              {selectedReport.message && (
                <div>
                  <span className="text-muted-foreground text-sm">Reported Message:</span>
                  <div className="mt-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedReport.message.content}</p>
                  </div>
                </div>
              )}

              {selectedReport.showcase && (
                <div>
                  <span className="text-muted-foreground text-sm">Reported Showcase:</span>
                  <div className="mt-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="font-semibold text-sm">{selectedReport.showcase.startup_name}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

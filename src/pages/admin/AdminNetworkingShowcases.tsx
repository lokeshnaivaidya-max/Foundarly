import { useState, useEffect } from "react";
import { Search, Trash2, CheckCircle, XCircle, Star, StarOff, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminNetworkingService } from "@/services/adminNetworking";
import { toast } from "sonner";

export default function AdminNetworkingShowcases() {
  const [showcases, setShowcases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadShowcases();
  }, []);

  const loadShowcases = async () => {
    try {
      const data = await adminNetworkingService.getAllShowcasesAdmin();
      setShowcases(data);
    } catch (error: any) {
      console.error('Error loading showcases in AdminNetworkingShowcases:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        fullError: error,
      });
      toast.error(`Failed to load showcases: ${error?.message || error?.details || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedShowcase) return;

    setSaving(true);
    try {
      await adminNetworkingService.deleteShowcaseAdmin(selectedShowcase.id);
      toast.success("Showcase deleted successfully");
      setDeleteDialogOpen(false);
      loadShowcases();
    } catch (error) {
      console.error('Error deleting showcase:', error);
      toast.error("Failed to delete showcase");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (showcase: any, status: 'pending' | 'approved' | 'rejected') => {
    try {
      await adminNetworkingService.updateShowcaseStatus(showcase.id, status);
      toast.success(`Showcase ${status}`);
      loadShowcases();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error("Failed to update status");
    }
  };

  const toggleFeatured = async (showcase: any) => {
    try {
      await adminNetworkingService.featureShowcase(showcase.id, !showcase.is_featured);
      toast.success(`Showcase ${showcase.is_featured ? 'unfeatured' : 'featured'}`);
      loadShowcases();
    } catch (error) {
      console.error('Error toggling featured:', error);
      toast.error("Failed to update featured status");
    }
  };

  const filtered = showcases.filter((s) =>
    s.startup_name.toLowerCase().includes(search.toLowerCase()) ||
    s.industry?.toLowerCase().includes(search.toLowerCase()) ||
    s.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading showcases...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Startup Showcases</h1>
        <p className="text-sm text-muted-foreground mt-1">{showcases.length} total showcases</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search showcases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Startup</TableHead>
              <TableHead className="text-xs">Industry</TableHead>
              <TableHead className="text-xs">Posted By</TableHead>
              <TableHead className="text-xs">Channel</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((showcase) => (
              <TableRow key={showcase.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {showcase.is_featured && <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />}
                    <div>
                      <div className="font-medium text-sm">{showcase.startup_name}</div>
                      {showcase.website && (
                        <a
                          href={showcase.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Visit
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {showcase.industry}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {showcase.profiles?.full_name || 'Unknown'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    #{showcase.channels?.name || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      showcase.status === 'approved' ? 'default' :
                      showcase.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }
                    className="text-xs"
                  >
                    {showcase.status || 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(showcase.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {showcase.status !== 'approved' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(showcase, 'approved')}
                        title="Approve"
                      >
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      </Button>
                    )}
                    {showcase.status !== 'rejected' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(showcase, 'rejected')}
                        title="Reject"
                      >
                        <XCircle className="h-4 w-4 text-red-400" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFeatured(showcase)}
                      title={showcase.is_featured ? "Unfeature" : "Feature"}
                    >
                      {showcase.is_featured ? (
                        <StarOff className="h-4 w-4 text-yellow-400" />
                      ) : (
                        <Star className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedShowcase(showcase);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Showcase?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the showcase for "{selectedShowcase?.startup_name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Search, Trash2, Ban, CheckCircle } from "lucide-react";
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

export default function AdminNetworkingGroups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await adminNetworkingService.getAllGroupsAdmin();
      setGroups(data);
    } catch (error: any) {
      console.error('Error loading groups in AdminNetworkingGroups:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        fullError: error,
      });
      toast.error(`Failed to load groups: ${error?.message || error?.details || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGroup) return;

    setSaving(true);
    try {
      await adminNetworkingService.deleteGroupAdmin(selectedGroup.id);
      toast.success("Group deleted successfully");
      setDeleteDialogOpen(false);
      loadGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error("Failed to delete group");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (group: any) => {
    try {
      await adminNetworkingService.toggleGroupStatus(group.id, !group.is_disabled);
      toast.success(`Group ${group.is_disabled ? 'enabled' : 'disabled'}`);
      loadGroups();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error("Failed to update status");
    }
  };

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.category?.toLowerCase().includes(search.toLowerCase()) ||
    g.creator?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading groups...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">User Groups</h1>
        <p className="text-sm text-muted-foreground mt-1">{groups.length} total groups</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Group Name</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Created By</TableHead>
              <TableHead className="text-xs">Members</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium text-sm">{group.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {group.category || 'General'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {group.creator?.full_name || 'Unknown'}
                </TableCell>
                <TableCell className="text-sm">{group.member_count || 0}</TableCell>
                <TableCell>
                  <Badge variant={group.is_private ? "secondary" : "outline"} className="text-xs">
                    {group.is_private ? "Private" : "Public"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={group.is_disabled ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {group.is_disabled ? "Disabled" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(group.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatus(group)}
                      title={group.is_disabled ? "Enable" : "Disable"}
                    >
                      {group.is_disabled ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <Ban className="h-4 w-4 text-orange-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedGroup(group);
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
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the group "{selectedGroup?.name}" and all its content.
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

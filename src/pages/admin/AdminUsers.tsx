import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { profilesService } from "@/services/profiles";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/database.types";

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'client'>('client');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await profilesService.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (user: Profile) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      await profilesService.updateRole(selectedUser.id, newRole);
      toast({ 
        title: "Updated", 
        description: `User role updated to ${newRole}` 
      });
      setDialogOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) =>
    (u.full_name?.toLowerCase().includes(search.toLowerCase()) || false) ||
    u.id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} registered users</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">User ID</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Joined</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-sm font-medium">{u.full_name || 'No name'}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{u.id.slice(0, 8)}...</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${
                    u.role === "admin" ? "bg-red-500/15 text-red-400 border-red-500/30" : 
                    "bg-muted text-muted-foreground"
                  }`}>
                    {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-primary"
                    onClick={() => openEdit(u)}
                  >
                    Edit Role
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Update User Role</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Change the role for {selectedUser?.full_name || 'this user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>User Role</Label>
              <Select 
                value={newRole} 
                onValueChange={(value: any) => setNewRole(value)}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin: Full access to admin panel<br/>
                Client: Regular user access
              </p>
            </div>

            {selectedUser && (
              <div className="bg-secondary/30 p-3 rounded-lg space-y-1 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {selectedUser.full_name || 'No name'}</p>
                <p><span className="text-muted-foreground">Current Role:</span> {selectedUser.role}</p>
                <p><span className="text-muted-foreground">User ID:</span> {selectedUser.id.slice(0, 16)}...</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="glow-gold-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

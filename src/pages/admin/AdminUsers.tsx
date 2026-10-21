import { Search, ShieldCheck, Terminal, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profilesService } from "@/services/profiles";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/lib/database.types";
import type { UserRole } from "@/lib/authorization";

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminUsers() {
  const { toast } = useToast();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('client');

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
    
    // Prevent self-demotion
    if (selectedUser.id === currentUser?.id && newRole !== 'super_admin' && newRole !== 'admin') {
      toast({
        title: "Action Blocked",
        description: "You cannot demote your own Super Admin account.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      await profilesService.updateRole(selectedUser.id, newRole);
      toast({ 
        title: "Role Updated", 
        description: `User role successfully set to ${newRole}` 
      });
      setDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user role",
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
    return <div className="text-center py-8 text-muted-foreground text-xs">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-foreground">Users & Profiles</h1>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
              <ShieldCheck className="w-3 h-3 mr-1 text-amber-400" />
              Super Admin Control
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{users.length} registered platform profiles</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search users..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-9 bg-card border-border text-xs" 
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
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
            {filtered.map((u) => {
              const isSuper = u.role === 'super_admin' || u.role === 'admin';
              const isDev = u.role === 'developer_admin';
              const isConsultant = u.role === 'consultant';

              return (
                <TableRow key={u.id}>
                  <TableCell className="text-sm font-medium">{u.full_name || 'No name'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    {isSuper ? (
                      <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-300 border-amber-500/30">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Super Admin
                      </Badge>
                    ) : isDev ? (
                      <Badge variant="outline" className="text-xs bg-sky-500/15 text-sky-300 border-sky-500/30">
                        <Terminal className="w-3 h-3 mr-1" />
                        Developer Admin
                      </Badge>
                    ) : isConsultant ? (
                      <Badge variant="outline" className="text-xs bg-purple-500/15 text-purple-300 border-purple-500/30">
                        Consultant
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                        Client
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
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
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Update User Role</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Change the role for {selectedUser?.full_name || 'this user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Assigned Role</Label>
              <Select 
                value={newRole} 
                onValueChange={(value: any) => setNewRole(value)}
              >
                <SelectTrigger className="bg-background border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client (Standard user)</SelectItem>
                  <SelectItem value="developer_admin">Developer Admin (Technical diagnostics)</SelectItem>
                  <SelectItem value="super_admin">Super Admin (Full platform authority)</SelectItem>
                  <SelectItem value="consultant">Consultant (Verified mentor)</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground space-y-1 mt-1">
                <p>• <strong>Super Admin</strong>: Full administrative control including financial and role management.</p>
                <p>• <strong>Developer Admin</strong>: Restricted to technical health, sanitized logs, and diagnostics.</p>
                <p>• <strong>Client</strong>: Standard platform user booking consultations.</p>
              </div>
            </div>

            {selectedUser && (
              <div className="bg-secondary/30 p-3 rounded-lg space-y-1 text-xs">
                <p><span className="text-muted-foreground">Name:</span> {selectedUser.full_name || 'No name'}</p>
                <p><span className="text-muted-foreground">Current Role:</span> {selectedUser.role}</p>
                <p><span className="text-muted-foreground">User ID:</span> {selectedUser.id}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="glow-gold-sm" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

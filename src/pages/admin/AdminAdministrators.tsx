import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Terminal, 
  UserPlus, 
  UserMinus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Lock,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AdminUserRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: "super_admin" | "developer_admin" | "admin" | "client";
  created_at: string;
}

export default function AdminAdministrators() {
  const { user: currentUser, session } = useAuth();
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"developer_admin" | "super_admin">("developer_admin");
  const [submitting, setSubmitting] = useState(false);
  const [revokeUser, setRevokeUser] = useState<AdminUserRecord | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const fetchAdministrators = async () => {
    try {
      const res = await fetch("/api/admin/administrators", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.administrators || []);
      } else {
        toast.error("Failed to load administrator accounts");
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdministrators();
  }, [session?.access_token]);

  const handleAssignRole = async () => {
    if (!targetEmail.trim()) {
      toast.error("Please enter a user email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/administrators/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          targetEmail: targetEmail.trim().toLowerCase(),
          newRole: selectedRole,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Successfully assigned ${selectedRole} role`);
        setDialogOpen(false);
        setTargetEmail("");
        fetchAdministrators();
      } else {
        toast.error(data.error || "Failed to update role");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while assigning role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeRole = async () => {
    if (!revokeUser) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/administrators/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          targetUserId: revokeUser.id,
          targetEmail: revokeUser.email,
          newRole: "client",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Revoked administrator role for ${revokeUser.email}`);
        setRevokeDialogOpen(false);
        setRevokeUser(null);
        fetchAdministrators();
      } else {
        toast.error(data.error || "Failed to revoke role");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while revoking role");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = admins.filter((a) =>
    (a.full_name?.toLowerCase().includes(search.toLowerCase()) || false) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-foreground">
              Administrator Access & Roles
            </h1>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
              <ShieldCheck className="w-3 h-3 mr-1 text-amber-400" />
              Super Admin Exclusive
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Delegate Developer Admin technical permissions or manage executive Super Admin privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setDialogOpen(true)}
            className="glow-gold-sm text-xs"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Assign Admin Role
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAdministrators}
            disabled={loading}
            className="h-9 w-9"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Role Hierarchy Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Super Admin Role
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                Full Authority
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Executive authority: manages administrator assignments, sensitive financial records, payouts, users, and platform settings.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-sky-500/5 border-sky-500/20">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-sky-300">
                <Terminal className="w-4 h-4 text-sky-400" />
                Developer Admin Role
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/30">
                Least-Privilege Scope
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Technical scope: access to health monitoring, integration status, and sanitized diagnostics. Strictly restricted from user data and financials.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Table */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name, email, or user ID..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-9 bg-card border-border text-xs" 
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Administrator</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Privilege Scope</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  Loading administrator accounts...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  No administrator accounts found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((adm) => {
                const isTargetSuper = adm.role === "super_admin" || adm.role === "admin";
                const isSelf = adm.id === currentUser?.id;

                return (
                  <TableRow key={adm.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {adm.full_name || "Admin User"}
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            You
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {adm.email}
                    </TableCell>
                    <TableCell>
                      {isTargetSuper ? (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 text-xs">
                          <Terminal className="w-3 h-3 mr-1" />
                          Developer Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {isTargetSuper 
                        ? "Full executive & financial oversight" 
                        : "Technical telemetry & diagnostics only"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground italic">Current Account</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setRevokeUser(adm);
                            setRevokeDialogOpen(true);
                          }}
                        >
                          <UserMinus className="w-3.5 h-3.5 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Assign Administrator Role</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Specify a registered user's email address to grant Developer Admin or Super Admin privileges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">User Email Address</label>
              <Input
                type="email"
                placeholder="developer@foundarly.com"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="bg-background text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Role to Assign</label>
              <Select
                value={selectedRole}
                onValueChange={(val: any) => setSelectedRole(val)}
              >
                <SelectTrigger className="bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer_admin">Developer Admin (Technical Scope)</SelectItem>
                  <SelectItem value="super_admin">Super Admin (Full Authority)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {selectedRole === "developer_admin"
                  ? "Developer Admin receives access to technical health, sanitized logs, and diagnostics. Zero access to users, settings, or financials."
                  : "Super Admin receives full platform authority including managing administrators, settings, and payouts."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="glow-gold-sm"
              onClick={handleAssignRole}
              disabled={submitting}
            >
              {submitting ? "Assigning..." : "Confirm Role Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Role Confirmation Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Revoke Administrator Privileges
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Are you sure you want to revoke administrative access for{" "}
              <span className="font-semibold text-foreground">{revokeUser?.email}</span>? 
              Their role will be demoted to standard client.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevokeRole}
              disabled={submitting}
            >
              {submitting ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

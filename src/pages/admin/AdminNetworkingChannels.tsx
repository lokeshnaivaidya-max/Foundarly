import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Power, PowerOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminNetworkingService } from "@/services/adminNetworking";
import { toast } from "sonner";

const CATEGORIES = [
  "General", "Founders", "Technology", "Industry",
  "Business", "Marketing", "Finance", "Education",
  "Career", "Product", "Freelance", "Showcase",
  "Lodging/hotel", "Artificial intelligence", "Healthcare",
  "Finance& insurance", "Transport& logistics", "Information technology",
  "Agriculture& forestry", "Construction", "Real estate",
  "Jewellery (artificial)", "Jewellery (original)", "Media & entertainment",
  "Plastic", "Packaging", "Steel,aluminium& copper",
  "Electrical", "Electronic", "Skincare&body care",
  "Travelling", "Import& export", "Manufacturing",
  "Wholesale & retail", "Food processing", "Spices& dryfruit",
  "Fashion", "Wood& hardware", "Automobile",
  "Engineering equipments"
];

const ICONS = ["💬", "🚀", "🤖", "🏭", "📊", "📈", "💰", "🎓", "💼", "🛠️", "🎨", "⭐", "🏨", "🤖", "🏥", "💰", "🚚", "💻", "🌱", "🏗️", "🏢", "💍", "💎", "🎬", "🧪", "📦", "🔩", "⚡", "🔌", "🧴", "✈️", "🌍", "🏭", "🛒", "🥫", "🌶️", "👗", "🪵", "🚗", "⚙️"];

export default function AdminNetworkingChannels() {
  const [channels, setChannels] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    icon: "💬",
    is_public: true,
  });

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const data = await adminNetworkingService.getAllChannelsAdmin();
      setChannels(data);
    } catch (error: any) {
      console.error('Error loading channels in AdminNetworkingChannels:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        fullError: error,
      });
      toast.error(`Failed to load channels: ${error?.message || error?.details || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setSelectedChannel(null);
    setForm({
      name: "",
      description: "",
      category: "",
      icon: "💬",
      is_public: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (channel: any) => {
    setSelectedChannel(channel);
    setForm({
      name: channel.name,
      description: channel.description || "",
      category: channel.category,
      icon: channel.icon || "💬",
      is_public: channel.is_public,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (selectedChannel) {
        await adminNetworkingService.updateChannelAdmin(selectedChannel.id, form);
        toast.success("Channel updated successfully");
      } else {
        await adminNetworkingService.createChannelAdmin(form);
        toast.success("Channel created successfully");
      }
      setDialogOpen(false);
      loadChannels();
    } catch (error) {
      console.error('Error saving channel:', error);
      toast.error("Failed to save channel");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedChannel) return;

    setSaving(true);
    try {
      await adminNetworkingService.deleteChannelAdmin(selectedChannel.id);
      toast.success("Channel deleted successfully");
      setDeleteDialogOpen(false);
      loadChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error("Failed to delete channel");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (channel: any) => {
    try {
      await adminNetworkingService.toggleChannelStatus(channel.id, !channel.is_active);
      toast.success(`Channel ${channel.is_active ? 'deactivated' : 'activated'}`);
      loadChannels();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error("Failed to update status");
    }
  };

  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading channels...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Networking Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">{channels.length} total channels</p>
        </div>
        <Button onClick={openCreate} className="glow-gold-sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Channel
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Channel</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Members</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((channel) => (
              <TableRow key={channel.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{channel.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{channel.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {channel.description}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {channel.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{channel.member_count || 0}</TableCell>
                <TableCell>
                  <Badge
                    variant={channel.is_active !== false ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {channel.is_active !== false ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(channel.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatus(channel)}
                      title={channel.is_active !== false ? "Deactivate" : "Activate"}
                    >
                      {channel.is_active !== false ? (
                        <PowerOff className="h-4 w-4 text-orange-400" />
                      ) : (
                        <Power className="h-4 w-4 text-green-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(channel)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedChannel(channel);
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedChannel ? "Edit Channel" : "Create Channel"}
            </DialogTitle>
            <DialogDescription>
              {selectedChannel ? "Update channel details" : "Create a new networking channel"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., ai-ml"
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={form.icon} onValueChange={(value) => setForm({ ...form, icon: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <span className="text-lg">{icon}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Channel description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="glow-gold-sm">
              {saving ? "Saving..." : selectedChannel ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the channel "{selectedChannel?.name}" and all its messages.
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

import { useState, useEffect } from "react";
import { Search, Plus, LayoutGrid, List, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { consultantsService } from "@/services/consultants";
import { storageService } from "@/services/storage";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { Database } from "@/lib/database.types";

type Consultant = Database['public']['Tables']['consultants']['Row'];

const getDefaultAvatar = (gender?: string) => {
  return gender === 'female' ? '/female-default.jpg' : '/male-default.png';
};

export default function AdminConsultants() {
  const { toast } = useToast();
  const { formatPrice, currency, currencySymbol } = useCurrency();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Consultant | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    title: "",
    bio: "",
    expertise: "",
    pricing_30: 100,
    pricing_60: 180,
    gender: "male" as 'male' | 'female',
    is_active: true,
    email: "",
    user_id: "",
    preferred_time: "Morning (9:00 AM – 12:00 PM IST)"
  });

  useEffect(() => {
    loadConsultants();
  }, []);

  const loadConsultants = async () => {
    try {
      const data = await consultantsService.getAll();
      setConsultants(data);
    } catch (error) {
      console.error('Error loading consultants:', error);
      toast({
        title: "Error",
        description: "Failed to load consultants",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      title: "",
      bio: "",
      expertise: "",
      pricing_30: 100,
      pricing_60: 180,
      gender: "male",
      is_active: true,
      email: "",
      user_id: "",
      preferred_time: "Morning (9:00 AM – 12:00 PM IST)"
    });
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(false);
    setDialogOpen(true);
  };

  const openEdit = (consultant: Consultant) => {
    setEditing(consultant);
    setForm({
      name: consultant.name || "",
      title: consultant.title || "",
      bio: consultant.bio || "",
      expertise: Array.isArray(consultant.expertise) ? consultant.expertise.join(", ") : "",
      pricing_30: consultant.pricing_30 || 0,
      pricing_60: consultant.pricing_60 || 0,
      gender: (consultant.gender as 'male' | 'female') || "male",
      is_active: consultant.is_active ?? true,
      email: consultant.email || "",
      user_id: consultant.user_id || "",
      preferred_time: consultant.preferred_time || "Morning (8 AM – 12 PM)"
    });
    setImageFile(null);
    setImagePreview(consultant.image_url);
    setImageRemoved(false);
    setDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.title || !form.bio) {
      toast({
        title: "Validation Error",
        description: "Name, title, and bio are required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // If image was explicitly removed, set to null
      // If new file uploaded, use that
      // Otherwise keep existing image
      let imageUrl: string | null = imageRemoved ? null : (editing?.image_url || null);

      if (imageFile) {
        try {
          imageUrl = await storageService.uploadFile('consultant-images', imageFile, `consultant-${Date.now()}`);
        } catch (storageError) {
          console.error('Storage error:', storageError);
          toast({
            title: "Storage Error",
            description: "Failed to upload image. Please ensure storage buckets are set up correctly.",
            variant: "destructive"
          });
          setSaving(false);
          return;
        }
      }

      const expertiseArray = form.expertise
        .split(",")
        .map(e => e.trim())
        .filter(e => e.length > 0);

      const consultantData: Record<string, any> = {
        name: form.name.trim(),
        title: form.title.trim(),
        bio: form.bio.trim(),
        expertise: expertiseArray,
        pricing_30: Number(form.pricing_30) || 0,
        pricing_60: Number(form.pricing_60) || 0,
        gender: form.gender,
        is_active: form.is_active,
        image_url: imageUrl,
      };

      if (form.email && form.email.trim()) {
        consultantData.email = form.email.trim();
      }
      if (form.user_id && form.user_id.trim()) {
        consultantData.user_id = form.user_id.trim();
      } else if (editing) {
        consultantData.user_id = null;
      }
      if (form.preferred_time && form.preferred_time.trim()) {
        consultantData.preferred_time = form.preferred_time.trim();
      }

      if (editing) {
        await consultantsService.update(editing.id, consultantData);
        
        // If user_id is provided, ensure they have consultant role
        if (form.user_id && form.user_id.trim()) {
          try {
            const { error: roleError } = await supabase
              .from('profiles')
              .upsert({
                id: form.user_id.trim(),
                role: 'consultant',
                full_name: consultantData.name
              });
            
            if (roleError) {
              console.error('Error setting consultant role:', roleError);
            }
          } catch (roleErr) {
            console.error('Error updating role:', roleErr);
          }
        }
        
        toast({ title: "Updated", description: `${form.name} updated successfully` });
      } else {
        await consultantsService.create(consultantData);
        
        // If user_id is provided, ensure they have consultant role
        if (form.user_id && form.user_id.trim()) {
          try {
            const { error: roleError } = await supabase
              .from('profiles')
              .upsert({
                id: form.user_id.trim(),
                role: 'consultant',
                full_name: consultantData.name
              });
            
            if (roleError) {
              console.error('Error setting consultant role:', roleError);
            }
          } catch (roleErr) {
            console.error('Error updating role:', roleErr);
          }
        }
        
        toast({ title: "Added", description: `${form.name} added successfully` });
      }

      setDialogOpen(false);
      loadConsultants();
    } catch (error: any) {
      console.error('[AdminConsultants] Complete Error Saving Consultant:', {
        httpStatus: error?.status || 400,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        errorObj: error
      });

      const dbMessage = error?.message || error?.details || error?.hint || "Failed to save consultant";
      const dbCode = error?.code ? ` [Code: ${error.code}]` : "";

      toast({
        title: "Failed to Save Consultant",
        description: `${dbMessage}${dbCode}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveStatus = async (consultant: Consultant) => {
    try {
      const nextActiveState = !consultant.is_active;
      await consultantsService.update(consultant.id, { is_active: nextActiveState });
      toast({
        title: "Status Updated",
        description: `${consultant.name} is now ${nextActiveState ? 'Active' : 'Inactive'}`,
      });
      loadConsultants();
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this consultant?')) return;
    
    try {
      await consultantsService.delete(id);
      toast({ title: "Deleted", description: "Consultant removed successfully" });
      loadConsultants();
    } catch (error) {
      console.error('Error deleting consultant:', error);
      toast({
        title: "Error",
        description: "Failed to delete consultant",
        variant: "destructive"
      });
    }
  };

  const filtered = consultants.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading consultants...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Manage Consultants</h1>
          <p className="text-sm text-muted-foreground mt-1">{consultants.length} consultants registered</p>
        </div>
        <Button size="sm" className="glow-gold-sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Consultant
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex border border-border rounded-md overflow-hidden">
          <button onClick={() => setView("table")} className={`p-2 transition-colors ${view === "table" ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setView("grid")} className={`p-2 transition-colors ${view === "grid" ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">30 min</TableHead>
                <TableHead className="text-xs">60 min</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                <TableCell className="font-medium text-sm">
                  <div className="flex items-center gap-2">
                    <img
                      src={c.image_url || getDefaultAvatar(c.gender)}
                      alt={c.name}
                      className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                    />
                    {c.name}
                  </div>
                </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.email || <span className="text-muted-foreground/50">No email</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.user_id ? (
                        <Badge variant="outline" className="text-xs bg-green-500/15 text-green-400 border-green-500/30">
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                          No Account
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatPrice(c.pricing_30)}</TableCell>
                  <TableCell className="text-sm">{formatPrice(c.pricing_60)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleActiveStatus(c)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      title="Click to toggle active status"
                    >
                      <Badge variant="outline" className={`text-xs ${c.is_active ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-7"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-lg p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between mb-3">
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover border border-border"
                  />
                ) : (
                  <img
                    src={getDefaultAvatar(c.gender)}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover border border-border"
                  />
                )}
                <button
                  type="button"
                  onClick={() => toggleActiveStatus(c)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  title="Click to toggle active status"
                >
                  <Badge variant="outline" className={`text-xs ${c.is_active ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}>
                    {c.is_active ? "Active" : "Inactive"}
                  </Badge>
                </button>
              </div>
              <h3 className="font-semibold text-sm text-foreground">{c.name}</h3>
              <p className="text-xs text-muted-foreground">{c.title}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {c.expertise.slice(0, 2).map((exp, i) => (
                  <span key={i} className="text-xs text-primary">{exp}</span>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span>30m: {formatPrice(c.pricing_30)}</span>
                <span>60m: {formatPrice(c.pricing_60)}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-xs h-8"
                  onClick={() => openEdit(c)}
                >
                  Edit
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-8 text-destructive"
                  onClick={() => handleDelete(c.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Consultant" : "Add New Consultant"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {editing ? "Update consultant details below." : "Fill in the details for the new consultant."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="bg-background border-border" 
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Title / Current Job / Business *</Label>
                <Input 
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })} 
                  className="bg-background border-border" 
                  placeholder="e.g. Founder at ABC Technologies / Senior Business Consultant"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bio *</Label>
              <Textarea 
                rows={4} 
                value={form.bio} 
                onChange={(e) => setForm({ ...form, bio: e.target.value })} 
                className="bg-background border-border" 
                placeholder="Brief professional background and expertise..."
              />
            </div>

            <div className="space-y-2">
              <Label>Expertise Areas (comma-separated)</Label>
              <Input 
                value={form.expertise} 
                onChange={(e) => setForm({ ...form, expertise: e.target.value })} 
                className="bg-background border-border" 
                placeholder="Business Strategy, Leadership, Growth"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  className="bg-background border-border" 
                  placeholder="consultant@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Used for login and notifications
                </p>
              </div>
              <div className="space-y-2">
                <Label>User ID (Optional)</Label>
                <Input 
                  value={form.user_id} 
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })} 
                  className="bg-background border-border" 
                  placeholder="Leave empty for auto-link"
                />
                <p className="text-xs text-muted-foreground">
                  Link to existing user account
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>30-min Session Price ({currencySymbol})</Label>
                <Input 
                  type="number" 
                  value={form.pricing_30} 
                  onChange={(e) => setForm({ ...form, pricing_30: parseInt(e.target.value) || 0 })} 
                  className="bg-background border-border" 
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Current currency: {currency}
                </p>
              </div>
              <div className="space-y-2">
                <Label>60-min Session Price ({currencySymbol})</Label>
                <Input 
                  type="number" 
                  value={form.pricing_60} 
                  onChange={(e) => setForm({ ...form, pricing_60: parseInt(e.target.value) || 0 })} 
                  className="bg-background border-border" 
                  placeholder="180"
                />
                <p className="text-xs text-muted-foreground">
                  Current currency: {currency}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred Consultation Time / Session Timing</Label>
              <Select 
                value={
                  form.preferred_time.includes("Morning") ? "Morning" :
                  form.preferred_time.includes("Afternoon") ? "Afternoon" :
                  form.preferred_time.includes("Evening") ? "Evening" :
                  form.preferred_time.includes("Night") ? "Night" :
                  form.preferred_time.includes("Flexible") ? "Flexible" : "Custom"
                } 
                onValueChange={(val) => {
                  if (val === "Morning") setForm({ ...form, preferred_time: "Morning (8 AM – 12 PM)" });
                  else if (val === "Afternoon") setForm({ ...form, preferred_time: "Afternoon (12 PM – 4 PM)" });
                  else if (val === "Evening") setForm({ ...form, preferred_time: "Evening (4 PM – 8 PM)" });
                  else if (val === "Night") setForm({ ...form, preferred_time: "Night (8 PM – 10 PM)" });
                  else if (val === "Flexible") setForm({ ...form, preferred_time: "Flexible (Any Time)" });
                }}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select preferred window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning">Morning (8 AM – 12 PM)</SelectItem>
                  <SelectItem value="Afternoon">Afternoon (12 PM – 4 PM)</SelectItem>
                  <SelectItem value="Evening">Evening (4 PM – 8 PM)</SelectItem>
                  <SelectItem value="Night">Night (8 PM – 10 PM)</SelectItem>
                  <SelectItem value="Flexible">Flexible (Any Time)</SelectItem>
                  <SelectItem value="Custom">Custom Time Range</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={form.preferred_time}
                onChange={(e) => setForm({ ...form, preferred_time: e.target.value })}
                placeholder="Or type custom time range, e.g. Mon-Fri 2:00 PM - 5:00 PM IST"
                className="bg-background border-border text-xs mt-1"
              />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select 
                value={form.gender} 
                onValueChange={(value: 'male' | 'female') => setForm({ ...form, gender: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for appropriate avatar display when no image is uploaded
              </p>
            </div>

            <div className="space-y-2">
              <Label>Profile Image</Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-24 w-24 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="bg-background border-border"
                    id="consultant-image"
                  />
                  <Label htmlFor="consultant-image" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
                      </span>
                    </Button>
                  </Label>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch 
                checked={form.is_active} 
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} 
              />
              <Label>Active (visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="glow-gold-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Consultant" : "Add Consultant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

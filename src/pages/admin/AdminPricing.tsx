

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pricingService, PricingTier } from "@/services/pricing";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function AdminPricing() {
  const { toast } = useToast();
  const { formatPrice, currencySymbol, currency } = useCurrency();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    duration_minutes: 30,
    features: "",
    is_popular: false,
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      const data = await pricingService.getAll();
      setTiers(data);
    } catch (error) {
      console.error('Error loading pricing tiers:', error);
      toast({
        title: "Error",
        description: "Failed to load pricing tiers. Make sure the pricing_tiers table exists.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTier(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      duration_minutes: 30,
      features: "",
      is_popular: false,
      is_active: true,
      display_order: tiers.length + 1
    });
    setDialogOpen(true);
  };

  const handleEdit = (tier: PricingTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description || "",
      price: tier.price,
      duration_minutes: tier.duration_minutes || 30,
      features: tier.features.join("\n"),
      is_popular: tier.is_popular,
      is_active: tier.is_active,
      display_order: tier.display_order
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || formData.price <= 0) {
      toast({
        title: "Validation Error",
        description: "Name and price are required.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const featuresArray = formData.features
        .split("\n")
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const tierData = {
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        duration_minutes: formData.duration_minutes || null,
        features: featuresArray,
        is_popular: formData.is_popular,
        is_active: formData.is_active,
        display_order: formData.display_order
      };

      if (editingTier) {
        await pricingService.update(editingTier.id, tierData);
        toast({ title: "Updated", description: "Pricing tier updated successfully." });
      } else {
        await pricingService.create(tierData as any);
        toast({ title: "Created", description: "Pricing tier created successfully." });
      }
      
      setDialogOpen(false);
      loadTiers();
    } catch (error) {
      console.error('Error saving pricing tier:', error);
      toast({
        title: "Error",
        description: "Failed to save pricing tier.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pricing tier?")) return;

    try {
      await pricingService.delete(id);
      toast({ title: "Deleted", description: "Pricing tier deleted successfully." });
      loadTiers();
    } catch (error) {
      console.error('Error deleting pricing tier:', error);
      toast({
        title: "Error",
        description: "Failed to delete pricing tier.",
        variant: "destructive"
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await pricingService.toggleActive(id, !isActive);
      toast({ 
        title: "Updated", 
        description: `Pricing tier ${!isActive ? 'activated' : 'deactivated'}.` 
      });
      loadTiers();
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading pricing tiers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Manage Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure pricing tiers for consultation services.
          </p>
        </div>
        <Button onClick={handleAdd} className="glow-gold-sm">
          <Plus className="h-4 w-4 mr-2" /> Add Pricing Tier
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Features</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No pricing tiers found. Click "Add Pricing Tier" to create one.
                </TableCell>
              </TableRow>
            ) : (
              tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {tier.name}
                      {tier.is_popular && (
                        <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatPrice(tier.price)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tier.duration_minutes ? `${tier.duration_minutes} min` : 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tier.features.length} features
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${tier.is_active ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-muted text-muted-foreground'}`}
                      >
                        {tier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(tier.id, tier.is_active)}
                      >
                        {tier.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tier)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(tier.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTier ? "Edit Pricing Tier" : "Add New Pricing Tier"}</DialogTitle>
            <DialogDescription>
              {editingTier ? "Update the pricing tier details below." : "Enter the details for the new pricing tier."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Video Call – 30 Min"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ({currencySymbol}) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="120.00"
                />
                <p className="text-xs text-muted-foreground">Current currency: {currency}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                rows={6}
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="1-on-1 private video session&#10;Session recording available&#10;Follow-up summary email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Display Order</Label>
              <Input
                id="order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_popular} 
                  onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })} 
                />
                <Label>Mark as Popular</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} 
                />
                <Label>Active (visible to users)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="glow-gold-sm">
              {saving ? "Saving..." : editingTier ? "Update Tier" : "Add Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

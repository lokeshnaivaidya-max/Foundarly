import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserGroup } from "@/services/networking";
import { toast } from "sonner";

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup: (group: Partial<UserGroup>) => Promise<void>;
}

const CATEGORIES = [
  "General",
  "Founders",
  "Technology",
  "Industry",
  "Business",
  "Marketing",
  "Finance",
  "Education",
  "Career",
  "Product",
  "Freelance",
  "Showcase",
  "Lodging/hotel",
  "Artificial intelligence",
  "Healthcare",
  "Finance& insurance",
  "Transport& logistics",
  "Information technology",
  "Agriculture& forestry",
  "Construction",
  "Real estate",
  "Jewellery (artificial)",
  "Jewellery (original)",
  "Media & entertainment",
  "Plastic",
  "Packaging",
  "Steel,aluminium& copper",
  "Electrical",
  "Electronic",
  "Skincare&body care",
  "Travelling",
  "Import& export",
  "Manufacturing",
  "Wholesale & retail",
  "Food processing",
  "Spices& dryfruit",
  "Fashion",
  "Wood& hardware",
  "Automobile",
  "Engineering equipments",
];

export default function CreateGroupModal({
  open,
  onOpenChange,
  onCreateGroup,
}: CreateGroupModalProps) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    is_private: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      await onCreateGroup(form);
      // Reset form
      setForm({
        name: "",
        category: "",
        description: "",
        is_private: false,
      });
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Create New Group</DialogTitle>
          <DialogDescription>
            Create a private or public group for your community
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., AI Founders Circle"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={form.category}
              onValueChange={(value) => setForm({ ...form, category: value })}
              required
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this group about?"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="private" className="text-sm font-medium">
                Private Group
              </Label>
              <p className="text-xs text-muted-foreground">
                Only invited members can join
              </p>
            </div>
            <Switch
              id="private"
              checked={form.is_private}
              onCheckedChange={(checked) => setForm({ ...form, is_private: checked })}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

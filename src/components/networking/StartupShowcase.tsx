import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Heart, Plus, Rocket } from "lucide-react";
import { StartupShowcase as ShowcaseType, COLLABORATION_TAGS } from "@/services/networking";
import { toast } from "sonner";

interface StartupShowcaseProps {
  showcases: ShowcaseType[];
  channelId: string;
  onCreateShowcase: (showcase: Partial<ShowcaseType>) => Promise<void>;
  canCreate: boolean;
}

const INDUSTRIES = [
  "SaaS", "FinTech", "HealthTech", "EdTech", "E-commerce",
  "AI/ML", "Blockchain", "IoT", "CleanTech", "FoodTech",
  "PropTech", "MarTech", "HRTech", "LegalTech", "Other"
];

export default function StartupShowcase({
  showcases,
  channelId,
  onCreateShowcase,
  canCreate,
}: StartupShowcaseProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    startup_name: "",
    industry: "",
    description: "",
    website: "",
    looking_for: [] as string[],
  });

  const handleCreate = async () => {
    if (!form.startup_name || !form.industry || !form.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      await onCreateShowcase({
        channel_id: channelId,
        ...form,
      });
      toast.success("Showcase created successfully!");
      setCreateOpen(false);
      setForm({
        startup_name: "",
        industry: "",
        description: "",
        website: "",
        looking_for: [],
      });
    } catch (error) {
      console.error('Error creating showcase:', error);
      toast.error("Failed to create showcase");
    } finally {
      setCreating(false);
    }
  };

  const toggleLookingFor = (value: string) => {
    setForm(prev => ({
      ...prev,
      looking_for: prev.looking_for.includes(value)
        ? prev.looking_for.filter(v => v !== value)
        : [...prev.looking_for, value]
    }));
  };

  if (showcases.length === 0 && !canCreate) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Startup Spotlight</h3>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {showcases.length}
          </Badge>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Showcase
          </Button>
        )}
      </div>

      {showcases.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {showcases.map((showcase) => (
            <ShowcaseCard key={showcase.id} showcase={showcase} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              No showcases yet. Be the first to share your startup!
            </p>
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create First Showcase
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Showcase Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Showcase Your Startup</DialogTitle>
            <DialogDescription>
              Share your startup with the community and find collaborators
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Startup Name *</Label>
                <Input
                  value={form.startup_name}
                  onChange={(e) => setForm({ ...form, startup_name: e.target.value })}
                  placeholder="e.g., Acme Inc"
                />
              </div>
              <div className="space-y-2">
                <Label>Industry *</Label>
                <Select value={form.industry} onValueChange={(value) => setForm({ ...form, industry: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of your startup..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://example.com"
                type="url"
              />
            </div>

            <div className="space-y-2">
              <Label>Looking For</Label>
              <div className="flex flex-wrap gap-2">
                {COLLABORATION_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    onClick={() => toggleLookingFor(tag.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                      form.looking_for.includes(tag.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Showcase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShowcaseCard({ showcase }: { showcase: ShowcaseType }) {
  return (
    <Card className="hover:border-primary/30 transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-display font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
              {showcase.startup_name}
            </h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {showcase.industry}
              </Badge>
              <span className="text-xs text-muted-foreground">
                by {showcase.profiles?.full_name || 'Anonymous'}
              </span>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="flex-shrink-0">
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {showcase.description}
        </p>

        {showcase.looking_for && showcase.looking_for.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {showcase.looking_for.map((tag) => {
              const tagInfo = COLLABORATION_TAGS.find(t => t.value === tag);
              return (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <span className="mr-1">{tagInfo?.icon}</span>
                  {tagInfo?.label}
                </Badge>
              );
            })}
          </div>
        )}

        {showcase.website && (
          <a
            href={showcase.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Visit Website
          </a>
        )}
      </CardContent>
    </Card>
  );
}

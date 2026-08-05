import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star, CheckCircle, XCircle, Trash2, Eye, Clock, TrendingUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { testimonialsService } from "@/services/testimonials";

type Review = {
  id: string;
  client_name: string;
  designation: string;
  review: string;
  rating: number;
  status: "published" | "draft";
  consultant_id: string | null;
  booking_id: string | null;
  created_at: string;
  consultant_name?: string | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground/25"}`} />
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function AdminTestimonials() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [preview, setPreview] = useState<Review | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editReview, setEditReview] = useState<Review | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await testimonialsService.getAllWithConsultant(false);
      setReviews(data);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await testimonialsService.toggleStatus(id, "published");
      toast.success("Review is now live on the platform.");
      load();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const reject = async (id: string) => {
    try {
      await testimonialsService.toggleStatus(id, "draft");
      toast.success("Review moved back to pending.");
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await testimonialsService.delete(deleteId);
      toast.success("Review permanently removed.");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleEditSave = async () => {
    if (!editReview || !editText.trim()) return;
    try {
      await testimonialsService.update(editReview.id, { review: editText.trim() });
      toast.success("Review text updated.");
      setEditReview(null);
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const filtered = reviews.filter((r) => filter === "all" ? true : r.status === filter);
  const pending = reviews.filter((r) => r.status === "draft").length;
  const published = reviews.filter((r) => r.status === "published").length;
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading reviews...</div>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Review Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reviews submitted by users after completed sessions. Approve to publish on the homepage.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total Reviews"   value={reviews.length} color="bg-primary/10 text-primary" />
        <StatCard icon={Clock}         label="Pending Approval" value={pending}         color="bg-yellow-500/10 text-yellow-500" />
        <StatCard icon={CheckCircle}   label="Published"        value={published}       color="bg-green-500/10 text-green-500" />
        <StatCard icon={TrendingUp}    label={`Avg Rating: ${avgRating}★`} value={reviews.length} color="bg-primary/10 text-primary" />
      </div>

      {/* Pending banner */}
      {pending > 0 && (
        <div className="flex items-center gap-3 bg-yellow-500/8 border border-yellow-500/25 rounded-xl px-4 py-3">
          <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-600">
            <span className="font-semibold">{pending} review{pending > 1 ? "s" : ""}</span> waiting for your approval.
          </p>
          <Button size="sm" variant="outline" className="ml-auto text-xs border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
            onClick={() => setFilter("draft")}>
            View Pending
          </Button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "draft", "published"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `All (${reviews.length})` : f === "draft" ? `Pending (${pending})` : `Published (${published})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-xs font-semibold">Reviewer</TableHead>
              <TableHead className="text-xs font-semibold">Consultant</TableHead>
              <TableHead className="text-xs font-semibold">Review</TableHead>
              <TableHead className="text-xs font-semibold">Rating</TableHead>
              <TableHead className="text-xs font-semibold">Date</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  No reviews found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className={r.status === "draft" ? "bg-yellow-500/3" : ""}>
                {/* Reviewer */}
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs font-bold">{r.client_name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{r.client_name}</span>
                  </div>
                </TableCell>

                {/* Consultant */}
                <TableCell className="text-sm text-muted-foreground">
                  {r.consultant_name
                    ? <span className="text-foreground/80 font-medium">{r.consultant_name}</span>
                    : <span className="italic text-muted-foreground/40">—</span>}
                </TableCell>

                {/* Review snippet */}
                <TableCell className="max-w-[200px]">
                  <p className="text-sm text-muted-foreground truncate">"{r.review}"</p>
                </TableCell>

                {/* Rating */}
                <TableCell><Stars rating={r.rating} /></TableCell>

                {/* Date */}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant="outline" className={`text-xs font-medium ${
                    r.status === "published"
                      ? "bg-green-500/10 text-green-600 border-green-500/25"
                      : "bg-yellow-500/10 text-yellow-600 border-yellow-500/25"
                  }`}>
                    {r.status === "published" ? "Published" : "Pending"}
                  </Badge>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-1">
                    <Button variant="ghost" size="sm" title="Preview" onClick={() => setPreview(r)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {r.status === "draft" ? (
                      <Button variant="ghost" size="sm" title="Approve" onClick={() => approve(r.id)}
                        className="h-7 w-7 p-0 text-green-500 hover:text-green-600 hover:bg-green-500/10">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" title="Unpublish" onClick={() => reject(r.id)}
                        className="h-7 w-7 p-0 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => setDeleteId(r.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Review Preview</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              How this review will appear on the platform.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 py-2">
              {/* Card preview */}
              <div className="bg-secondary/50 border border-border rounded-xl p-5 space-y-3">
                <Stars rating={preview.rating} />
                <p className="text-sm text-foreground/80 italic leading-relaxed">"{preview.review}"</p>
                <div className="border-t border-border/50 pt-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary text-xs font-bold">{preview.client_name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{preview.client_name}</p>
                    {preview.consultant_name && (
                      <p className="text-xs text-muted-foreground">Consulted: <span className="text-primary/80">{preview.consultant_name}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Status:</span> {preview.status}</div>
                <div><span className="font-medium text-foreground">Date:</span> {new Date(preview.created_at).toLocaleDateString()}</div>
                {preview.booking_id && <div className="col-span-2"><span className="font-medium text-foreground">Booking ID:</span> {preview.booking_id.slice(0, 8)}...</div>}
              </div>

              {/* Edit review text inline */}
              {editReview?.id === preview.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-background border-border text-sm min-h-[80px]"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="glow-gold-sm text-xs" onClick={handleEditSave}>Save</Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditReview(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="text-xs w-full" onClick={() => { setEditReview(preview); setEditText(preview.review); }}>
                  Edit Review Text
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {preview?.status === "draft" ? (
              <Button className="glow-gold-sm text-xs" onClick={() => { approve(preview!.id); setPreview(null); }}>
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve & Publish
              </Button>
            ) : (
              <Button variant="outline" className="text-xs" onClick={() => { reject(preview!.id); setPreview(null); }}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Unpublish
              </Button>
            )}
            <Button variant="ghost" className="text-xs" onClick={() => setPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the review. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

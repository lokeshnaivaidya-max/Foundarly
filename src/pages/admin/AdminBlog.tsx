import { Plus, Search, Upload, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { blogService } from "@/services/blog";
import { storageService } from "@/services/storage";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/database.types";

type BlogPost = Database['public']['Tables']['blog']['Row'];

export default function AdminBlog() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    content: "",
    meta_title: "",
    meta_description: "",
    published: true
  });

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const data = await blogService.getAll();
      setPosts(data);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      toast({
        title: "Error",
        description: "Failed to load blog posts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      title: "",
      content: "",
      meta_title: "",
      meta_description: "",
      published: true
    });
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditing(post);
    setForm({
      title: post.title,
      content: post.content,
      meta_title: post.meta_title || "",
      meta_description: post.meta_description || "",
      published: post.status === "published"
    });
    setImageFile(null);
    setImagePreview(post.featured_image);
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
  };

  const handleSave = async () => {
    if (!form.title || !form.content) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      let featuredImage = editing?.featured_image || null;

      // Upload image if new file selected
      if (imageFile) {
        featuredImage = await storageService.uploadFile('blog-images', imageFile, `blog-${Date.now()}`);
      }

      const postData = {
        title: form.title,
        content: form.content,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        featured_image: featuredImage,
        status: form.published ? "published" as const : "draft" as const
      };

      if (editing) {
        await blogService.update(editing.id, postData);
        toast({ title: "Updated", description: "Blog post updated successfully" });
      } else {
        await blogService.create(postData);
        toast({ title: "Added", description: "Blog post created successfully" });
      }

      setDialogOpen(false);
      loadPosts();
    } catch (error) {
      console.error('Error saving blog post:', error);
      toast({
        title: "Error",
        description: "Failed to save blog post",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    
    try {
      await blogService.delete(id);
      toast({ title: "Deleted", description: "Blog post removed successfully" });
      loadPosts();
    } catch (error) {
      console.error('Error deleting blog post:', error);
      toast({
        title: "Error",
        description: "Failed to delete blog post",
        variant: "destructive"
      });
    }
  };

  const filtered = posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading blog posts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Manage Blog</h1>
          <p className="text-sm text-muted-foreground mt-1">{posts.length} posts</p>
        </div>
        <Button size="sm" className="glow-gold-sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> New Post
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Author</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm font-medium max-w-xs truncate">{p.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">Admin</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${p.status === "published" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}>
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Blog Post" : "Create New Blog Post"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {editing ? "Update blog post details below." : "Fill in the details for the new blog post."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input 
                value={form.title} 
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                className="bg-background border-border" 
                placeholder="10 Leadership Strategies for Startup Founders"
              />
            </div>

            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea 
                rows={10} 
                value={form.content} 
                onChange={(e) => setForm({ ...form, content: e.target.value })} 
                className="bg-background border-border" 
                placeholder="Write your blog post content here..."
              />
            </div>

            <div className="space-y-2">
              <Label>Featured Image</Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-32 w-auto object-cover rounded-lg border border-border"
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
                    id="blog-image"
                  />
                  <Label htmlFor="blog-image" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
                      </span>
                    </Button>
                  </Label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Title (SEO)</Label>
                <Input 
                  value={form.meta_title} 
                  onChange={(e) => setForm({ ...form, meta_title: e.target.value })} 
                  className="bg-background border-border" 
                  placeholder="Optional SEO title"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Description (SEO)</Label>
                <Input 
                  value={form.meta_description} 
                  onChange={(e) => setForm({ ...form, meta_description: e.target.value })} 
                  className="bg-background border-border" 
                  placeholder="Optional SEO description"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch 
                checked={form.published} 
                onCheckedChange={(checked) => setForm({ ...form, published: checked })} 
              />
              <Label>Publish (make visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="glow-gold-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Post" : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

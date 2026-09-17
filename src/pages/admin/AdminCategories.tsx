import { useState, useEffect, useRef } from "react";
import { categoriesService, Category } from "@/services/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Layers, 
  Check, 
  X, 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Direct card upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetUploadCategory, setTargetUploadCategory] = useState<Category | null>(null);

  // Form state
  const [form, setForm] = useState({ 
    name: "", 
    slug: "", 
    description: "", 
    icon: "Briefcase",
    image_url: "" 
  });
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await categoriesService.getAll();
      setCategories(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  // Direct quick upload for a category card
  const triggerCardUpload = (c: Category) => {
    setTargetUploadCategory(c);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleCardFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUploadCategory) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP)");
      return;
    }

    setUploadingId(targetUploadCategory.id);
    const toastId = toast.loading(`Uploading image for ${targetUploadCategory.name}...`);

    try {
      const publicUrl = await categoriesService.uploadImage(file, targetUploadCategory.id);
      
      // Update local state immediately
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === targetUploadCategory.id
            ? { ...cat, image_url: publicUrl }
            : cat
        )
      );

      toast.success(`Image updated for ${targetUploadCategory.name}`, { id: toastId });
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image. Please try again.", { id: toastId });
    } finally {
      setUploadingId(null);
      setTargetUploadCategory(null);
    }
  };

  const handleRemoveImage = async (c: Category) => {
    if (!confirm(`Remove circular image for "${c.name}"?`)) return;

    setUploadingId(c.id);
    try {
      await categoriesService.removeImage(c.id);
      setCategories((prev) =>
        prev.map((cat) => (cat.id === c.id ? { ...cat, image_url: null } : cat))
      );
      toast.success(`Image removed for ${c.name}`);
    } catch {
      toast.error("Failed to remove image");
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsSaving(true);
    const toastId = toast.loading(editingCategory ? "Updating category..." : "Creating category...");

    try {
      let finalImageUrl = form.image_url.trim() || null;

      // If a new file was chosen in the form, upload it first
      if (formImageFile) {
        finalImageUrl = await categoriesService.uploadImage(formImageFile);
      }

      const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      if (editingCategory) {
        await categoriesService.update(editingCategory.id, {
          name: form.name,
          slug,
          description: form.description,
          icon: form.icon,
          image_url: finalImageUrl,
        });
        toast.success("Category updated successfully", { id: toastId });
      } else {
        await categoriesService.create({
          name: form.name,
          slug,
          description: form.description,
          icon: form.icon,
          image_url: finalImageUrl,
        });
        toast.success("Category created successfully", { id: toastId });
      }

      resetForm();
      loadCategories();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Error saving category", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "", icon: "Briefcase", image_url: "" });
    setFormImageFile(null);
    setFormImagePreview(null);
    setEditingCategory(null);
    setIsAdding(false);
  };

  const handleEdit = (c: Category) => {
    setEditingCategory(c);
    setForm({
      name: c.name,
      slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: c.description || "",
      icon: c.icon || "Briefcase",
      image_url: c.image_url || "",
    });
    setFormImageFile(null);
    setFormImagePreview(c.image_url || null);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await categoriesService.delete(id);
      toast.success("Category deleted");
      loadCategories();
    } catch {
      toast.error("Failed to delete category");
    }
  };

  // Filtered categories for search
  const filteredCategories = categories.filter((c) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.description || "").toLowerCase().includes(query) ||
      (c.slug || "").toLowerCase().includes(query)
    );
  });

  const categoriesWithImages = categories.filter((c) => Boolean(c.image_url)).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Hidden file input for one-click upload from category cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCardFileChange}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Layers className="text-primary w-6 h-6" /> Consultant Categories & Industry Filter
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage industry categories and upload circular avatar images for the website's Instagram-style Filter Industry bar.
          </p>
        </div>
        {!isAdding && (
          <Button
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="glow-gold-sm gap-2 shrink-0"
          >
            <Plus size={16} /> Add Category
          </Button>
        )}
      </div>

      {/* Stats & Quick Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total Industries</p>
            <p className="text-2xl font-bold text-foreground font-display mt-0.5">{categories.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
            <Layers size={18} />
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Circular Images Active</p>
            <p className="text-2xl font-bold text-primary font-display mt-0.5">{categoriesWithImages}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Using Clean Placeholder</p>
            <p className="text-2xl font-bold text-muted-foreground font-display mt-0.5">
              {categories.length - categoriesWithImages}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
            <AlertCircle size={18} />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search categories / industries by name..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-10 bg-card border-border"
        />
        {searchFilter && (
          <button
            onClick={() => setSearchFilter("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Add / Edit Category Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSave}
            className="bg-card border border-primary/40 p-6 rounded-2xl space-y-6 shadow-xl relative"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {editingCategory ? `Edit Category: ${editingCategory.name}` : "Create New Category"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure details and upload a circular image to display on the filter bar.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                <X size={16} />
              </Button>
            </div>

            {/* Circular Image Upload Section */}
            <div className="bg-secondary/40 border border-border/80 p-4 rounded-xl space-y-3">
              <Label className="text-sm font-semibold text-foreground block">
                Industry Circular Image (Instagram-Style Avatar)
              </Label>
              
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Circular Preview */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 shadow-md bg-secondary flex items-center justify-center relative">
                    {formImagePreview ? (
                      <img
                        src={formImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-full"
                        onError={() => setFormImagePreview(null)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <span className="font-bold text-base font-display text-primary">
                          {form.name ? form.name.slice(0, 2).toUpperCase() : "IND"}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          Placeholder
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Active Indicator Ring */}
                  {formImagePreview && (
                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1 rounded-full shadow">
                      <Check size={12} />
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="space-y-2 flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 pointer-events-none"
                      >
                        <Upload size={14} />
                        {formImagePreview ? "Change Image" : "Upload Image"}
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormImageFile(file);
                            setFormImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>

                    {formImagePreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 text-xs gap-1"
                        onClick={() => {
                          setFormImageFile(null);
                          setFormImagePreview(null);
                          setForm({ ...form, image_url: "" });
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </Button>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Recommended: Square image (1:1 ratio), minimum 200x200px. Uploaded to Supabase Storage and rendered in the circular navigation bar.
                  </p>

                  {/* Optional direct URL input */}
                  <div className="pt-1">
                    <Input
                      placeholder="Or paste an image URL directly (optional)..."
                      value={form.image_url}
                      onChange={(e) => {
                        setForm({ ...form, image_url: e.target.value });
                        if (e.target.value.trim()) {
                          setFormImagePreview(e.target.value.trim());
                        }
                      }}
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category / Industry Name</Label>
                <Input
                  required
                  placeholder="e.g. Artificial Intelligence"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (URL snippet)</Label>
                <Input
                  placeholder="e.g. artificial-intelligence"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief summary of what experts in this category specialize in..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="glow-gold-sm gap-1.5">
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} /> Save Category
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Categories Grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Loading categories from Supabase...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl p-8">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-foreground font-semibold">No categories found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchFilter ? `No results matching "${searchFilter}"` : "Add a category to get started."}
          </p>
          {searchFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchFilter("")}
              className="mt-3 text-xs"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map((c) => {
            const isUploadingThis = uploadingId === c.id;

            return (
              <div
                key={c.id}
                className="bg-card border border-border hover:border-primary/40 transition-all p-4 rounded-xl flex items-start gap-4 shadow-sm relative group"
              >
                {/* Circular Avatar / Image with Quick Upload overlay */}
                <div className="relative shrink-0">
                  <div
                    onClick={() => triggerCardUpload(c)}
                    title="Click to upload/change image"
                    className="w-14 h-14 rounded-full overflow-hidden border-2 border-border/80 group-hover:border-primary/70 transition-all bg-secondary/80 flex items-center justify-center cursor-pointer shadow-sm relative"
                  >
                    {isUploadingThis ? (
                      <div className="flex items-center justify-center w-full h-full bg-black/60 text-white">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          e.currentTarget.parentElement?.classList.add("show-fallback");
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-1">
                        <span className="text-xs font-bold font-display text-muted-foreground group-hover:text-primary transition-colors">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Hover Upload Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                      <Upload size={16} className="text-white" />
                    </div>
                  </div>

                  {/* Status dot */}
                  <span
                    title={c.image_url ? "Image active" : "Using clean placeholder circle"}
                    className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                      c.image_url ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
                      {c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {c.description || "No description provided."}
                  </p>

                  {/* Image status text & Quick Upload Action */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-border/40 text-xs">
                    <button
                      onClick={() => triggerCardUpload(c)}
                      disabled={isUploadingThis}
                      className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      {isUploadingThis ? (
                        <>
                          <Loader2 size={12} className="animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={12} /> {c.image_url ? "Change Image" : "Upload Image"}
                        </>
                      )}
                    </button>

                    {c.image_url && (
                      <button
                        onClick={() => handleRemoveImage(c)}
                        disabled={isUploadingThis}
                        className="text-muted-foreground hover:text-destructive text-[11px] inline-flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Action buttons on right */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleEdit(c)}
                    title="Edit category"
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                    title="Delete category"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

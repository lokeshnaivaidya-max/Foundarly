import { useState, useEffect } from "react";
import { categoriesService, Category } from "@/services/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Layers, Check, X } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon: "Briefcase" });

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (editingCategory) {
        await categoriesService.update(editingCategory.id, {
          name: form.name,
          slug,
          description: form.description,
          icon: form.icon,
        });
        toast.success("Category updated");
      } else {
        await categoriesService.create({
          name: form.name,
          slug,
          description: form.description,
          icon: form.icon,
        });
        toast.success("Category created");
      }
      setForm({ name: "", slug: "", description: "", icon: "Briefcase" });
      setEditingCategory(null);
      setIsAdding(false);
      loadCategories();
    } catch {
      toast.error("Error saving category");
    }
  };

  const handleEdit = (c: Category) => {
    setEditingCategory(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      icon: c.icon || "Briefcase",
    });
    setIsAdding(true);
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Layers className="text-primary" /> Consultant Categories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage expertise categories used for filtering experts on the website.
          </p>
        </div>
        {!isAdding && (
          <Button
            onClick={() => {
              setEditingCategory(null);
              setForm({ name: "", slug: "", description: "", icon: "Briefcase" });
              setIsAdding(true);
            }}
            className="glow-gold-sm gap-2"
          >
            <Plus size={16} /> Add Category
          </Button>
        )}
      </div>

      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSave}
          className="bg-card border border-primary/30 p-5 rounded-xl space-y-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {editingCategory ? "Edit Category" : "New Category"}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setEditingCategory(null);
              }}
            >
              <X size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category Name</Label>
              <Input
                required
                placeholder="e.g. AI & Tech Innovation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL snippet)</Label>
              <Input
                placeholder="e.g. ai-tech"
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
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAdding(false);
                setEditingCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="glow-gold-sm gap-1.5">
              <Check size={16} /> Save Category
            </Button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((c) => (
            <div
              key={c.id}
              className="bg-card border border-border p-4 rounded-xl flex items-start justify-between gap-3 hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
                    {c.slug}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {c.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => handleEdit(c)}
                >
                  <Edit2 size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

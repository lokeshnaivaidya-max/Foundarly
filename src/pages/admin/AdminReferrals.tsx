import { useState, useEffect } from "react";
import { referralsService, ReferralCode, ReferralUsage } from "@/services/referrals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Check, X, ToggleLeft, ToggleRight, History, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminReferrals() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [usages, setUsages] = useState<ReferralUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"codes" | "usages">("codes");

  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: 10,
    usage_limit: 100,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [codesData, usagesData] = await Promise.all([
        referralsService.getAllCodes(),
        referralsService.getUsages(),
      ]);
      setCodes(codesData);
      setUsages(usagesData);
    } catch (e) {
      console.error(e);
      toast.error("Error loading referrals data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) return;

    try {
      await referralsService.createCode({
        code: form.code,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        is_active: true,
      });
      toast.success("Referral code created!");
      setForm({ code: "", discount_type: "percentage", discount_value: 10, usage_limit: 100 });
      setIsAdding(false);
      loadData();
    } catch {
      toast.error("Failed to create referral code");
    }
  };

  const handleToggleActive = async (c: ReferralCode) => {
    const nextStatus = !c.is_active;
    // Optimistic UI update for immediate visual feedback
    setCodes((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, is_active: nextStatus } : item))
    );
    try {
      await referralsService.toggleActive(c.id, nextStatus);
      toast.success(`Code ${c.code} ${nextStatus ? "activated" : "deactivated"}`);
      loadData();
    } catch (err) {
      console.error("Error updating referral code status:", err);
      // Revert optimistic update
      setCodes((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, is_active: c.is_active } : item))
      );
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this code?")) return;
    try {
      await referralsService.deleteCode(id);
      toast.success("Referral code deleted");
      loadData();
    } catch {
      toast.error("Failed to delete code");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Tag className="text-primary" /> Referral & Promo Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create discount codes, track usage limits, and analyze referral redemptions.
          </p>
        </div>
        {activeTab === "codes" && !isAdding && (
          <Button onClick={() => setIsAdding(true)} className="glow-gold-sm gap-2">
            <Plus size={16} /> Create Code
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab("codes")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "codes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tag size={16} /> Active Promo Codes ({codes.length})
        </button>
        <button
          onClick={() => setActiveTab("usages")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "usages"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History size={16} /> Usage History ({usages.length})
        </button>
      </div>

      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="bg-card border border-primary/30 p-5 rounded-xl space-y-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Create New Referral Code</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
              <X size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Code String</Label>
              <Input
                required
                placeholder="e.g. FOUNDARLY20"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v: "percentage" | "fixed") => setForm({ ...form, discount_type: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Discount Value</Label>
              <Input
                required
                type="number"
                min={1}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <Label>Usage Limit (Max redemptions)</Label>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: Number(e.target.value) })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" className="glow-gold-sm gap-1.5">
              <Check size={16} /> Create Code
            </Button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading data...</div>
      ) : activeTab === "codes" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {codes.map((c) => (
            <div
              key={c.id}
              className={`bg-card border p-4 rounded-xl flex items-center justify-between gap-4 transition-colors ${
                c.is_active ? "border-border hover:border-primary/40" : "border-border/40 opacity-60 bg-secondary/20"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-primary">{c.code}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                    {c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span>Used: {c.times_used} / {c.usage_limit || "∞"}</span>
                  <span>•</span>
                  <span>Status: {c.is_active ? "Active" : "Disabled"}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => handleToggleActive(c)}
                  title={c.is_active ? "Deactivate" : "Activate"}
                >
                  {c.is_active ? <ToggleRight className="text-emerald-500 w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
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
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {usages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No referral codes have been redeemed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase font-medium border-b border-border">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">User Email</th>
                    <th className="p-3">Original Price</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Final Paid</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usages.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/30">
                      <td className="p-3 font-mono font-bold text-primary">{u.code}</td>
                      <td className="p-3 text-foreground">{u.user_email}</td>
                      <td className="p-3 text-muted-foreground line-through">₹{u.original_price}</td>
                      <td className="p-3 text-emerald-500 font-semibold">-₹{u.discount_amount}</td>
                      <td className="p-3 font-bold text-foreground">₹{u.final_price}</td>
                      <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

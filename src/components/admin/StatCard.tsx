import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
}

export default function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold text-foreground font-display">{value}</p>
          {trend && <p className="text-xs text-primary mt-1">{trend}</p>}
        </div>
        <div className="p-2.5 rounded-md bg-secondary group-hover:bg-primary/10 transition-colors">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

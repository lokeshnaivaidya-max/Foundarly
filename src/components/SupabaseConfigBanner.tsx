import { isSupabaseConfigured } from "@/lib/supabase";
import { AlertTriangle, Database, ExternalLink } from "lucide-react";

export default function SupabaseConfigBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-3 text-xs sm:text-sm">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <span>
            <strong className="font-semibold text-amber-300">Supabase Not Configured:</strong> Missing{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-200">VITE_SUPABASE_URL</code> and{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-200">VITE_SUPABASE_ANON_KEY</code>.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline text-amber-300 hover:text-amber-100 transition-colors text-xs"
          >
            <Database size={13} /> Supabase Dashboard <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

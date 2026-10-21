import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Terminal } from "lucide-react";

export default function AdminLayout() {
  const { isSuperAdmin, isDeveloperAdmin } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background min-w-0">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 md:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-20 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <Link to="/" className="font-display text-lg font-bold text-gradient-gold">
                Foundarly
              </Link>
              
              {isSuperAdmin ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Super Admin
                </span>
              ) : isDeveloperAdmin ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  Developer Admin
                </span>
              ) : (
                <span className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5">
                  Admin Dashboard
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Back to Site
              </Link>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 min-w-0 overflow-y-auto overflow-x-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

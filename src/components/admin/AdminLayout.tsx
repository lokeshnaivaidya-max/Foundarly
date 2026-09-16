import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background min-w-0">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 w-full overflow-x-auto">
          <header className="h-14 flex items-center justify-between border-b border-border px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-40 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <Link to="/" className="font-display text-lg font-bold text-gradient-gold">
                Foundarly
              </Link>
              <span className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5">Admin Dashboard</span>
            </div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Site
            </Link>
          </header>
          <main className="flex-1 p-4 md:p-6 min-w-0 w-full overflow-y-auto overflow-x-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

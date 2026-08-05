import {
  LayoutDashboard,
  Users,
  Layers,
  MessageSquareQuote,
  CalendarCheck,
  FileText,
  UsersRound,
  Settings,
  ChevronLeft,
  HelpCircle,
  DollarSign,
  Network,
  Hash,
  UsersIcon,
  MessageCircle,
  AlertTriangle,
  UserPlus,
  Tag,
  Grid
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Content Control", url: "/admin/content", icon: Layers },
  { title: "Categories", url: "/admin/categories", icon: Grid },
  { title: "Referral Codes", url: "/admin/referrals", icon: Tag },
  { title: "Manage Consultants", url: "/admin/consultants", icon: Users },
  { title: "Consultant Applications", url: "/admin/consultant-applications", icon: UserPlus },
  { title: "Manage Bookings", url: "/admin/bookings", icon: CalendarCheck },
  { title: "Testimonials", url: "/admin/testimonials", icon: MessageSquareQuote },
  { title: "Blog", url: "/admin/blog", icon: FileText },
  { title: "FAQs", url: "/admin/faqs", icon: HelpCircle },
  { title: "Pricing", url: "/admin/pricing", icon: DollarSign },
  { title: "Users", url: "/admin/users", icon: UsersRound },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

const networkingMenuItems = [
  { title: "Channels", url: "/admin/networking/channels", icon: Hash },
  { title: "Groups", url: "/admin/networking/groups", icon: UsersIcon },
  { title: "Messages", url: "/admin/networking/messages", icon: MessageCircle },
  { title: "Showcases", url: "/admin/networking/showcases", icon: Network },
  { title: "Reports", url: "/admin/networking/reports", icon: AlertTriangle },
];

export default function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-background">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-widest mb-2">
            {!collapsed && "Admin Panel"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-primary hover:bg-secondary"
                      activeClassName="text-primary bg-secondary glow-gold-sm"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-widest mb-2">
            {!collapsed && "Networking Control"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {networkingMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-primary hover:bg-secondary"
                      activeClassName="text-primary bg-secondary glow-gold-sm"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <span className="text-sm">Logout</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

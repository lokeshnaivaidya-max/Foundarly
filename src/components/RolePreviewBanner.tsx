import React from "react";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Eye, 
  Users, 
  Calendar, 
  ShieldAlert, 
  X, 
  ArrowRight, 
  ChevronDown, 
  Sparkles,
  Terminal,
  ShieldCheck,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function RolePreviewBanner() {
  const { 
    previewRole, 
    previewConsultant, 
    availableConsultants, 
    setPreviewConsultant, 
    switchToRole, 
    exitPreview, 
    isRolePreviewActive 
  } = useRolePreview();
  const { isDeveloperAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isRolePreviewActive || !previewRole) {
    return null;
  }

  const roleConfigs = {
    consultant: {
      label: "Consultant Dashboard",
      color: "bg-amber-500/10 border-amber-500/30 text-amber-500",
      accentBg: "bg-amber-500/20 text-amber-400",
      icon: Users,
      route: "/consultant/dashboard",
    },
    client: {
      label: "Client Dashboard",
      color: "bg-sky-500/10 border-sky-500/30 text-sky-400",
      accentBg: "bg-sky-500/20 text-sky-300",
      icon: Calendar,
      route: "/my-bookings",
    },
    super_admin: {
      label: "Super Admin Overview",
      color: "bg-purple-500/10 border-purple-500/30 text-purple-400",
      accentBg: "bg-purple-500/20 text-purple-300",
      icon: ShieldCheck,
      route: "/admin",
    },
  };

  const currentConfig = roleConfigs[previewRole] || roleConfigs.client;
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="sticky top-0 z-50 w-full border-b backdrop-blur-md transition-all shadow-md bg-slate-950/95 border-amber-500/40 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
        {/* Left Side: Current Role Badge & Details */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40">
            <Eye className="w-3.5 h-3.5 animate-pulse" />
            <span>ROLE PREVIEW ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Currently Viewing:</span>
            <Badge variant="outline" className={`font-medium ${currentConfig.color}`}>
              <CurrentIcon className="w-3 h-3 mr-1" />
              {currentConfig.label}
            </Badge>
          </div>

          {previewRole === "consultant" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-slate-900 border-amber-500/30 hover:bg-slate-800 text-slate-200 gap-1.5 px-2.5"
                >
                  <span className="truncate max-w-[150px] font-semibold text-amber-400">
                    {previewConsultant?.name || "Select Consultant"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto bg-slate-900 border-slate-700 text-slate-200">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch Active Consultant
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                {availableConsultants.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => {
                      setPreviewConsultant(c);
                      // If already on consultant dashboard, force reload by navigating
                      navigate("/consultant/dashboard");
                    }}
                    className="text-xs flex items-center justify-between cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                  >
                    <div className="truncate mr-2">
                      <p className="font-semibold text-slate-100">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.title}</p>
                    </div>
                    {previewConsultant?.id === c.id && (
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <span className="hidden lg:inline text-[11px] text-muted-foreground/80">
            • Real UI & workflows • DB role remains unchanged
          </span>
        </div>

        {/* Right Side: Quick Role Switcher Buttons & Exit */}
        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
          <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Switch View:</span>
          
          <Button
            size="sm"
            variant={previewRole === "consultant" ? "default" : "outline"}
            onClick={() => switchToRole("consultant")}
            className={`h-7 px-2.5 text-xs gap-1 ${
              previewRole === "consultant"
                ? "bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400"
                : "bg-slate-900/60 border-slate-700 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Consultant</span>
          </Button>

          <Button
            size="sm"
            variant={previewRole === "client" ? "default" : "outline"}
            onClick={() => switchToRole("client")}
            className={`h-7 px-2.5 text-xs gap-1 ${
              previewRole === "client"
                ? "bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400"
                : "bg-slate-900/60 border-slate-700 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Client</span>
          </Button>

          <Button
            size="sm"
            variant={previewRole === "super_admin" ? "default" : "outline"}
            onClick={() => switchToRole("super_admin")}
            className={`h-7 px-2.5 text-xs gap-1 ${
              previewRole === "super_admin"
                ? "bg-purple-500 text-slate-950 font-semibold hover:bg-purple-400"
                : "bg-slate-900/60 border-slate-700 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Super Admin</span>
          </Button>

          <div className="h-4 w-[1px] bg-slate-700 mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={exitPreview}
            className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1"
            title="Exit Role Preview Mode"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit Preview</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

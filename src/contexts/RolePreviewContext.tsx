import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export type PreviewRole = "super_admin" | "consultant" | "client" | null;

export interface PreviewConsultant {
  id: string;
  name: string;
  title: string;
  email?: string | null;
}

interface RolePreviewContextType {
  previewRole: PreviewRole;
  previewConsultant: PreviewConsultant | null;
  availableConsultants: PreviewConsultant[];
  isLoadingConsultants: boolean;
  setPreviewRole: (role: PreviewRole) => void;
  setPreviewConsultant: (consultant: PreviewConsultant | null) => void;
  switchToRole: (role: "super_admin" | "consultant" | "client", consultantOverride?: PreviewConsultant) => void;
  exitPreview: () => void;
  isRolePreviewActive: boolean;
}

const RolePreviewContext = createContext<RolePreviewContextType | undefined>(undefined);

const STORAGE_KEY_ROLE = "foundarly_preview_role";
const STORAGE_KEY_CONSULTANT = "foundarly_preview_consultant";

export function RolePreviewProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isSuperAdmin, isDeveloperAdmin } = useAuth();
  const navigate = useNavigate();

  const [previewRole, setPreviewRoleState] = useState<PreviewRole>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_ROLE);
      if (stored === "super_admin" || stored === "consultant" || stored === "client") {
        return stored;
      }
    } catch {
      // ignore sessionStorage access errors
    }
    return null;
  });

  const [previewConsultant, setPreviewConsultantState] = useState<PreviewConsultant | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_CONSULTANT);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [availableConsultants, setAvailableConsultants] = useState<PreviewConsultant[]>([]);
  const [isLoadingConsultants, setIsLoadingConsultants] = useState(false);

  // Fetch real active consultants list from database
  useEffect(() => {
    let isMounted = true;

    async function loadConsultants() {
      setIsLoadingConsultants(true);
      try {
        const { data, error } = await supabase
          .from("consultants")
          .select("id, name, title, email, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (!error && data && isMounted) {
          const list: PreviewConsultant[] = data.map((c: any) => ({
            id: c.id,
            name: c.name || "Unnamed Consultant",
            title: c.title || "Consultant",
            email: c.email || null,
          }));
          setAvailableConsultants(list);

          // If no preview consultant is selected, select the first active consultant
          if (list.length > 0 && !previewConsultant) {
            setPreviewConsultantState(list[0]);
          }
        }
      } catch (err) {
        console.warn("[RolePreview] Could not load consultants list:", err);
      } finally {
        if (isMounted) setIsLoadingConsultants(false);
      }
    }

    loadConsultants();
    return () => {
      isMounted = false;
    };
  }, []);

  // Ensure role preview is only accessible to users with admin privileges
  useEffect(() => {
    if (!isAdmin && previewRole !== null) {
      setPreviewRoleState(null);
      try {
        sessionStorage.removeItem(STORAGE_KEY_ROLE);
        sessionStorage.removeItem(STORAGE_KEY_CONSULTANT);
      } catch {}
    }
  }, [isAdmin, previewRole]);

  const setPreviewRole = (role: PreviewRole) => {
    setPreviewRoleState(role);
    try {
      if (role) {
        sessionStorage.setItem(STORAGE_KEY_ROLE, role);
      } else {
        sessionStorage.removeItem(STORAGE_KEY_ROLE);
      }
    } catch {}
  };

  const setPreviewConsultant = (consultant: PreviewConsultant | null) => {
    setPreviewConsultantState(consultant);
    try {
      if (consultant) {
        sessionStorage.setItem(STORAGE_KEY_CONSULTANT, JSON.stringify(consultant));
      } else {
        sessionStorage.removeItem(STORAGE_KEY_CONSULTANT);
      }
    } catch {}
  };

  const switchToRole = (
    role: "super_admin" | "consultant" | "client",
    consultantOverride?: PreviewConsultant
  ) => {
    setPreviewRole(role);
    if (consultantOverride) {
      setPreviewConsultant(consultantOverride);
    } else if (role === "consultant" && !previewConsultant && availableConsultants.length > 0) {
      setPreviewConsultant(availableConsultants[0]);
    }

    if (role === "consultant") {
      toast.success("Switched to Consultant Dashboard preview mode");
      navigate("/consultant/dashboard");
    } else if (role === "client") {
      toast.success("Switched to Client Dashboard (My Bookings) preview mode");
      navigate("/my-bookings");
    } else if (role === "super_admin") {
      toast.success("Switched to Super Admin Overview preview mode");
      navigate("/admin");
    }
  };

  const exitPreview = () => {
    setPreviewRole(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY_ROLE);
    } catch {}
    toast.info("Exited role preview mode");
    navigate("/admin/developer");
  };

  const isRolePreviewActive = Boolean(isAdmin && previewRole !== null);

  return (
    <RolePreviewContext.Provider
      value={{
        previewRole,
        previewConsultant,
        availableConsultants,
        isLoadingConsultants,
        setPreviewRole,
        setPreviewConsultant,
        switchToRole,
        exitPreview,
        isRolePreviewActive,
      }}
    >
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  const context = useContext(RolePreviewContext);
  if (!context) {
    throw new Error("useRolePreview must be used within a RolePreviewProvider");
  }
  return context;
}

import { useState, useEffect, useMemo } from "react";
import {
  CalendarClock,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Calendar as CalendarIcon,
  Sparkles,
  ShieldCheck,
  Check,
  Coffee,
  Sun,
  Moon,
  Info,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { consultantsService } from "@/services/consultants";
import { bookingsService } from "@/services/bookings";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ConsultantAvailabilitySettings,
  WeekdayKey,
  TimeWindow,
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  createDefaultAvailabilitySettings,
  parseAvailabilitySettings,
  validateAvailabilitySettings,
  validateWindowsNoOverlap,
  generateAvailableSlots,
  checkDayAvailability,
  formatTime12Hour,
  time24ToMinutes,
  getNowInIST,
  APP_TIMEZONE,
  TimeSlot,
} from "@/utils/timeSlots";

const TIME_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00"
];

function formatTimeOption(time24: string): string {
  const m = time24ToMinutes(time24);
  return formatTime12Hour(Math.floor(m / 60), m % 60);
}

export default function AdminAvailabilityPricing() {
  const { formatPrice } = useCurrency();
  const { isSuperAdmin, isDeveloperAdmin } = useAuth();

  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const [settings, setSettings] = useState<ConsultantAvailabilitySettings>(createDefaultAvailabilitySettings());
  const [initialSettings, setInitialSettings] = useState<ConsultantAvailabilitySettings>(createDefaultAvailabilitySettings());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Blocked Date Input State
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // Customer Preview State
  const [previewDate, setPreviewDate] = useState<string>(() => getNowInIST().dateStr);
  const [previewDuration, setPreviewDuration] = useState<number>(60);
  const [previewBookedSlots, setPreviewBookedSlots] = useState<string[]>([]);
  const [loadingPreviewBookings, setLoadingPreviewBookings] = useState(false);

  // Load all consultants
  const { data: consultants = [], isLoading: consultantsLoading, refetch: refetchConsultants } = useQuery({
    queryKey: ["admin", "consultants", "availability"],
    queryFn: () => consultantsService.getAll(false),
  });

  // Pick first consultant initially
  useEffect(() => {
    if (consultants.length > 0 && !selectedConsultantId) {
      setSelectedConsultantId(consultants[0].id);
    }
  }, [consultants, selectedConsultantId]);

  // Load settings for the selected consultant
  const selectedConsultant = useMemo(() => {
    return consultants.find((c) => c.id === selectedConsultantId) || null;
  }, [consultants, selectedConsultantId]);

  useEffect(() => {
    if (selectedConsultant) {
      const parsed = parseAvailabilitySettings(selectedConsultant);
      setSettings(parsed);
      setInitialSettings(JSON.parse(JSON.stringify(parsed)));
      setSaveSuccess(false);
    }
  }, [selectedConsultant]);

  // Load actual booked slots for customer preview
  useEffect(() => {
    let isMounted = true;
    async function loadBookingsForDate() {
      if (!selectedConsultantId || !previewDate) {
        setPreviewBookedSlots([]);
        return;
      }
      setLoadingPreviewBookings(true);
      try {
        const booked = await bookingsService.getBookedSlots(selectedConsultantId, previewDate);
        if (isMounted) setPreviewBookedSlots(booked);
      } catch (e) {
        console.warn("Failed to load booked slots for preview:", e);
        if (isMounted) setPreviewBookedSlots([]);
      } finally {
        if (isMounted) setLoadingPreviewBookings(false);
      }
    }

    loadBookingsForDate();
    return () => {
      isMounted = false;
    };
  }, [selectedConsultantId, previewDate]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  // Validate entire settings
  const validationResult = useMemo(() => {
    return validateAvailabilitySettings(settings);
  }, [settings]);

  // Day toggle
  const handleToggleDay = (day: WeekdayKey, enabled: boolean) => {
    setSettings((prev) => {
      const currentDay = prev.weeklySchedule[day];
      const defaultWindows = currentDay.windows.length > 0
        ? currentDay.windows
        : [{ start: "10:00", end: "13:00" }, { start: "15:00", end: "18:00" }];

      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...currentDay,
            enabled,
            windows: enabled ? defaultWindows : currentDay.windows,
          },
        },
      };
    });
  };

  // Add a window to a weekday
  const handleAddWindow = (day: WeekdayKey) => {
    setSettings((prev) => {
      const currentDay = prev.weeklySchedule[day];
      const existingWindows = currentDay.windows || [];

      // Determine a sensible default start based on previous window
      let nextStart = "14:00";
      let nextEnd = "18:00";

      if (existingWindows.length > 0) {
        const lastWin = existingWindows[existingWindows.length - 1];
        const lastEndM = time24ToMinutes(lastWin.end);
        const newStartM = Math.min(1380, lastEndM + 60);
        const newEndM = Math.min(1439, newStartM + 180);
        const startH = Math.floor(newStartM / 60);
        const startMin = newStartM % 60;
        const endH = Math.floor(newEndM / 60);
        const endMin = newEndM % 60;
        nextStart = `${String(startH).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
        nextEnd = `${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
      }

      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...currentDay,
            windows: [...existingWindows, { start: nextStart, end: nextEnd }],
          },
        },
      };
    });
  };

  // Remove a window
  const handleRemoveWindow = (day: WeekdayKey, index: number) => {
    setSettings((prev) => {
      const currentDay = prev.weeklySchedule[day];
      const filtered = currentDay.windows.filter((_, i) => i !== index);
      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...currentDay,
            windows: filtered,
          },
        },
      };
    });
  };

  // Update a window
  const handleUpdateWindow = (day: WeekdayKey, index: number, field: "start" | "end", value: string) => {
    setSettings((prev) => {
      const currentDay = prev.weeklySchedule[day];
      const updated = currentDay.windows.map((w, i) => {
        if (i !== index) return w;
        return { ...w, [field]: value };
      });
      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...currentDay,
            windows: updated,
          },
        },
      };
    });
  };

  // Pricing updates
  const handlePriceChange = (field: "pricing_30" | "pricing_60", value: string) => {
    const num = Math.max(0, parseInt(value || "0", 10));
    setSettings((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [field]: num,
      },
    }));
  };

  // Add Blocked Date
  const handleAddBlockedDate = () => {
    if (!newBlockedDate) {
      toast.error("Please pick a date to block.");
      return;
    }

    const cleanDate = newBlockedDate.trim();
    if (settings.blockedDates.some((b) => b.date === cleanDate)) {
      toast.error("This date is already marked as blocked.");
      return;
    }

    setSettings((prev) => ({
      ...prev,
      blockedDates: [
        ...prev.blockedDates,
        {
          date: cleanDate,
          reason: newBlockedReason.trim() || "Consultant Leave / Holiday",
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    }));

    setNewBlockedDate("");
    setNewBlockedReason("");
    toast.success(`Date ${cleanDate} added to blocked calendar.`);
  };

  // Remove Blocked Date
  const handleRemoveBlockedDate = (dateToRemove: string) => {
    setSettings((prev) => ({
      ...prev,
      blockedDates: prev.blockedDates.filter((b) => b.date !== dateToRemove),
    }));
    toast.info(`Date ${dateToRemove} unblocked.`);
  };

  // Apply Quick Template
  const handleApplyTemplate = (type: "standard" | "extended" | "weekend") => {
    setSettings((prev) => {
      const nextSchedule = { ...prev.weeklySchedule };
      if (type === "standard") {
        for (const d of ["monday", "tuesday", "wednesday", "thursday", "friday"] as WeekdayKey[]) {
          nextSchedule[d] = {
            enabled: true,
            windows: [
              { start: "10:00", end: "13:00" },
              { start: "15:00", end: "18:00" },
            ],
          };
        }
        nextSchedule.saturday = { enabled: true, windows: [{ start: "10:00", end: "14:00" }] };
        nextSchedule.sunday = { enabled: false, windows: [] };
      } else if (type === "extended") {
        for (const d of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as WeekdayKey[]) {
          nextSchedule[d] = {
            enabled: true,
            windows: [{ start: "09:00", end: "19:00" }],
          };
        }
        nextSchedule.sunday = { enabled: false, windows: [] };
      } else if (type === "weekend") {
        for (const d of ["monday", "tuesday", "wednesday", "thursday", "friday"] as WeekdayKey[]) {
          nextSchedule[d] = { enabled: false, windows: [] };
        }
        nextSchedule.saturday = { enabled: true, windows: [{ start: "10:00", end: "18:00" }] };
        nextSchedule.sunday = { enabled: true, windows: [{ start: "11:00", end: "17:00" }] };
      }

      return {
        ...prev,
        weeklySchedule: nextSchedule,
      };
    });
    toast.success(`Applied ${type} schedule preset.`);
  };

  // Save changes to Supabase
  const handleSave = async () => {
    if (!selectedConsultantId) {
      toast.error("Please select a consultant first.");
      return;
    }

    if (!validationResult.valid) {
      toast.error(validationResult.error || "Please fix validation errors before saving.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      await consultantsService.updateAvailabilityAndPricing(selectedConsultantId, settings);
      setInitialSettings(JSON.parse(JSON.stringify(settings)));
      setSaveSuccess(true);
      toast.success("Consultant availability & consultation pricing successfully saved!");
      await refetchConsultants();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err?.message || "Failed to save availability settings.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to saved state
  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(initialSettings)));
    setSaveSuccess(false);
    toast.info("Reverted all unsaved changes.");
  };

  // Generate slots for live customer preview
  const previewSlots: TimeSlot[] = useMemo(() => {
    if (!previewDate) return [];
    return generateAvailableSlots({
      dateStr: previewDate,
      availabilitySettings: settings,
      sessionDuration: previewDuration,
      bookedTimes: previewBookedSlots,
    });
  }, [previewDate, settings, previewDuration, previewBookedSlots]);

  const previewDayStatus = useMemo(() => {
    if (!previewDate) return null;
    return checkDayAvailability(previewDate, settings);
  }, [previewDate, settings]);

  const istNow = getNowInIST();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Title & Scope Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-serif text-foreground">
                Consultant Availability & Pricing Management
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure weekly working windows, buffer times, blocked holidays, and authoritative consultation rates in INR.
              </p>
            </div>
          </div>
        </div>

        {/* IST Clock & Security Scope Badge */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1.5 border-border bg-secondary/40 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-primary mr-1.5 inline" />
            IST: {istNow.dateStr}
          </Badge>
          {isSuperAdmin && (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs py-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Super Admin
            </Badge>
          )}
          {isDeveloperAdmin && (
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-xs py-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Developer Admin
            </Badge>
          )}
        </div>
      </div>

      {/* Consultant Selector Card */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 flex-1 max-w-md">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Consultant to Manage
              </Label>
              <Select
                value={selectedConsultantId}
                onValueChange={(val) => setSelectedConsultantId(val)}
                disabled={consultantsLoading}
              >
                <SelectTrigger className="w-full h-11 bg-background border-border">
                  <SelectValue placeholder="Choose a consultant..." />
                </SelectTrigger>
                <SelectContent>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="py-2">
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profile Overview Pill */}
            {selectedConsultant && (
              <div className="flex flex-wrap items-center gap-4 p-3.5 rounded-xl border border-border/80 bg-secondary/30">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedConsultant.image_url || (selectedConsultant.gender === "female" ? "/female-default.jpg" : "/male-default.png")}
                    alt={selectedConsultant.name}
                    className="w-12 h-12 rounded-full object-cover border border-primary/20"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{selectedConsultant.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedConsultant.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selectedConsultant.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {selectedConsultant.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        30m: {formatPrice(settings.pricing.pricing_30)} | 60m: {formatPrice(settings.pricing.pricing_60)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="bg-secondary/60 p-1 border border-border/80 grid grid-cols-2 md:grid-cols-4 max-w-2xl">
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="w-4 h-4" />
            <span>Weekly Hours</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Consultation Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="holidays" className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            <span>Holidays & Blocked</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="w-4 h-4" />
            <span>Customer Preview</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. WEEKLY SCHEDULE & TIME WINDOWS */}
        <TabsContent value="schedule" className="space-y-6">
          {/* Quick Preset Templates */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-secondary/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Schedule Presets:</span>
              <span>Quickly apply common consultation working routines</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyTemplate("standard")}
                className="h-8 text-xs border-border"
              >
                Standard (Mon-Fri 10-1 & 3-6)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyTemplate("extended")}
                className="h-8 text-xs border-border"
              >
                Extended (Mon-Sat 9-7)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyTemplate("weekend")}
                className="h-8 text-xs border-border"
              >
                Weekend Only
              </Button>
            </div>
          </div>

          {/* Session Duration & Buffer Config */}
          <Card className="border border-border/80 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Appointment Duration & Session Buffers</CardTitle>
              <CardDescription className="text-xs">
                Configure appointment slot durations and turnaround rest intervals between back-to-back consultations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Default Slot Duration</Label>
                  <Select
                    value={String(settings.slotDurationMinutes || 60)}
                    onValueChange={(val) =>
                      setSettings((prev) => ({ ...prev, slotDurationMinutes: parseInt(val, 10) }))
                    }
                  >
                    <SelectTrigger className="h-10 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Minutes Consultation</SelectItem>
                      <SelectItem value="45">45 Minutes Consultation</SelectItem>
                      <SelectItem value="60">60 Minutes (1 Hour) Consultation</SelectItem>
                      <SelectItem value="90">90 Minutes Consultation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    Rest Buffer Between Consultations
                  </Label>
                  <Select
                    value={String(settings.bufferMinutes || 0)}
                    onValueChange={(val) =>
                      setSettings((prev) => ({ ...prev, bufferMinutes: parseInt(val, 10) }))
                    }
                  >
                    <SelectTrigger className="h-10 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No Buffer (Immediate back-to-back)</SelectItem>
                      <SelectItem value="5">5 Minutes Buffer</SelectItem>
                      <SelectItem value="10">10 Minutes Buffer</SelectItem>
                      <SelectItem value="15">15 Minutes Buffer (Recommended)</SelectItem>
                      <SelectItem value="30">30 Minutes Buffer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Operating Timezone</Label>
                  <div className="h-10 px-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 text-xs font-mono">
                    <span>{APP_TIMEZONE} (IST)</span>
                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                      UTC+05:30
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekday List */}
          <div className="space-y-4">
            {WEEKDAY_ORDER.map((day) => {
              const daySchedule = settings.weeklySchedule[day];
              const isEnabled = daySchedule?.enabled ?? false;
              const windows = daySchedule?.windows || [];
              const dayValidation = validateWindowsNoOverlap(windows);

              return (
                <Card
                  key={day}
                  className={`border transition-all ${
                    isEnabled
                      ? "border-border/80 bg-card/80"
                      : "border-border/40 bg-secondary/10 opacity-75"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Day Label & Toggle */}
                      <div className="flex items-center gap-3 w-44 shrink-0">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleToggleDay(day, checked)}
                          id={`switch-${day}`}
                        />
                        <Label
                          htmlFor={`switch-${day}`}
                          className={`font-semibold cursor-pointer text-sm ${
                            isEnabled ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {WEEKDAY_LABELS[day]}
                        </Label>
                        {!isEnabled && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            Off Day
                          </Badge>
                        )}
                      </div>

                      {/* Time Windows Editor */}
                      <div className="flex-1 space-y-3">
                        {isEnabled ? (
                          <>
                            {windows.length === 0 ? (
                              <div className="p-3 rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground flex items-center justify-between">
                                <span>No working windows set for {WEEKDAY_LABELS[day]}. Add at least one window.</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddWindow(day)}
                                  className="h-7 text-xs border-primary/40 text-primary"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  Add Window
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {windows.map((win, idx) => {
                                  const startMinutes = time24ToMinutes(win.start);
                                  const endMinutes = time24ToMinutes(win.end);
                                  const isInvalidWindow = startMinutes >= endMinutes;

                                  return (
                                    <div
                                      key={idx}
                                      className={`flex flex-wrap items-center gap-2.5 p-2.5 rounded-lg border ${
                                        isInvalidWindow
                                          ? "border-destructive/60 bg-destructive/10"
                                          : "border-border/60 bg-background/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground font-mono w-6">
                                          #{idx + 1}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <Select
                                            value={win.start}
                                            onValueChange={(val) => handleUpdateWindow(day, idx, "start", val)}
                                          >
                                            <SelectTrigger className="w-28 h-8 text-xs bg-background">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TIME_OPTIONS.map((t) => (
                                                <SelectItem key={t} value={t} className="text-xs">
                                                  {formatTimeOption(t)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <span className="text-muted-foreground text-xs">to</span>
                                          <Select
                                            value={win.end}
                                            onValueChange={(val) => handleUpdateWindow(day, idx, "end", val)}
                                          >
                                            <SelectTrigger className="w-28 h-8 text-xs bg-background">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TIME_OPTIONS.map((t) => (
                                                <SelectItem key={t} value={t} className="text-xs">
                                                  {formatTimeOption(t)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 ml-auto">
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                          {Math.max(0, Math.round((endMinutes - startMinutes) / 60 * 10) / 10)} hrs window
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleRemoveWindow(day, idx)}
                                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                          title="Remove window"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}

                                <div className="flex items-center justify-between pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddWindow(day)}
                                    className="h-7 text-xs border-dashed border-border"
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Add Another Window (e.g. Evening Shift)
                                  </Button>

                                  {!dayValidation.valid && (
                                    <span className="text-[11px] text-destructive flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      {dayValidation.error}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground py-1">
                            Consultant is unavailable for consultations on {WEEKDAY_LABELS[day]}s.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 2. CONSULTATION PRICING MANAGEMENT */}
        <TabsContent value="pricing" className="space-y-6">
          <Card className="border border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg font-serif">Consultation Session Pricing (INR)</CardTitle>
              <CardDescription className="text-xs">
                Manage rates for standard consultation lengths. Prices are validated server-side during checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 30-min price */}
                <div className="p-5 rounded-xl border border-border bg-secondary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                      30-Minute Consultation
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30">
                      Standard Quick Call
                    </Badge>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={settings.pricing.pricing_30}
                      onChange={(e) => handlePriceChange("pricing_30", e.target.value)}
                      className="pl-8 text-base font-semibold h-11 bg-background"
                      placeholder="1000"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Display preview: <span className="font-bold text-foreground">{formatPrice(settings.pricing.pricing_30)}</span> INR
                  </p>
                </div>

                {/* 60-min price */}
                <div className="p-5 rounded-xl border border-border bg-secondary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                      60-Minute Consultation
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono text-emerald-500 border-emerald-500/30">
                      Full Deep Dive Session
                    </Badge>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={settings.pricing.pricing_60}
                      onChange={(e) => handlePriceChange("pricing_60", e.target.value)}
                      className="pl-8 text-base font-semibold h-11 bg-background"
                      placeholder="1299"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Display preview: <span className="font-bold text-foreground">{formatPrice(settings.pricing.pricing_60)}</span> INR
                  </p>
                </div>
              </div>

              {/* Historical Guarantee Warning */}
              <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-foreground">Historical Booking Price Integrity</p>
                  <p className="text-muted-foreground">
                    Updating consultation rates affects future appointments only. All completed, confirmed, or existing client bookings strictly preserve their original paid amount and duration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. HOLIDAYS & BLOCKED DATES */}
        <TabsContent value="holidays" className="space-y-6">
          <Card className="border border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg font-serif">Blocked Dates & Holiday Calendar</CardTitle>
              <CardDescription className="text-xs">
                Block specific calendar dates when the consultant is unavailable due to holidays, personal leave, or travels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Blocked Date Form */}
              <div className="p-4 rounded-xl border border-border bg-secondary/20 flex flex-col sm:flex-row items-end gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Date to Block (YYYY-MM-DD)</Label>
                  <Input
                    type="date"
                    min={istNow.dateStr}
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    className="bg-background h-10 text-xs"
                  />
                </div>
                <div className="space-y-1.5 flex-2 w-full sm:w-80">
                  <Label className="text-xs font-semibold text-muted-foreground">Reason / Note (Optional)</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Diwali Holiday, Travel, Personal Leave"
                    value={newBlockedReason}
                    onChange={(e) => setNewBlockedReason(e.target.value)}
                    className="bg-background h-10 text-xs"
                  />
                </div>
                <Button
                  onClick={handleAddBlockedDate}
                  className="h-10 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Block Date
                </Button>
              </div>

              {/* Blocked Dates List */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Currently Blocked Dates ({settings.blockedDates?.length || 0})
                </Label>
                {settings.blockedDates && settings.blockedDates.length > 0 ? (
                  <div className="divide-y divide-border/60 rounded-xl border border-border bg-background">
                    {settings.blockedDates.map((b) => (
                      <div key={b.date} className="p-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Coffee className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground font-mono">{b.date}</p>
                            <p className="text-[11px] text-muted-foreground">{b.reason || "Blocked Date"}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBlockedDate(b.date)}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                    No blocked dates or holidays configured. The consultant is available on all active weekdays.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. CUSTOMER LIVE BOOKING PREVIEW */}
        <TabsContent value="preview" className="space-y-6">
          <Card className="border border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg font-serif">Customer Booking Page Preview</CardTitle>
              <CardDescription className="text-xs">
                Real-time preview of exact consultation slots customers will see on the booking page for this consultant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview Controls */}
              <div className="p-4 rounded-xl border border-border bg-secondary/20 flex flex-wrap items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Select Preview Date</Label>
                  <Input
                    type="date"
                    value={previewDate}
                    onChange={(e) => setPreviewDate(e.target.value)}
                    className="bg-background h-9 text-xs w-44"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Session Duration</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={previewDuration === 30 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewDuration(30)}
                      className="h-9 text-xs"
                    >
                      30 Min ({formatPrice(settings.pricing.pricing_30)})
                    </Button>
                    <Button
                      variant={previewDuration === 60 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewDuration(60)}
                      className="h-9 text-xs"
                    >
                      60 Min ({formatPrice(settings.pricing.pricing_60)})
                    </Button>
                  </div>
                </div>

                <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
                  {loadingPreviewBookings && (
                    <span className="flex items-center gap-1.5 text-primary">
                      <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                      Checking active bookings...
                    </span>
                  )}
                </div>
              </div>

              {/* Status Header for Preview Date */}
              {previewDayStatus && (
                <div>
                  {previewDayStatus.isBlocked ? (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-500 flex items-center gap-2">
                      <Coffee className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>Blocked Holiday:</strong> {previewDayStatus.blockedReason || "Consultant Leave"}. Customers will see this day as blocked.
                      </span>
                    </div>
                  ) : previewDayStatus.isDayOff ? (
                    <div className="p-4 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>Off Day:</strong> Consultant does not schedule consultations on {WEEKDAY_LABELS[previewDayStatus.weekday]}s.
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Slots Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Generated Slots for {previewDate} ({previewSlots.filter((s) => s.available).length} available / {previewSlots.length} total)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Available
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> Booked / Past
                    </span>
                  </div>
                </div>

                {previewSlots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {previewSlots.map((slot, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                          slot.available
                            ? "bg-secondary/60 border-border text-foreground hover:border-primary/60 cursor-pointer"
                            : "bg-secondary/15 border-border/40 text-muted-foreground/40 cursor-not-allowed"
                        }`}
                      >
                        <span className={`text-xs font-semibold ${!slot.available ? "line-through" : ""}`}>
                          {slot.time}
                        </span>
                        <span className="text-[10px] opacity-75">
                          {slot.available
                            ? "Available"
                            : slot.reason === "booked"
                            ? "Booked"
                            : slot.reason === "past"
                            ? "Past"
                            : slot.reason === "holiday"
                            ? "Holiday"
                            : "Day Off"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                    No time slots generated for this date. Ensure weekday is enabled and at least one time window is configured.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating or Bottom Save Bar */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-background/95 backdrop-blur shadow-lg">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <Badge variant="outline" className="text-amber-500 border-amber-500/40 bg-amber-500/10 text-xs">
              Unsaved Changes Pending
            </Badge>
          ) : saveSuccess ? (
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 bg-emerald-500/10 text-xs flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved to Supabase
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">All changes saved</span>
          )}
          {!validationResult.valid && (
            <span className="text-xs text-destructive font-medium ml-2">
              Error: {validationResult.error}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasUnsavedChanges || saving}
            className="h-10 text-xs border-border"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Discard Changes
          </Button>

          <Button
            onClick={handleSave}
            disabled={!validationResult.valid || saving || !hasUnsavedChanges}
            className="h-10 px-5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 glow-gold-sm font-semibold"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Saving to Database...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Save Availability & Pricing
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

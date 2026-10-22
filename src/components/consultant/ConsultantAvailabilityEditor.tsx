import { useState, useEffect, useMemo } from "react";
import {
  CalendarClock,
  Clock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Calendar as CalendarIcon,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
  Coffee,
  Sun,
  Moon,
  Ban,
  CalendarCheck,
} from "lucide-react";
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
  parseConsultantAvailabilityHours,
  validateConfirmedBookingConflicts,
} from "@/utils/timeSlots";
import {
  consultantDashboardService,
  ConsultantSelfAvailabilityData,
  UserIdentifier,
} from "@/services/consultantDashboard";
import { bookingsService } from "@/services/bookings";
import { useCurrency } from "@/contexts/CurrencyContext";

const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
  "22:00", "22:30", "23:00"
];

function formatTimeOption(time24: string): string {
  const m = time24ToMinutes(time24);
  return formatTime12Hour(Math.floor(m / 60), m % 60);
}

interface ConsultantAvailabilityEditorProps {
  user: { id: string; email?: string | null };
  onAvailabilityUpdated?: () => void;
}

export default function ConsultantAvailabilityEditor({
  user,
  onAvailabilityUpdated,
}: ConsultantAvailabilityEditorProps) {
  const { formatPrice } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [data, setData] = useState<ConsultantSelfAvailabilityData | null>(null);

  const [settings, setSettings] = useState<ConsultantAvailabilitySettings>(createDefaultAvailabilitySettings());
  const [initialSettings, setInitialSettings] = useState<ConsultantAvailabilitySettings>(createDefaultAvailabilitySettings());

  // Blocked Date Form State
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // Customer Preview State
  const [previewDate, setPreviewDate] = useState<string>(() => getNowInIST().dateStr);
  const [previewDuration, setPreviewDuration] = useState<number>(60);
  const [previewBookedSlots, setPreviewBookedSlots] = useState<string[]>([]);
  const [loadingPreviewBookings, setLoadingPreviewBookings] = useState(false);

  // Load availability and application data
  const loadAvailability = async () => {
    setLoading(true);
    try {
      const res = await consultantDashboardService.getMyAvailability({
        id: user.id,
        email: user.email,
      });

      if (res) {
        setData(res);
        setSettings(res.settings);
        setInitialSettings(JSON.parse(JSON.stringify(res.settings)));
        setPreviewDuration(res.settings.slotDurationMinutes || 60);
      }
    } catch (err) {
      console.error("Error loading consultant availability:", err);
      toast.error("Failed to load your availability settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, [user.id]);

  // Load confirmed booked slots for the preview date
  useEffect(() => {
    let isMounted = true;
    async function loadBookingsForDate() {
      if (!data?.consultantId || !previewDate) {
        setPreviewBookedSlots([]);
        return;
      }
      setLoadingPreviewBookings(true);
      try {
        const booked = await bookingsService.getBookedSlots(data.consultantId, previewDate);
        if (isMounted) setPreviewBookedSlots(booked);
      } catch (e) {
        if (isMounted) setPreviewBookedSlots([]);
      } finally {
        if (isMounted) setLoadingPreviewBookings(false);
      }
    }

    loadBookingsForDate();
    return () => {
      isMounted = false;
    };
  }, [data?.consultantId, previewDate]);

  // Check if settings have unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  // Real-time Schedule Validation Errors per Day
  const scheduleValidationErrors = useMemo(() => {
    const errors: Record<WeekdayKey, string | null> = {
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    };

    for (const day of WEEKDAY_ORDER) {
      const daySchedule = settings.weeklySchedule[day];
      if (!daySchedule?.enabled) continue;

      if (!daySchedule.windows || daySchedule.windows.length === 0) {
        errors[day] = "At least one time window is required for enabled days.";
        continue;
      }

      const check = validateWindowsNoOverlap(daySchedule.windows);
      if (!check.valid) {
        errors[day] = check.error || "Invalid time windows.";
      }
    }

    return errors;
  }, [settings.weeklySchedule]);

  const hasAnyScheduleError = Object.values(scheduleValidationErrors).some((e) => e !== null);

  // Check if current settings conflict with upcoming confirmed bookings
  const confirmedBookingConflicts = useMemo(() => {
    if (!data?.confirmedBookings || data.confirmedBookings.length === 0) {
      return { hasConflict: false, conflicts: [] };
    }
    return validateConfirmedBookingConflicts(settings, data.confirmedBookings);
  }, [settings, data?.confirmedBookings]);

  // Toggle Day Availability
  const handleToggleDay = (day: WeekdayKey, enabled: boolean) => {
    setSettings((prev) => {
      const current = prev.weeklySchedule[day];
      const defaultWindows: TimeWindow[] =
        current.windows && current.windows.length > 0
          ? current.windows
          : [{ start: "10:00", end: "13:00" }, { start: "15:00", end: "18:00" }];

      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            enabled,
            windows: defaultWindows,
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  // Add Window to a Day
  const handleAddWindow = (day: WeekdayKey) => {
    setSettings((prev) => {
      const currentWindows = prev.weeklySchedule[day]?.windows || [];
      const lastWindow = currentWindows[currentWindows.length - 1];

      let newStart = "14:00";
      let newEnd = "18:00";

      if (lastWindow) {
        const lastEndM = time24ToMinutes(lastWindow.end);
        const nextStartM = Math.min(1320, lastEndM + 60); // 1 hour after previous
        const nextEndM = Math.min(1380, nextStartM + 180);
        newStart = TIME_OPTIONS.find((t) => time24ToMinutes(t) >= nextStartM) || "15:00";
        newEnd = TIME_OPTIONS.find((t) => time24ToMinutes(t) >= nextEndM) || "18:00";
      }

      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...prev.weeklySchedule[day],
            windows: [...currentWindows, { start: newStart, end: newEnd }],
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  // Remove Window from a Day
  const handleRemoveWindow = (day: WeekdayKey, index: number) => {
    setSettings((prev) => {
      const currentWindows = prev.weeklySchedule[day]?.windows || [];
      const updated = currentWindows.filter((_, i) => i !== index);
      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...prev.weeklySchedule[day],
            windows: updated,
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  // Update Window Times
  const handleUpdateWindow = (
    day: WeekdayKey,
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    setSettings((prev) => {
      const currentWindows = [...(prev.weeklySchedule[day]?.windows || [])];
      if (!currentWindows[index]) return prev;

      currentWindows[index] = {
        ...currentWindows[index],
        [field]: value,
      };

      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...prev.weeklySchedule[day],
            windows: currentWindows,
          },
        },
      };
    });
    setSaveSuccess(false);
  };

  // Add Blocked Date
  const handleAddBlockedDate = () => {
    if (!newBlockedDate) {
      toast.error("Please pick a date to block.");
      return;
    }

    if (settings.blockedDates.some((b) => b.date === newBlockedDate)) {
      toast.error("This date is already blocked.");
      return;
    }

    // Check if this date has a confirmed booking
    const hasBookingOnDate = (data?.confirmedBookings || []).some(
      (b) => b.status === "confirmed" && (b.date.includes("T") ? b.date.split("T")[0] : b.date) === newBlockedDate
    );

    if (hasBookingOnDate) {
      toast.error(
        `Cannot block ${newBlockedDate}: You have an active confirmed consultation booked on this date. Please reschedule or fulfill it first.`
      );
      return;
    }

    setSettings((prev) => ({
      ...prev,
      blockedDates: [
        ...prev.blockedDates,
        {
          date: newBlockedDate,
          reason: newBlockedReason.trim() || "Consultant Leave",
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    }));

    setNewBlockedDate("");
    setNewBlockedReason("");
    setSaveSuccess(false);
    toast.success(`Date ${newBlockedDate} added to blocked dates.`);
  };

  // Remove Blocked Date
  const handleRemoveBlockedDate = (dateStr: string) => {
    setSettings((prev) => ({
      ...prev,
      blockedDates: prev.blockedDates.filter((b) => b.date !== dateStr),
    }));
    setSaveSuccess(false);
  };

  // Reset to original application preference
  const handleResetToApplicationDefault = () => {
    const originalTiming = data?.originalApplication.preferredTiming;
    if (!originalTiming) {
      toast.info("No original application preference found.");
      return;
    }

    const hours = parseConsultantAvailabilityHours(originalTiming);
    const start24 = `${String(hours.startHour).padStart(2, "0")}:00`;
    const end24 = `${String(hours.endHour).padStart(2, "0")}:00`;

    const newSchedule: Record<WeekdayKey, any> = { ...createDefaultAvailabilitySettings().weeklySchedule };
    for (const d of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as WeekdayKey[]) {
      newSchedule[d] = {
        enabled: true,
        windows: [{ start: start24, end: end24 }],
      };
    }
    newSchedule.sunday = { enabled: false, windows: [] };

    setSettings((prev) => ({
      ...prev,
      weeklySchedule: newSchedule,
    }));
    setSaveSuccess(false);
    toast.success(`Schedule reset to your application preference: ${originalTiming}`);
  };

  // Save Availability Changes
  const handleSave = async () => {
    // 1. Validation
    const validation = validateAvailabilitySettings(settings);
    if (!validation.valid) {
      toast.error(validation.error || "Please resolve schedule validation errors.");
      return;
    }

    // 2. Confirmed bookings conflict check
    if (confirmedBookingConflicts.hasConflict) {
      toast.error(confirmedBookingConflicts.errorMessage || "Schedule conflicts with existing confirmed bookings.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await consultantDashboardService.updateMyAvailability(
        { id: user.id, email: user.email },
        settings
      );

      if (res.success) {
        setSaveSuccess(true);
        setInitialSettings(JSON.parse(JSON.stringify(settings)));
        toast.success(res.message || "Your availability has been saved and is now live!");
        if (onAvailabilityUpdated) onAvailabilityUpdated();
        loadAvailability();
      } else {
        toast.error(res.error || "Failed to update availability.");
        if (res.conflicts && res.conflicts.length > 0) {
          console.warn("Conflicts detected:", res.conflicts);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setSettings(JSON.parse(JSON.stringify(initialSettings)));
    setSaveSuccess(false);
    toast.info("Changes discarded.");
  };

  // Generate Preview Slots
  const previewSlots: TimeSlot[] = useMemo(() => {
    if (!previewDate) return [];

    const simulatedConsultant = {
      id: data?.consultantId || "preview",
      name: data?.consultantName || "You",
      pricing_30: data?.adminPricing.pricing_30 || 1000,
      pricing_60: data?.adminPricing.pricing_60 || 1299,
      availability_settings: settings,
      preferred_time: data?.originalApplication.preferredTiming,
    };

    return generateAvailableSlots({
      consultant: simulatedConsultant,
      dateStr: previewDate,
      bookedSlots: previewBookedSlots,
      sessionDuration: previewDuration,
      bufferMinutes: settings.bufferMinutes,
    });
  }, [settings, previewDate, previewBookedSlots, previewDuration, data]);

  const previewDayCheck = useMemo(() => {
    return checkDayAvailability(settings, previewDate);
  }, [settings, previewDate]);

  if (loading) {
    return (
      <Card className="p-8 text-center border-border/40">
        <div className="flex flex-col items-center justify-center space-y-3">
          <CalendarClock className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm font-medium">Loading your availability settings...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Application Preferences */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  My Consultation Availability & Schedule
                </h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Configure your active working hours, multiple shifts (e.g. morning and evening), slot duration, rest buffer, and holidays in <strong>India Standard Time (IST: UTC+05:30)</strong>. Changes reflect immediately on your customer booking page.
              </p>
            </div>

            {/* Original Application Preference Badge & Reset */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
              <div className="px-3.5 py-2 rounded-xl bg-background/80 border border-primary/30 backdrop-blur-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Original Application Preference
                </div>
                <div className="text-sm font-bold text-foreground">
                  {data?.originalApplication.preferredTiming || "Flexible (Any Time)"}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToApplicationDefault}
                className="text-xs h-9"
                title="Reset schedule windows to match your original application preference"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Restore Default
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmed Bookings Safeguard Notice */}
      {data?.confirmedBookings && data.confirmedBookings.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CalendarCheck className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-semibold text-foreground">
                Active Confirmed Sessions Protected ({data.confirmedBookings.length})
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You have {data.confirmedBookings.length} upcoming confirmed booking(s). To protect your clients, availability changes that overlap with these sessions are prevented. If you need to change those dates or times, please use the Reschedule option first.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmed Booking Conflict Warning */}
      {confirmedBookingConflicts.hasConflict && (
        <Card className="border-destructive/40 bg-destructive/10 animate-pulse">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1 text-destructive">
              <div className="font-bold">Schedule Conflict Detected</div>
              <p className="text-xs">{confirmedBookingConflicts.errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. Main Grid: Weekly Schedule + Blocked Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Weekly Working Hours */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Weekly Working Windows
                  </CardTitle>
                  <CardDescription>
                    Enable weekdays and set multiple time windows (e.g. 10:00 AM–1:00 PM and 3:00 PM–6:00 PM).
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-muted/40">
                  IST (UTC+05:30)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {WEEKDAY_ORDER.map((day) => {
                const daySchedule = settings.weeklySchedule[day];
                const isEnabled = daySchedule?.enabled ?? false;
                const windows = daySchedule?.windows || [];
                const dayError = scheduleValidationErrors[day];

                return (
                  <div
                    key={day}
                    className={`p-4 rounded-xl border transition-all ${
                      isEnabled
                        ? "bg-card border-border shadow-sm"
                        : "bg-muted/20 border-border/40 opacity-70"
                    }`}
                  >
                    {/* Day Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`switch-${day}`}
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleToggleDay(day, checked)}
                        />
                        <Label
                          htmlFor={`switch-${day}`}
                          className={`font-semibold cursor-pointer text-base ${
                            isEnabled ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {WEEKDAY_LABELS[day]}
                        </Label>
                      </div>

                      {isEnabled ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddWindow(day)}
                          className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 font-medium"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Window
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          Unavailable
                        </span>
                      )}
                    </div>

                    {/* Windows List */}
                    {isEnabled && (
                      <div className="space-y-2.5 pl-9">
                        {windows.map((window, winIndex) => (
                          <div
                            key={winIndex}
                            className="flex flex-wrap items-center gap-2.5 p-2 rounded-lg bg-background border border-border/60"
                          >
                            <span className="text-xs font-semibold text-muted-foreground w-16">
                              Shift {winIndex + 1}:
                            </span>

                            {/* Start Time Select */}
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={window.start}
                                onValueChange={(val) =>
                                  handleUpdateWindow(day, winIndex, "start", val)
                                }
                              >
                                <SelectTrigger className="w-[125px] h-8 text-xs font-mono">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem
                                      key={time}
                                      value={time}
                                      className="text-xs font-mono"
                                    >
                                      {formatTimeOption(time)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <span className="text-muted-foreground text-xs font-medium">to</span>

                            {/* End Time Select */}
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={window.end}
                                onValueChange={(val) =>
                                  handleUpdateWindow(day, winIndex, "end", val)
                                }
                              >
                                <SelectTrigger className="w-[125px] h-8 text-xs font-mono">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem
                                      key={time}
                                      value={time}
                                      className="text-xs font-mono"
                                    >
                                      {formatTimeOption(time)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Remove Window Button */}
                            {windows.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveWindow(day, winIndex)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto"
                                title="Remove time window"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}

                        {/* Validation Error Banner */}
                        {dayError && (
                          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{dayError}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Buffer & Slot Duration Settings */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Coffee className="h-4 w-4 text-primary" />
                Slot Duration & Preparation Buffer
              </CardTitle>
              <CardDescription>
                Tune the appointment interval and resting window between customer meetings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">
                    Slot Interval Duration
                  </Label>
                  <Select
                    value={String(settings.slotDurationMinutes || 60)}
                    onValueChange={(val) => {
                      setSettings((prev) => ({
                        ...prev,
                        slotDurationMinutes: parseInt(val, 10),
                      }));
                      setSaveSuccess(false);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Minutes (Quick Consultation)</SelectItem>
                      <SelectItem value="60">60 Minutes (Standard Deep Dive)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Defines the time stepping between consecutive available slot starts.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">
                    Turnaround Buffer Between Sessions
                  </Label>
                  <Select
                    value={String(settings.bufferMinutes ?? 0)}
                    onValueChange={(val) => {
                      setSettings((prev) => ({
                        ...prev,
                        bufferMinutes: parseInt(val, 10),
                      }));
                      setSaveSuccess(false);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 Minutes (Back-to-back)</SelectItem>
                      <SelectItem value="5">5 Minutes</SelectItem>
                      <SelectItem value="10">10 Minutes</SelectItem>
                      <SelectItem value="15">15 Minutes (Recommended)</SelectItem>
                      <SelectItem value="30">30 Minutes</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Preparation rest time added between consecutive client bookings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 span): Blocked Dates + Live Preview + Admin Pricing Info */}
        <div className="space-y-6">
          {/* Action Bar (Sticky or Top) */}
          <Card className="border-primary/30 shadow-md bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </span>
                {saveSuccess ? (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Saved Live
                  </Badge>
                ) : hasUnsavedChanges ? (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1">
                    <AlertTriangle className="h-3 w-3" /> Unsaved Changes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                    Up to Date
                  </Badge>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || hasAnyScheduleError || confirmedBookingConflicts.hasConflict || !hasUnsavedChanges}
                  className="w-full gap-2 font-semibold shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving Changes..." : "Save Availability Changes"}
                </Button>

                {hasUnsavedChanges && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscard}
                    disabled={saving}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Discard Changes
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Blocked Dates & Holidays */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                Holidays & Blocked Dates
              </CardTitle>
              <CardDescription>
                Mark specific dates as unavailable for leave or holidays.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-medium">Select Date</Label>
                  <Input
                    type="date"
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    min={getNowInIST().dateStr}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Reason (Optional)</Label>
                  <Input
                    placeholder="e.g. Personal Leave, Conference"
                    value={newBlockedReason}
                    onChange={(e) => setNewBlockedReason(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBlockedDate}
                  className="w-full text-xs h-8 gap-1 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Blocked Date
                </Button>
              </div>

              {/* Blocked Dates List */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                {settings.blockedDates.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No blocked dates configured.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {settings.blockedDates.map((blocked) => (
                      <div
                        key={blocked.date}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/40 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{blocked.date}</div>
                          {blocked.reason && (
                            <div className="text-[11px] text-muted-foreground">{blocked.reason}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBlockedDate(blocked.date)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove blocked date"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pricing Transparency Card (Admin Controlled) */}
          <Card className="border-border/60 bg-muted/10 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Consultation Pricing (Platform Managed)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">30-Minute Session:</span>
                <span className="font-bold text-foreground">
                  {formatPrice(data?.adminPricing.pricing_30 || 1000)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">60-Minute Session:</span>
                <span className="font-bold text-foreground">
                  {formatPrice(data?.adminPricing.pricing_60 || 1299)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                Platform administrators configure consultation fees to guarantee consistent client billing. To request a pricing adjustment, contact{" "}
                <a href="mailto:hello@foundarlybusinessworld.in" className="text-primary hover:underline">
                  hello@foundarlybusinessworld.in
                </a>.
              </p>
            </CardContent>
          </Card>

          {/* Live Customer Booking Preview */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Live Customer Booking Preview
              </CardTitle>
              <CardDescription>
                Test how your slots look to clients on any chosen date.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-medium">Preview Date</Label>
                  <Input
                    type="date"
                    value={previewDate}
                    onChange={(e) => setPreviewDate(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Session Duration</Label>
                  <Select
                    value={String(previewDuration)}
                    onValueChange={(v) => setPreviewDuration(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Min</SelectItem>
                      <SelectItem value="60">60 Min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Day Check Status */}
              <div className="p-2 rounded-md bg-muted/40 text-xs">
                <span className="font-semibold text-foreground">
                  {WEEKDAY_LABELS[previewDayCheck.dayOfWeek]} status:
                </span>{" "}
                <span className={previewDayCheck.available ? "text-green-500 font-medium" : "text-amber-500 font-medium"}>
                  {previewDayCheck.reason || (previewDayCheck.available ? "Available for bookings" : "Unavailable")}
                </span>
              </div>

              {/* Slots Grid */}
              <div className="pt-2 border-t border-border/40">
                <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                  <span>Available Slots ({previewSlots.filter((s) => s.available).length}):</span>
                  {loadingPreviewBookings && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">
                      checking bookings...
                    </span>
                  )}
                </div>

                {previewSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    No time slots generated for this date.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {previewSlots.map((slot) => (
                      <div
                        key={slot.time}
                        className={`p-2 rounded text-center text-xs font-mono border transition-all ${
                          slot.available
                            ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 font-semibold"
                            : "bg-muted/30 border-border/40 text-muted-foreground opacity-60 line-through"
                        }`}
                        title={slot.reason ? `Unavailable: ${slot.reason}` : "Available to book"}
                      >
                        {slot.time}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

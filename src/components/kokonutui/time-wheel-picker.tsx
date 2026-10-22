"use client";

import React, { useState } from "react";
import WheelPicker, { WheelColumn } from "./wheel-picker";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Check } from "lucide-react";

export interface TimeWheelPickerProps {
  initialTime24?: string; // e.g. "14:30"
  onTimeSelected?: (time24: string, display12: string) => void;
  label?: string;
  className?: string;
}

const HOURS_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 1;
  return { value: String(h), label: String(h).padStart(2, "0") };
});

const MINUTES_OPTIONS = [
  { value: "0", label: "00" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
];

const PERIOD_OPTIONS = [
  { value: "am", label: "AM" },
  { value: "pm", label: "PM" },
];

const TIME_COLUMNS: WheelColumn[] = [
  {
    id: "hour",
    label: "Hour",
    loop: true,
    className: "w-16",
    options: HOURS_OPTIONS,
  },
  {
    id: "minute",
    label: "Minute",
    loop: true,
    className: "w-16",
    options: MINUTES_OPTIONS,
  },
  {
    id: "period",
    label: "Period",
    className: "w-16",
    options: PERIOD_OPTIONS,
  },
];

export function TimeWheelPicker({
  initialTime24 = "10:00",
  onTimeSelected,
  label = "Select Consultation Time",
  className,
}: TimeWheelPickerProps) {
  // Parse initial 24h into hour, minute, period
  const [hour24, minute24] = initialTime24.split(":").map(Number);
  const initialPeriod = (hour24 || 0) >= 12 ? "pm" : "am";
  let initialHour12 = (hour24 || 0) % 12;
  if (initialHour12 === 0) initialHour12 = 12;

  const [pickerValue, setPickerValue] = useState<Record<string, string>>({
    hour: String(initialHour12),
    minute: String(minute24 || 0),
    period: initialPeriod,
  });

  const getComputedTime = (val: Record<string, string>) => {
    const rawH = parseInt(val.hour || "10", 10);
    const m = parseInt(val.minute || "0", 10);
    const isPm = val.period === "pm";

    let h24 = rawH;
    if (isPm && rawH < 12) h24 = rawH + 12;
    if (!isPm && rawH === 12) h24 = 0;

    const time24 = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const display12 = `${String(rawH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${val.period.toUpperCase()}`;
    return { time24, display12 };
  };

  const handleChange = (newVal: Record<string, string>) => {
    setPickerValue(newVal);
    const { time24, display12 } = getComputedTime(newVal);
    onTimeSelected?.(time24, display12);
  };

  const { time24, display12 } = getComputedTime(pickerValue);

  return (
    <Card className="p-5 bg-card/90 backdrop-blur-md border-border/80 rounded-2xl shadow-lg flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
          {display12} IST
        </Badge>
      </div>

      <div className="py-2 flex justify-center">
        <WheelPicker
          columns={TIME_COLUMNS}
          value={pickerValue}
          onValueChange={handleChange}
          className={className}
        />
      </div>

      <div className="w-full mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>24h Time: <strong className="font-mono text-foreground">{time24}</strong></span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onTimeSelected?.(time24, display12)}
          className="gap-1.5 h-7 text-xs rounded-full border-primary/40 hover:bg-primary/10"
        >
          <Check className="w-3.5 h-3.5 text-primary" />
          Confirm Time
        </Button>
      </div>
    </Card>
  );
}

export default TimeWheelPicker;

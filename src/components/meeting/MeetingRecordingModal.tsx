/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Recording Completion Modal
 * Allows participants to preview their consultation recording, review duration & size,
 * and download high-definition video directly to their device.
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RecordingResult } from "@/utils/meetingRecorder";
import { Download, Film, CheckCircle2, Clock, HardDrive, ShieldCheck, Play } from "lucide-react";
import { toast } from "sonner";

interface MeetingRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: RecordingResult | null;
  sessionTitle?: string;
}

export default function MeetingRecordingModal({
  open,
  onOpenChange,
  result,
  sessionTitle,
}: MeetingRecordingModalProps) {
  if (!result) return null;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Recording downloaded to your device");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-2xl border-border/80 shadow-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display text-foreground">
                Meeting Recording Saved
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {sessionTitle || "Consultation Session"} recording is ready for preview and download.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Video Player Preview */}
        <div className="my-3 rounded-xl overflow-hidden border border-border/80 bg-black aspect-video relative shadow-inner">
          <video
            src={result.url}
            controls
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Recording Stats */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-secondary/50 rounded-xl border border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Duration</p>
              <p className="font-semibold text-foreground">{result.formattedDuration}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">File Size</p>
              <p className="font-semibold text-foreground">{result.formattedSize}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Format</p>
              <p className="font-semibold text-foreground uppercase">{result.filename.split('.').pop() || 'WEBM'}</p>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span>
            This recording was processed on-device in your browser. Download it now to retain permanent offline access.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
          <Button
            onClick={handleDownload}
            className="glow-gold-sm text-xs font-semibold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Recording ({result.formattedSize})</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

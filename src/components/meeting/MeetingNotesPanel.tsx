/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly Meeting Notes & Real-time Action Items Panel
 * Allows both consultants and clients to collaboratively take notes,
 * create and track action items, manage private confidential thoughts,
 * and download/export consultation summaries.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  X,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  CheckSquare,
  Square,
  FileText,
  Lock,
  Share2,
  Sparkles,
  Clock,
  User,
  Calendar,
  AlertCircle,
  RotateCw,
  Flame,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  meetingNotesService,
  MeetingNotesData,
  MeetingActionItem,
} from "@/services/meetingNotesService";

interface MeetingNotesPanelProps {
  roomId: string;
  booking: any;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "client" | "consultant" | "admin";
  onClose: () => void;
  broadcastChannel?: any;
  className?: string;
  activeTabDefault?: "action_items" | "shared_notes" | "private_notes";
}

export default function MeetingNotesPanel({
  roomId,
  booking,
  currentUserId,
  currentUserName,
  currentUserRole,
  onClose,
  broadcastChannel,
  className,
  activeTabDefault = "action_items",
}: MeetingNotesPanelProps) {
  const [activeTab, setActiveTab] = useState<"action_items" | "shared_notes" | "private_notes">(activeTabDefault);
  const [notesData, setNotesData] = useState<MeetingNotesData>(() => meetingNotesService.getCachedNotes(roomId));
  const [privateNotes, setPrivateNotes] = useState<string>(() => meetingNotesService.getPrivateNotes(roomId, currentUserId));
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  
  // Action item form state
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<"client" | "consultant" | "both">("both");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "normal">("normal");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "completed">("all");

  // Shared notes input & debounce
  const [sharedNotesText, setSharedNotesText] = useState(notesData.sharedNotes || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Load notes on mount
  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await meetingNotesService.getNotes(roomId);
      if (res.notes) {
        setNotesData(res.notes);
        if (!isTypingRef.current) {
          setSharedNotesText(res.notes.sharedNotes || "");
        }
      }
      setLastSyncTime(new Date());
    } catch {
      // Graceful fallback to cache
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Listen for real-time broadcasts on the room channel
  useEffect(() => {
    if (!broadcastChannel) return;

    const notesListener = broadcastChannel.on(
      "broadcast",
      { event: "meeting_notes_sync" },
      ({ payload }: { payload: any }) => {
        if (!payload || payload.senderId === currentUserId) return;

        console.log("[Meeting Notes] Received real-time sync broadcast:", payload);
        if (payload.notes) {
          setNotesData(payload.notes);
          if (!isTypingRef.current && payload.notes.sharedNotes !== undefined) {
            setSharedNotesText(payload.notes.sharedNotes);
          }
          setLastSyncTime(new Date());
          if (payload.action === "action_item_added") {
            toast.info(`New action item added by ${payload.senderName || "other participant"}`);
          } else if (payload.action === "action_item_toggled") {
            toast.info(`Action item updated by ${payload.senderName || "other participant"}`);
          }
        }
      }
    );

    return () => {
      // Channel cleanup handled by parent
    };
  }, [broadcastChannel, currentUserId]);

  // Broadcast notes sync to other participant
  const broadcastSync = (actionType: string, updatedNotes: MeetingNotesData) => {
    if (broadcastChannel && typeof broadcastChannel.send === "function") {
      broadcastChannel.send({
        type: "broadcast",
        event: "meeting_notes_sync",
        payload: {
          action: actionType,
          senderId: currentUserId,
          senderName: currentUserName,
          senderRole: currentUserRole,
          notes: updatedNotes,
          timestamp: new Date().toISOString(),
        },
      }).catch((err: any) => console.warn("[Meeting Notes] Broadcast warning:", err));
    }
  };

  // Shared Notes Change Handler (with 700ms debounce)
  const handleSharedNotesChange = (text: string) => {
    setSharedNotesText(text);
    isTypingRef.current = true;
    setIsSyncing(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await meetingNotesService.updateSharedNotes(roomId, text);
        if (res.success && res.notes) {
          setNotesData(res.notes);
          broadcastSync("notes_updated", res.notes);
        }
        setLastSyncTime(new Date());
      } catch (err) {
        console.warn("[Meeting Notes] Auto-save error:", err);
      } finally {
        setIsSyncing(false);
        isTypingRef.current = false;
      }
    }, 700);
  };

  // Private notes change handler
  const handlePrivateNotesChange = (text: string) => {
    setPrivateNotes(text);
    meetingNotesService.savePrivateNotes(roomId, text, currentUserId);
  };

  // Add Action Item
  const handleAddActionItem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newTaskText.trim();
    if (!text || isAddingTask) return;

    setIsAddingTask(true);
    try {
      const res = await meetingNotesService.addActionItem(roomId, {
        text,
        assignee: newTaskAssignee,
        priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined,
      });

      if (res.success && res.notes) {
        setNotesData(res.notes);
        setNewTaskText("");
        setNewTaskDueDate("");
        broadcastSync("action_item_added", res.notes);
        toast.success("Action item added!");
      } else {
        toast.error(res.error || "Failed to add action item");
      }
    } catch {
      toast.error("Network error adding action item");
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle Action Item
  const handleToggleActionItem = async (itemId: string, currentCompleted: boolean) => {
    // Optimistic UI update
    const nextCompleted = !currentCompleted;
    setNotesData((prev) => ({
      ...prev,
      actionItems: prev.actionItems.map((item) =>
        item.id === itemId
          ? { ...item, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : null }
          : item
      ),
    }));

    try {
      const res = await meetingNotesService.toggleActionItem(roomId, itemId, nextCompleted);
      if (res.success && res.notes) {
        setNotesData(res.notes);
        broadcastSync("action_item_toggled", res.notes);
      }
    } catch {
      toast.error("Failed to update action item");
      loadNotes(); // Revert
    }
  };

  // Delete Action Item
  const handleDeleteActionItem = async (itemId: string) => {
    setNotesData((prev) => ({
      ...prev,
      actionItems: prev.actionItems.filter((i) => i.id !== itemId),
    }));

    try {
      const res = await meetingNotesService.deleteActionItem(roomId, itemId);
      if (res.success && res.notes) {
        setNotesData(res.notes);
        broadcastSync("action_item_deleted", res.notes);
        toast.info("Action item removed");
      }
    } catch {
      toast.error("Failed to delete action item");
      loadNotes();
    }
  };

  // Template Quick Add
  const handleQuickAddTemplate = (templateText: string, assignee: "client" | "consultant" | "both") => {
    setNewTaskText(templateText);
    setNewTaskAssignee(assignee);
  };

  // Insert Template Section in Shared Notes
  const handleInsertSection = (sectionTitle: string) => {
    const addition = `\n\n### ${sectionTitle}\n- `;
    const updated = (sharedNotesText + addition).trimStart();
    handleSharedNotesChange(updated);
  };

  // Download Summary Document
  const handleDownloadSummary = () => {
    const doc = meetingNotesService.generateSummaryDocument(booking, notesData, privateNotes);
    const blob = new Blob([doc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanDate = booking?.date || new Date().toISOString().slice(0, 10);
    a.download = `Foundarly-Consultation-Notes-${cleanDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Consultation notes & action items downloaded!");
  };

  // Copy Summary to Clipboard
  const handleCopySummary = async () => {
    const doc = meetingNotesService.generateSummaryDocument(booking, notesData, privateNotes);
    try {
      await navigator.clipboard.writeText(doc);
      toast.success("Summary copied to clipboard!");
    } catch {
      toast.error("Failed to copy summary");
    }
  };

  // Filtered action items
  const filteredActionItems = notesData.actionItems.filter((item) => {
    if (filterMode === "pending") return !item.completed;
    if (filterMode === "completed") return item.completed;
    return true;
  });

  const totalItems = notesData.actionItems.length;
  const completedItems = notesData.actionItems.filter((i) => i.completed).length;
  const percentComplete = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div
      className={cn(
        "w-80 sm:w-96 flex flex-col h-full bg-card/95 backdrop-blur-2xl border-l border-border/80 shadow-2xl relative z-30 transition-all select-text",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-secondary/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-foreground truncate">Meeting Notes</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                Live Sync
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {isSyncing ? "Syncing changes..." : `Synced • ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopySummary}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
            title="Copy formatted summary"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownloadSummary}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
            title="Download Notes & Action Items (.md)"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
            title="Close notes panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="px-3 pt-2.5 pb-2 bg-secondary/20 border-b border-border/60 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("action_items")}
          className={cn(
            "flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5",
            activeTab === "action_items"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Action Items</span>
          {totalItems > 0 && (
            <span className={cn(
              "text-[10px] px-1 rounded-full",
              activeTab === "action_items" ? "bg-black/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
            )}>
              {completedItems}/{totalItems}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shared_notes")}
          className={cn(
            "flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5",
            activeTab === "shared_notes"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Shared Notes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("private_notes")}
          className={cn(
            "text-xs py-1.5 px-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5",
            activeTab === "private_notes"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
          title="Private Confidential Notes (Only you see this)"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Private</span>
        </button>
      </div>

      {/* TAB 1: ACTION ITEMS */}
      {activeTab === "action_items" && (
        <div className="flex-1 overflow-y-auto flex flex-col p-3.5 space-y-3.5">
          {/* Progress Banner */}
          {totalItems > 0 && (
            <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Completion Progress</span>
                <span className="font-semibold text-primary">{percentComplete}%</span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>{completedItems} completed</span>
                <span>{totalItems - completedItems} remaining</span>
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border/50 text-[11px]">
              {(["all", "pending", "completed"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={cn(
                    "px-2 py-0.5 rounded-md capitalize font-medium transition-colors",
                    filterMode === mode
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-muted-foreground">
              {filteredActionItems.length} {filteredActionItems.length === 1 ? "task" : "tasks"}
            </span>
          </div>

          {/* Quick Starter Templates */}
          {totalItems === 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Starter Suggestions</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { text: "Review business plan updates", assignee: "client" as const },
                  { text: "Send follow-up resources & templates", assignee: "consultant" as const },
                  { text: "Revise 30-day growth targets", assignee: "both" as const },
                ].map((tpl) => (
                  <button
                    key={tpl.text}
                    type="button"
                    onClick={() => handleQuickAddTemplate(tpl.text, tpl.assignee)}
                    className="text-left text-xs p-1.5 rounded-lg bg-background hover:bg-secondary/70 border border-border/60 transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate group-hover:text-primary transition-colors">{tpl.text}</span>
                    <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Items List */}
          <div className="flex-1 space-y-2">
            {filteredActionItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <CheckSquare className="w-8 h-8 mx-auto opacity-40 text-muted-foreground" />
                <p className="text-xs font-medium">No action items in this view</p>
                <p className="text-[11px] text-muted-foreground/80 max-w-[220px] mx-auto">
                  Add concrete next steps below so both client and consultant stay aligned after the call.
                </p>
              </div>
            ) : (
              filteredActionItems.map((item) => {
                const isClient = item.assignee === "client";
                const isConsultant = item.assignee === "consultant";

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group p-2.5 rounded-xl border transition-all text-xs space-y-1.5",
                      item.completed
                        ? "bg-secondary/30 border-border/50 opacity-70"
                        : "bg-secondary/60 hover:bg-secondary/80 border-border"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActionItem(item.id, item.completed)}
                        className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title={item.completed ? "Mark pending" : "Mark completed"}
                      >
                        {item.completed ? (
                          <div className="w-4 h-4 rounded bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "leading-snug break-words",
                            item.completed && "line-through text-muted-foreground"
                          )}
                        >
                          {item.text}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 h-4 border",
                              isClient && "border-primary/40 text-primary bg-primary/10",
                              isConsultant && "border-amber-500/40 text-amber-500 bg-amber-500/10",
                              !isClient && !isConsultant && "border-blue-500/40 text-blue-400 bg-blue-500/10"
                            )}
                          >
                            {isClient ? "Client" : isConsultant ? "Consultant" : "Both"}
                          </Badge>

                          {item.priority === "high" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-500/40 text-red-400 bg-red-500/10 flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5 text-red-400" />
                              <span>High</span>
                            </Badge>
                          )}

                          {item.dueDate && (
                            <span className="text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{item.dueDate}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteActionItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-secondary transition-all shrink-0"
                        title="Delete action item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* New Action Item Form */}
          <form onSubmit={handleAddActionItem} className="pt-2 border-t border-border/80 space-y-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Add an action item..."
                maxLength={500}
                className="flex-1 bg-secondary/70 border-border text-xs focus-visible:ring-1 focus-visible:ring-primary h-9 rounded-xl"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newTaskText.trim() || isAddingTask}
                className="h-9 px-3 rounded-xl glow-gold-sm shrink-0 font-medium text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </Button>
            </div>

            {/* Quick meta selectors */}
            <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
              <span className="text-muted-foreground text-[10px]">Assign to:</span>
              {(["both", "client", "consultant"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setNewTaskAssignee(a)}
                  className={cn(
                    "px-2 py-0.5 rounded-full capitalize text-[10px] font-medium border transition-colors",
                    newTaskAssignee === a
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/60 text-muted-foreground border-border/60 hover:text-foreground"
                  )}
                >
                  {a}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setNewTaskPriority(newTaskPriority === "high" ? "normal" : "high")}
                className={cn(
                  "ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors flex items-center gap-1",
                  newTaskPriority === "high"
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : "bg-secondary/60 text-muted-foreground border-border/60 hover:text-foreground"
                )}
              >
                <Flame className="w-2.5 h-2.5" />
                <span>{newTaskPriority === "high" ? "High Priority" : "Normal"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SHARED DISCUSSION NOTES */}
      {activeTab === "shared_notes" && (
        <div className="flex-1 overflow-y-auto flex flex-col p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1 text-[11px]">
              <Share2 className="w-3 h-3 text-primary" />
              <span>Visible to both participants in real-time</span>
            </span>
            <span className="text-[10px]">
              {notesData.lastUpdatedBy ? `Last edit: ${notesData.lastUpdatedBy.name}` : ""}
            </span>
          </div>

          {/* Quick Header Templates */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleInsertSection("Key Takeaways")}
              className="text-[10px] px-2 py-0.5 rounded-md bg-secondary border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              + Key Takeaways
            </button>
            <button
              type="button"
              onClick={() => handleInsertSection("Strategic Recommendations")}
              className="text-[10px] px-2 py-0.5 rounded-md bg-secondary border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              + Recommendations
            </button>
            <button
              type="button"
              onClick={() => handleInsertSection("Resources & Links")}
              className="text-[10px] px-2 py-0.5 rounded-md bg-secondary border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              + Resources
            </button>
          </div>

          <Textarea
            value={sharedNotesText}
            onChange={(e) => handleSharedNotesChange(e.target.value)}
            placeholder="Jot down shared consultation insights, strategic takeaways, advice, and references here... Everything updates in real time."
            rows={14}
            className="flex-1 min-h-[260px] bg-secondary/50 border-border text-xs leading-relaxed focus-visible:ring-1 focus-visible:ring-primary rounded-xl resize-none font-sans p-3"
          />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 pt-1">
            <span>
              {sharedNotesText.length} characters • {sharedNotesText.trim() ? sharedNotesText.trim().split(/\s+/).length : 0} words
            </span>
            <span className="text-[10px] text-primary/80">
              {isSyncing ? "Auto-saving..." : "Saved & Synchronized"}
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: PRIVATE NOTES (ISOLATED) */}
      {activeTab === "private_notes" && (
        <div className="flex-1 overflow-y-auto flex flex-col p-3.5 space-y-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-500">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-[11px]">Confidential Private Notes</p>
              <p className="text-[10px] text-muted-foreground leading-normal">
                These notes are saved strictly on your current device. They are NEVER transmitted to the server or visible to the other participant.
              </p>
            </div>
          </div>

          <Textarea
            value={privateNotes}
            onChange={(e) => handlePrivateNotesChange(e.target.value)}
            placeholder="Write your private impressions, private reminders, candid feedback, or personal questions here..."
            rows={14}
            className="flex-1 min-h-[260px] bg-secondary/50 border-border text-xs leading-relaxed focus-visible:ring-1 focus-visible:ring-primary rounded-xl resize-none font-sans p-3"
          />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 pt-1">
            <span>{privateNotes.length} characters</span>
            <span className="text-[10px] text-muted-foreground">Stored locally on your device</span>
          </div>
        </div>
      )}

      {/* Footer / Summary Action */}
      <div className="p-3 border-t border-border/80 bg-secondary/30 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopySummary}
          className="flex-1 h-8 text-xs rounded-lg gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy Summary</span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleDownloadSummary}
          className="flex-1 h-8 text-xs rounded-lg gap-1.5 glow-gold-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </Button>
      </div>
    </div>
  );
}

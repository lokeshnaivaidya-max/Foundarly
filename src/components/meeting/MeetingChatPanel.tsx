/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly In-Meeting Real-time Chatbox Panel
 * Provides in-call messaging, role badges, link parsing, chat export, and auto-scrolling.
 */

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/services/webrtcService";
import { X, Send, MessageSquare, Download, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MeetingChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  onSendMessage: (text: string) => Promise<void> | void;
  onClose: () => void;
  bookingTitle?: string;
  className?: string;
}

export default function MeetingChatPanel({
  messages,
  currentUserId,
  currentUserName,
  currentUserRole,
  onSendMessage,
  onClose,
  bookingTitle,
  className,
}: MeetingChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(text);
      setInputText("");
    } catch (err) {
      toast.error("Failed to send message. Please retry.");
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickSend = (text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  const exportChatHistory = () => {
    if (messages.length === 0) {
      toast.info("No messages to export yet.");
      return;
    }

    const title = bookingTitle || "Consultation";
    const dateStr = new Date().toLocaleDateString();
    let transcript = `Foundarly Meeting Chat Transcript\n`;
    transcript += `Session: ${title}\nDate: ${dateStr}\n`;
    transcript += `--------------------------------------------------\n\n`;

    messages.forEach((m) => {
      const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      transcript += `[${time}] ${m.senderName} (${m.senderRole || 'Participant'}):\n${m.text}\n\n`;
    });

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Foundarly-Chat-${dateStr.replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Chat transcript downloaded");
  };

  const renderMessageText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80 break-all font-medium"
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getRoleBadge = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('consultant')) {
      return <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/40 text-amber-500 bg-amber-500/10">Consultant</Badge>;
    }
    if (r.includes('admin')) {
      return <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">Admin</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary bg-primary/10">Client</Badge>;
  };

  return (
    <div className={cn(
      "w-80 sm:w-96 flex flex-col h-full bg-card/95 backdrop-blur-2xl border-l border-border/80 shadow-2xl relative z-30 transition-all",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/80 bg-secondary/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">Meeting Chat</h3>
            <p className="text-[11px] text-muted-foreground truncate">Real-time session messaging</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={exportChatHistory}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
              title="Download chat transcript"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
            title="Close chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Thread */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">No messages yet</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                Chat messages and shared links sent here are visible to all meeting participants.
              </p>
            </div>

            {/* Quick Starter Chips */}
            <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
              {["Hi there! 👋", "Can you hear me clearly?", "Ready to begin!"].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => handleQuickSend(quick)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-secondary/80 border border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col space-y-1 max-w-[88%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                  <span className="font-medium text-foreground truncate max-w-[120px]">
                    {isMe ? "You" : msg.senderName}
                  </span>
                  {getRoleBadge(msg.senderRole)}
                  <span className="text-[10px] text-muted-foreground/80">{formatTime(msg.timestamp)}</span>
                </div>

                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-xs"
                      : "bg-secondary border border-border/80 text-foreground rounded-tl-xs"
                  )}
                >
                  {renderMessageText(msg.text)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-border/80 bg-secondary/30 space-y-2">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            disabled={isSending}
            maxLength={1000}
            className="flex-1 bg-secondary/70 border-border text-xs focus-visible:ring-1 focus-visible:ring-primary h-9 rounded-xl"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputText.trim() || isSending}
            className="h-9 px-3 rounded-xl glow-gold-sm shrink-0 font-medium text-xs flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground/80 text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}

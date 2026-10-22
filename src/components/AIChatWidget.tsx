import { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  CreditCard,
  Video,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatbotService, ChatMessage } from '@/services/chatbotService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'foundarly_knowledge_chat_history';

const QUICK_CATEGORIES = [
  { label: 'Booking', query: 'How do I book a consultation?', icon: Calendar },
  { label: 'Pricing', query: 'What are the consultation fees?', icon: CreditCard },
  { label: 'Consultants', query: 'Which consultants are available?', icon: Sparkles },
  { label: 'Payments', query: 'How do payments & UPI work?', icon: CreditCard },
  { label: 'Meetings', query: 'Meeting access & 7-day rejoin', icon: Video },
  { label: 'Reschedule', query: 'How do I reschedule a booking?', icon: Clock },
];

/**
 * Parses markdown-like bold (**text**) and internal links ([text](/path)) into React nodes.
 */
function FormattedMessage({ text, onNavigate }: { text: string; onNavigate: (path: string) => void }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-1.5" />;
        }

        // Split by bold (**text**) and markdown links ([text](/path))
        const parts = line.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g);

        return (
          <p key={lIdx} className="break-words [overflow-wrap:anywhere]">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                  </strong>
                );
              }

              const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
              if (linkMatch) {
                const label = linkMatch[1];
                const href = linkMatch[2];
                return (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => onNavigate(href)}
                    className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold mx-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary rounded-xs"
                  >
                    {label}
                    <ArrowUpRight className="w-3 h-3 inline" />
                  </button>
                );
              }

              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function AIChatWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);

  // Sync session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Focus management on open/close
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard accessibility (Escape to close)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        launcherButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      launcherButtonRef.current?.focus();
    }, 50);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatbotService.sendMessage(query, messages);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        followUps: response.followUps,
        links: response.links,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!isOpen) setUnreadCount((prev) => prev + 1);
    } catch (err: any) {
      console.warn('Chat error:', err);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'I encountered an issue processing your request. Please ask your question again or explore our help topics below.',
        timestamp: new Date(),
        followUps: chatbotService.getQuickQuestions(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleNavigate = (path: string) => {
    if (path.startsWith('http') || path.startsWith('mailto:')) {
      window.location.href = path;
    } else {
      navigate(path);
      // Close on mobile screens for smooth navigation
      if (window.innerWidth < 640) {
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop for focused mobile interaction */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[9998] sm:hidden transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Floating Chat Modal: Fixed at bottom-right viewport with exact dimension constraints */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foundarly Support Assistant"
          className="fixed z-[9999] flex flex-col bg-card border border-border/90 shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 ease-out"
          style={{
            position: 'fixed',
            right: '16px',
            bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
            width: 'min(420px, calc(100vw - 32px))',
            maxWidth: 'min(420px, calc(100vw - 32px))',
            height: 'min(680px, calc(100dvh - 32px))',
            maxHeight: 'min(680px, calc(100dvh - 32px))',
          }}
        >
          {/* Header: fixed height, high contrast, clearly visible Close button */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 via-primary to-amber-600 text-primary-foreground shrink-0 shadow-sm border-b border-white/10">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <Bot className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-white text-sm leading-tight truncate">Foundarly Assistant</p>
                  <Badge variant="outline" className="bg-white/15 text-[10px] text-white border-white/25 py-0 px-1.5 font-medium shrink-0">
                    Knowledge Base
                  </Badge>
                </div>
                <p className="text-white/85 text-[11px] truncate">Instant answers for booking, fees & meetings</p>
              </div>
            </div>

            {/* Top-Right Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all text-white focus:outline-none focus:ring-2 focus:ring-white/80 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Clearly visible Close 'X' button on both desktop and mobile */}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close chat"
                title="Close chat"
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 active:scale-95 flex items-center justify-center transition-all text-white focus:outline-none focus:ring-2 focus:ring-white/90 cursor-pointer shrink-0 shadow-xs"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages Body: the ONLY vertically scrollable section */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 sm:px-4 py-3 sm:py-4 space-y-3.5 bg-background/50 focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Chat conversation"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-3 pb-2 space-y-3">
                <div className="w-13 h-13 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary glow-gold-sm">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-sm sm:text-base">Welcome to Foundarly!</h4>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-normal">
                    Ask any question about our verified consultants, consultation fees, live availability, payment steps, or video rooms.
                  </p>
                </div>

                {/* Quick Topic Buttons */}
                <div className="w-full pt-1 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-wider font-semibold px-1">
                    <span>Popular Inquiries</span>
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {QUICK_CATEGORIES.map((cat, i) => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(cat.query)}
                          className="w-full text-left text-xs bg-secondary/60 hover:bg-secondary hover:border-primary/40 border border-border/80 text-foreground px-3 py-2 rounded-xl transition-all duration-200 flex items-center justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                            <span className="font-medium">{cat.query}</span>
                          </div>
                          <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}>
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mr-2 mt-1 shrink-0">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm break-words [overflow-wrap:anywhere] ${
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-br-xs font-medium'
                              : 'bg-card border border-border/80 text-foreground rounded-bl-xs'
                          }`}
                        >
                          <FormattedMessage text={msg.content} onNavigate={handleNavigate} />
                          <span
                            className={`block text-[10px] mt-1 text-right ${
                              isUser ? 'text-primary-foreground/75' : 'text-muted-foreground'
                            }`}
                          >
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Assistant Action Links */}
                      {!isUser && msg.links && msg.links.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-9 pt-0.5">
                          {msg.links.map((link, lIdx) => (
                            <Button
                              key={lIdx}
                              variant="outline"
                              size="sm"
                              onClick={() => handleNavigate(link.url)}
                              className="h-7 text-[11px] border-primary/30 text-foreground hover:bg-primary/10 hover:text-primary gap-1 px-2.5 rounded-lg"
                            >
                              <span>{link.label}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Follow-up Prompts */}
                      {!isUser && msg.followUps && msg.followUps.length > 0 && idx === messages.length - 1 && (
                        <div className="flex flex-wrap gap-1 pl-9 pt-1">
                          {msg.followUps.map((prompt, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => handleSendMessage(prompt)}
                              className="text-[11px] bg-secondary/60 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mr-2 mt-1 shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-bl-xs px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Composer: pinned to the bottom of the panel, fully visible */}
          <div className="p-3 border-t border-border bg-card shrink-0 space-y-2">
            <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about booking, fees, time slots, meetings..."
                disabled={isLoading}
                aria-label="Ask a question"
                className="flex-1 bg-transparent text-xs md:text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0 cursor-pointer text-primary-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Foundarly Verified Knowledge
              </span>
              <span>IST Support: Mon-Sat</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Launcher: Discovered easily at bottom-right corner */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 md:bottom-6 md:right-6 z-50 flex items-center gap-2.5">
          <div className="hidden sm:block bg-card/95 backdrop-blur-sm border border-border px-3.5 py-1.5 rounded-full shadow-lg text-xs font-medium text-foreground">
            Questions? Chat with us 👋
          </div>
          <button
            ref={launcherButtonRef}
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open support chat"
            aria-expanded={isOpen}
            className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl glow-gold transition-all duration-300 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse shadow-md">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}

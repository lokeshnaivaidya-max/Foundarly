import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Hash, Users, Filter, X } from "lucide-react";
import { Channel, ChannelMessage, StartupShowcase as ShowcaseType, COLLABORATION_TAGS, UserGroup } from "@/services/networking";
import MessageThread from "./MessageThread";
import StartupShowcase from "./StartupShowcase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CenterPanelProps {
  channel: Channel | null;
  group: UserGroup | null;
  messages: ChannelMessage[];
  showcases: ShowcaseType[];
  isMember: boolean;
  onJoinChannel: () => void;
  onSendMessage: (content: string, tags?: string[]) => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onCreateShowcase: (showcase: Partial<ShowcaseType>) => Promise<void>;
  onReplyToMessage: (messageId: string) => void;
}

export default function CenterPanel({
  channel,
  group,
  messages,
  showcases,
  isMember,
  onJoinChannel,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onCreateShowcase,
  onReplyToMessage,
}: CenterPanelProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const currentItem = channel || group;
  const isChannel = !!channel;

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    if (!user) {
      toast.error("Please login to send messages");
      return;
    }

    setSending(true);
    try {
      await onSendMessage(newMessage.trim(), selectedTags);
      setNewMessage("");
      setSelectedTags([]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Group messages by thread
  const threadedMessages = messages.reduce((acc, msg) => {
    if (!msg.reply_to) {
      acc[msg.id] = { message: msg, replies: [] };
    }
    return acc;
  }, {} as Record<string, { message: ChannelMessage; replies: ChannelMessage[] }>);

  messages.forEach(msg => {
    if (msg.reply_to && threadedMessages[msg.reply_to]) {
      threadedMessages[msg.reply_to].replies.push(msg);
    }
  });

  const filteredMessages = filterTag
    ? Object.values(threadedMessages).filter(thread =>
        thread.message.tags?.includes(filterTag)
      )
    : Object.values(threadedMessages);

  if (!currentItem) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <Hash className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-semibold mb-2">Welcome to Network</p>
          <p className="text-sm">Select a channel or group from the sidebar to start collaborating</p>
        </div>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        {/* Channel/Group Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{channel?.icon || (group?.is_private ? '🔒' : '👥')}</span>
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  {currentItem.name}
                </h2>
                <p className="text-sm text-muted-foreground">{currentItem.description}</p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {currentItem.member_count} members
            </Badge>
          </div>
        </div>

        {/* Join Prompt */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Hash className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Join to Participate</h3>
            <p className="text-muted-foreground mb-6">
              Join {currentItem.name} to view messages, share insights, and collaborate with the community
            </p>
            <Button onClick={onJoinChannel} size="lg">
              Join {isChannel ? 'Channel' : 'Group'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Channel/Group Header */}
      <div className="border-b border-border p-4 lg:mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{channel?.icon || (group?.is_private ? '🔒' : '👥')}</span>
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Hash className="h-5 w-5" />
                {currentItem.name}
              </h2>
              <p className="text-sm text-muted-foreground">{currentItem.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {filterTag && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                {COLLABORATION_TAGS.find(t => t.value === filterTag)?.label}
                <button onClick={() => setFilterTag(null)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {currentItem.member_count}
            </Badge>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Startup Showcases - Only for channels */}
          {isChannel && (
            <StartupShowcase
              showcases={showcases}
              channelId={channel!.id}
              onCreateShowcase={onCreateShowcase}
              canCreate={!!user}
            />
          )}

          {/* Messages */}
          <div className="space-y-3">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              filteredMessages.map(({ message, replies }) => (
                <MessageThread
                  key={message.id}
                  message={message}
                  replies={replies}
                  onReply={onReplyToMessage}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="max-w-4xl mx-auto">
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTags.map(tag => {
                const tagInfo = COLLABORATION_TAGS.find(t => t.value === tag);
                return (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tagInfo?.icon} {tagInfo?.label}
                    <button onClick={() => toggleTag(tag)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          
          <form onSubmit={handleSend} className="flex gap-2">
            <Select onValueChange={toggleTag}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Add tag..." />
              </SelectTrigger>
              <SelectContent>
                {COLLABORATION_TAGS.map(tag => (
                  <SelectItem key={tag.value} value={tag.value}>
                    <span className="flex items-center gap-2">
                      {tag.icon} {tag.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${isChannel ? '#' : ''}${currentItem.name}`}
              className="flex-1"
              disabled={sending}
            />
            
            <Button type="submit" disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground mt-2">
            {newMessage.length}/2000 characters
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Users, Hash } from "lucide-react";
import { networkingService, Channel, ChannelMessage } from "@/services/networking";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function ChannelViewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (id) {
      loadChannel();
      checkMembership();
    }
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChannel = async () => {
    try {
      const channelData = await networkingService.getChannelById(id!);
      setChannel(channelData);
      
      // Load messages if user is a member
      const memberStatus = await networkingService.isChannelMember(id!);
      setIsMember(memberStatus);
      
      if (memberStatus) {
        const messagesData = await networkingService.getChannelMessages(id!);
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error loading channel:', error);
      toast.error("Failed to load channel");
    } finally {
      setLoading(false);
    }
  };

  const checkMembership = async () => {
    if (!user) return;
    try {
      const memberStatus = await networkingService.isChannelMember(id!);
      setIsMember(memberStatus);
    } catch (error) {
      console.error('Error checking membership:', error);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      toast.error("Please login to join channels");
      navigate('/login');
      return;
    }

    try {
      await networkingService.joinChannel(id!);
      toast.success("Joined channel successfully");
      setIsMember(true);
      loadChannel();
    } catch (error) {
      console.error('Error joining channel:', error);
      toast.error("Failed to join channel");
    }
  };

  const handleLeave = async () => {
    try {
      await networkingService.leaveChannel(id!);
      toast.success("Left channel successfully");
      navigate('/network');
    } catch (error) {
      console.error('Error leaving channel:', error);
      toast.error("Failed to leave channel");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    if (!user) {
      toast.error("Please login to send messages");
      return;
    }

    setSending(true);
    try {
      await networkingService.sendMessage(id!, newMessage.trim());
      setNewMessage("");
      
      // Reload messages
      const messagesData = await networkingService.getChannelMessages(id!);
      setMessages(messagesData);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-24">
          <div className="container mx-auto px-6">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-24">
          <div className="container mx-auto px-6">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Channel Not Found</h2>
              <Button onClick={() => navigate('/network')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Network
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-28 pb-6">
        <div className="container mx-auto px-6 h-full max-w-6xl">
          {/* Channel Header */}
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            {/* Back Button Row */}
            <div className="mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/network')}
                className="hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            
            {/* Channel Info Row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-3xl flex-shrink-0">{channel.icon}</span>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-xl font-bold flex items-center gap-2 mb-1">
                    <Hash className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </h1>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {channel.description}
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {channel.member_count}
                </Badge>
                {isMember ? (
                  <Button variant="outline" size="sm" onClick={handleLeave}>
                    Leave
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleJoin}>
                    Join
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          {!isMember ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Hash className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Join to Participate</h2>
              <p className="text-muted-foreground mb-6">
                Join this channel to view messages and participate in discussions
              </p>
              <Button onClick={handleJoin}>
                Join {channel.name}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col h-[calc(100vh-280px)]">
              {/* Messages List */}
              <div className="flex-1 bg-card border border-border rounded-t-lg overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No messages yet. Be the first to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {message.profiles?.full_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {message.profiles?.full_name || 'Anonymous'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm break-words">{message.content}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="bg-card border border-t-0 border-border rounded-b-lg p-4">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message #${channel.name}`}
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

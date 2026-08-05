import { useState, useEffect } from "react";
import { Menu, X, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { networkingService, Channel, ChannelMessage, StartupShowcase, UserGroup } from "@/services/networking";
import LeftSidebar from "@/components/networking/LeftSidebar";
import CenterPanel from "@/components/networking/CenterPanel";
import RightSidebar from "@/components/networking/RightSidebar";
import CreateGroupModal from "@/components/networking/CreateGroupModal";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

export default function NetworkHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [myGroups, setMyGroups] = useState<UserGroup[]>([]);
  const [allGroups, setAllGroups] = useState<UserGroup[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [groupPosts, setGroupPosts] = useState<any[]>([]);
  const [showcases, setShowcases] = useState<StartupShowcase[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Load channels and groups
  useEffect(() => {
    loadChannels();
    loadAllGroups();
    if (user) {
      loadMyGroups();
    }
  }, [user]);

  // Load channel data when selected
  useEffect(() => {
    if (selectedChannel) {
      loadChannelData();
    }
  }, [selectedChannel?.id]);

  // Load group data when selected
  useEffect(() => {
    if (selectedGroup) {
      loadGroupData();
    }
  }, [selectedGroup?.id]);

  const loadChannels = async () => {
    try {
      const data = await networkingService.getAllChannels();
      setChannels(data);
      
      // Auto-select first channel if none selected
      if (!selectedChannel && data.length > 0) {
        setSelectedChannel(data[0]);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyGroups = async () => {
    try {
      const data = await networkingService.getMyGroups();
      setMyGroups(data);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadAllGroups = async () => {
    try {
      const data = await networkingService.getAllGroups();
      // Filter out groups user is already a member of
      const myGroupIds = myGroups.map(g => g.id);
      const discoverGroups = data.filter(g => !myGroupIds.includes(g.id));
      setAllGroups(discoverGroups);
    } catch (error) {
      console.error('Error loading all groups:', error);
    }
  };

  const loadChannelData = async () => {
    if (!selectedChannel) return;

    try {
      // Check membership
      const memberStatus = await networkingService.isChannelMember(selectedChannel.id);
      setIsMember(memberStatus);

      if (memberStatus) {
        // Load messages and showcases safely
        const [messagesData, showcasesData] = await Promise.all([
          networkingService.getChannelMessages(selectedChannel.id).catch(() => []),
          networkingService.getChannelShowcases(selectedChannel.id).catch(() => []),
        ]);
        setMessages(messagesData || []);
        setShowcases(showcasesData || []);
      } else {
        setMessages([]);
        setShowcases([]);
      }
    } catch (error) {
      console.error('Error loading channel data:', error);
      setMessages([]);
      setShowcases([]);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedGroup(null); // Clear group selection
    setFilterTag(null);
    setShowLeftSidebar(false);
  };

  const handleSelectGroup = (group: UserGroup) => {
    setSelectedGroup(group);
    setSelectedChannel(null); // Clear channel selection
    setFilterTag(null);
    setShowLeftSidebar(false);
  };

  const loadGroupData = async () => {
    if (!selectedGroup) return;

    try {
      // Check membership
      const memberStatus = await networkingService.isGroupMember(selectedGroup.id);
      setIsMember(memberStatus);

      if (memberStatus) {
        // Load group posts
        const postsData = await networkingService.getGroupPosts(selectedGroup.id);
        setGroupPosts(postsData);
      } else {
        setGroupPosts([]);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
      toast.error("Failed to load group data");
    }
  };

  const handleJoinChannel = async () => {
    if (!selectedChannel || !user) return;

    try {
      await networkingService.joinChannel(selectedChannel.id);
      toast.success(`Joined #${selectedChannel.name}`);
      await loadChannelData();
    } catch (error) {
      console.error('Error joining channel:', error);
      toast.error("Failed to join channel");
    }
  };

  const handleJoinGroup = async () => {
    if (!selectedGroup || !user) return;

    try {
      await networkingService.joinGroup(selectedGroup.id);
      toast.success(`Joined ${selectedGroup.name}`);
      await loadGroupData();
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error("Failed to join group");
    }
  };

  const handleSendMessage = async (content: string, tags?: string[]) => {
    if (!user) return;

    try {
      if (selectedChannel) {
        const newMessage = await networkingService.sendMessage(selectedChannel.id, content);
        
        // Add tags if provided
        if (tags && tags.length > 0) {
          await networkingService.addMessageTags(newMessage.id, tags);
        }
        
        // Reload messages
        await loadChannelData();
      } else if (selectedGroup) {
        await networkingService.sendGroupPost(selectedGroup.id, content);
        await loadGroupData();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      if (selectedChannel) {
        await networkingService.updateMessage(messageId, content);
        await loadChannelData();
      } else if (selectedGroup) {
        await networkingService.updateGroupPost(messageId, content);
        await loadGroupData();
      }
      toast.success("Message updated");
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error("Failed to edit message");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      if (selectedChannel) {
        await networkingService.deleteMessage(messageId);
        await loadChannelData();
      } else if (selectedGroup) {
        await networkingService.deleteGroupPost(messageId);
        await loadGroupData();
      }
      toast.success("Message deleted");
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error("Failed to delete message");
    }
  };

  const handleCreateShowcase = async (showcase: Partial<StartupShowcase>) => {
    try {
      await networkingService.createShowcase(showcase);
      await loadChannelData();
    } catch (error) {
      console.error('Error creating showcase:', error);
      throw error;
    }
  };

  const handleReplyToMessage = (messageId: string) => {
    // This would be implemented with a reply state
    console.log('Reply to:', messageId);
  };

  const handleCreateGroup = async (group: Partial<UserGroup>) => {
    try {
      await networkingService.createGroup(group);
      toast.success("Group created successfully!");
      await loadMyGroups();
      await loadAllGroups();
      setCreateGroupOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  };

  const handleFilterByTag = (tag: string) => {
    setFilterTag(tag);
  };

  // Get active tags from messages
  const activeTags = Array.from(
    new Set(
      messages
        .filter((m: any) => m.tags && m.tags.length > 0)
        .flatMap((m: any) => m.tags)
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading network...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Network - Connect & Collaborate"
        description="Join professional channels, showcase your startup, and collaborate with founders, investors, and industry experts"
      />
      
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden relative">
        {/* Mobile Header with Menu Buttons */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
              className="flex items-center gap-2"
            >
              <Menu className="h-5 w-5" />
              <span className="text-sm font-medium">
                {selectedChannel ? `#${selectedChannel.name}` : 'Channels'}
              </span>
            </Button>
          </div>
          
          {selectedChannel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRightSidebar(!showRightSidebar)}
            >
              <Info className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Desktop Back Button - Above Center Panel */}
        <div className="hidden lg:block absolute top-4 left-72 right-0 z-10 px-4">
          <div className="flex items-center gap-4 max-w-4xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </Button>
            <span className="text-muted-foreground">|</span>
            <h1 className="font-display text-lg font-bold">Network</h1>
          </div>
        </div>

        {/* Left Sidebar - Overlay on mobile, fixed on desktop */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-0
          transform transition-transform duration-300 ease-in-out
          ${showLeftSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:block
        `}>
          <div className="relative h-full">
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLeftSidebar(false)}
              className="absolute top-4 right-4 z-10 lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
            
            <LeftSidebar
              channels={channels}
              myGroups={myGroups}
              allGroups={allGroups}
              selectedChannel={selectedChannel}
              selectedGroup={selectedGroup}
              onSelectChannel={handleSelectChannel}
              onSelectGroup={handleSelectGroup}
              onCreateGroup={() => setCreateGroupOpen(true)}
            />
          </div>
        </div>

        {/* Overlay for mobile sidebars */}
        {(showLeftSidebar || showRightSidebar) && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => {
              setShowLeftSidebar(false);
              setShowRightSidebar(false);
            }}
          />
        )}
        
        {/* Center Panel - Full width on mobile, flex on desktop */}
        <div className="flex-1 min-w-0 flex flex-col">
          <CenterPanel
            channel={selectedChannel}
            group={selectedGroup}
            messages={selectedChannel ? messages : groupPosts}
            showcases={showcases}
            isMember={isMember}
            onJoinChannel={selectedChannel ? handleJoinChannel : handleJoinGroup}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onCreateShowcase={handleCreateShowcase}
            onReplyToMessage={handleReplyToMessage}
          />
        </div>
        
        {/* Right Sidebar - Overlay on mobile/tablet, fixed on large desktop */}
        <div className={`
          fixed lg:relative inset-y-0 right-0 z-50 lg:z-0
          transform transition-transform duration-300 ease-in-out
          ${showRightSidebar ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
          hidden xl:block
          ${showRightSidebar ? '!block' : ''}
        `}>
          <div className="relative h-full">
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRightSidebar(false)}
              className="absolute top-4 left-4 z-10 xl:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
            
            <RightSidebar
              channel={selectedChannel}
              group={selectedGroup}
              memberCount={selectedChannel?.member_count || selectedGroup?.member_count || 0}
              showcaseCount={showcases.length}
              activeTags={activeTags}
              onFilterByTag={handleFilterByTag}
            />
          </div>
        </div>
      </div>

      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onCreateGroup={handleCreateGroup}
      />
    </>
  );
}

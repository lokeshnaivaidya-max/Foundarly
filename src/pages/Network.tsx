import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Users, MessageSquare, Plus, Search, Hash, Lock, Globe } from "lucide-react";
import { networkingService, Channel, UserGroup } from "@/services/networking";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function NetworkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [myGroups, setMyGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    is_private: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [channelsData, groupsData, myGroupsData] = await Promise.all([
        networkingService.getAllChannels(),
        networkingService.getAllGroups(),
        user ? networkingService.getMyGroups() : Promise.resolve([])
      ]);
      
      setChannels(channelsData);
      setGroups(groupsData);
      setMyGroups(myGroupsData);
    } catch (error: any) {
      console.error('Error loading networking data:', error);
      
      // Check if it's a table not found error
      if (error?.message?.includes('relation') || error?.code === '42P01') {
        toast.error("Networking tables not set up. Please run networking-setup.sql in Supabase.");
      } else {
        toast.error("Failed to load networking data. Please check console for details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    if (!user) {
      toast.error("Please login to join channels");
      navigate('/login');
      return;
    }

    try {
      await networkingService.joinChannel(channelId);
      toast.success("Joined channel successfully");
      navigate(`/network/channel/${channelId}`);
    } catch (error) {
      console.error('Error joining channel:', error);
      toast.error("Failed to join channel");
    }
  };

  const handleCreateGroup = async () => {
    if (!user) {
      toast.error("Please login to create groups");
      navigate('/login');
      return;
    }

    if (!newGroup.name.trim()) {
      toast.error("Group name is required");
      return;
    }

    try {
      const group = await networkingService.createGroup(newGroup);
      toast.success("Group created successfully");
      setCreateGroupOpen(false);
      setNewGroup({ name: "", description: "", is_private: false });
      loadData();
      navigate(`/network/group/${group.id}`);
    } catch (error: any) {
      console.error('Error creating group:', error);
      
      // Check if it's a table not found error
      if (error?.message?.includes('relation') || error?.code === '42P01') {
        toast.error("Networking tables not set up. Please run networking-setup.sql in Supabase.");
      } else {
        toast.error(error?.message || "Failed to create group. Please check console for details.");
      }
    }
  };

  const groupedChannels = channels.reduce((acc, channel) => {
    if (!acc[channel.category]) {
      acc[channel.category] = [];
    }
    acc[channel.category].push(channel);
    return acc;
  }, {} as Record<string, Channel[]>);

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-7xl">
          <AnimatedSection className="text-center mb-12">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Community</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Network & <span className="text-gradient-gold">Collaborate</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Join market-specific channels, create groups, exchange ideas, and showcase your business
            </p>
          </AnimatedSection>

          <Tabs defaultValue="channels" className="space-y-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="channels">
                <Hash className="h-4 w-4 mr-2" />
                Channels
              </TabsTrigger>
              <TabsTrigger value="groups">
                <Users className="h-4 w-4 mr-2" />
                Groups
              </TabsTrigger>
            </TabsList>

            <TabsContent value="channels" className="space-y-8">
              <AnimatedSection delay={0.1}>
                <div className="bg-card border border-border rounded-lg p-6 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold mb-2">Market Channels</h3>
                      <p className="text-sm text-muted-foreground">
                        Join industry-specific channels to network with professionals, share insights, and collaborate on projects. 
                        Each channel is dedicated to a specific market or topic.
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {Object.entries(groupedChannels).map(([category, categoryChannels], idx) => (
                <AnimatedSection key={category} delay={0.1 + idx * 0.05}>
                  <div className="mb-6">
                    <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                      <span className="text-2xl">{categoryChannels[0]?.icon}</span>
                      {category}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {categoryChannels.map((channel) => (
                        <Card key={channel.id} className="hover:border-primary/30 transition-all cursor-pointer group flex flex-col">
                          <CardHeader className="flex-shrink-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-2xl flex-shrink-0">{channel.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                                    {channel.name}
                                  </CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    {channel.member_count} members
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {channel.is_public ? (
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 flex flex-col">
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
                              {channel.description}
                            </p>
                            <Button 
                              size="sm" 
                              className="w-full"
                              onClick={() => handleJoinChannel(channel.id)}
                            >
                              Join Channel
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </TabsContent>

            <TabsContent value="groups" className="space-y-6">
              <AnimatedSection delay={0.1}>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search groups..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setCreateGroupOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </div>
              </AnimatedSection>

              {myGroups.length > 0 && (
                <AnimatedSection delay={0.15}>
                  <div className="mb-8">
                    <h2 className="font-display text-xl font-semibold mb-4">My Groups</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {myGroups.map((group) => (
                        <Card key={group.id} className="hover:border-primary/30 transition-all cursor-pointer group flex flex-col">
                          <CardHeader>
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Users className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                                  {group.name}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {group.member_count} members
                                </CardDescription>
                              </div>
                              {group.is_private && (
                                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {group.description || "No description"}
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="w-full"
                              onClick={() => navigate(`/network/group/${group.id}`)}
                            >
                              View Group
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </AnimatedSection>
              )}

              <AnimatedSection delay={0.2}>
                <h2 className="font-display text-xl font-semibold mb-4">Discover Groups</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredGroups.map((group) => (
                    <Card key={group.id} className="hover:border-primary/30 transition-all cursor-pointer group flex flex-col">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <Users className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                              {group.name}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {group.member_count} members
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {group.description || "No description"}
                        </p>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={async () => {
                            if (!user) {
                              toast.error("Please login to join groups");
                              navigate('/login');
                              return;
                            }
                            try {
                              await networkingService.joinGroup(group.id);
                              toast.success("Joined group successfully");
                              loadData();
                            } catch (error) {
                              toast.error("Failed to join group");
                            }
                          }}
                        >
                          Join Group
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AnimatedSection>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Create Group Dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Create New Group</DialogTitle>
            <DialogDescription>
              Create a group to collaborate with others on specific topics or projects
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="e.g., AI Startup Founders"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                placeholder="What is this group about?"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newGroup.is_private}
                onCheckedChange={(checked) => setNewGroup({ ...newGroup, is_private: checked })}
              />
              <Label>Private Group (invite only)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

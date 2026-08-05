import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Calendar, Tag, TrendingUp } from "lucide-react";
import { Channel, UserGroup } from "@/services/networking";
import { COLLABORATION_TAGS } from "@/services/networking";

interface RightSidebarProps {
  channel: Channel | null;
  group: UserGroup | null;
  memberCount: number;
  showcaseCount: number;
  activeTags: string[];
  onFilterByTag: (tag: string) => void;
}

export default function RightSidebar({
  channel,
  group,
  memberCount,
  showcaseCount,
  activeTags,
  onFilterByTag,
}: RightSidebarProps) {
  const currentItem = channel || group;
  
  if (!currentItem) {
    return (
      <div className="w-80 bg-card border-l border-border flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a channel to view details</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* About Section */}
          <div>
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl">{channel?.icon || (group?.is_private ? '🔒' : '👥')}</span>
              About
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentItem.description || "No description available"}
                </p>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Created {formatDate(currentItem.created_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {currentItem.category || (channel ? channel.category : 'General')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {channel ? (channel.is_public ? "Public" : "Private") : (group?.is_private ? "Private" : "Public")}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Members Section */}
          {memberCount > 0 && (
            <div>
              <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Community Members
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Members</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold">{memberCount}</Badge>
                </div>
                {Math.floor(memberCount * 0.15) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Members</span>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/30">
                      {Math.floor(memberCount * 0.15)}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collaboration Highlights - Only show if showcaseCount > 0 or activeTags.length > 0 */}
          {channel && (showcaseCount > 0 || activeTags.length > 0) && (
            <>
              <Separator />
              <div>
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Collaboration
                </h3>
                <div className="space-y-3">
                  {showcaseCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active Showcases</span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
                        {showcaseCount}
                      </Badge>
                    </div>
                  )}

                  {activeTags.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Active Topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeTags.slice(0, 5).map((tag) => {
                          const tagInfo = COLLABORATION_TAGS.find(t => t.value === tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => onFilterByTag(tag)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                            >
                              <span>{tagInfo?.icon}</span>
                              <span className="text-xs">{tagInfo?.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Quick Filters - Only for channels */}
          {channel && (
            <>
              <Separator />
              <div>
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Quick Filters
                </h3>
                <div className="space-y-1.5">
                  {COLLABORATION_TAGS.map((tag) => (
                    <button
                      key={tag.value}
                      onClick={() => onFilterByTag(tag.value)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors text-left group"
                    >
                      <span className="text-base">{tag.icon}</span>
                      <span className="text-xs flex-1 group-hover:text-primary transition-colors">
                        {tag.label}
                      </span>
                      {activeTags.includes(tag.value) && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
                          Active
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Guidelines */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <h4 className="text-xs font-semibold mb-2">{channel ? 'Channel' : 'Group'} Guidelines</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Be respectful and professional</li>
              <li>• Stay on topic</li>
              <li>• No spam or self-promotion</li>
              <li>• Help others succeed</li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

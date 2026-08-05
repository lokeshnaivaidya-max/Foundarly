import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Hash, Lock, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Channel, UserGroup } from "@/services/networking";
import { toast } from "sonner";

interface LeftSidebarProps {
  channels: Channel[];
  myGroups: UserGroup[];
  selectedChannel: Channel | null;
  selectedGroup: UserGroup | null;
  onSelectChannel: (channel: Channel) => void;
  onSelectGroup: (group: UserGroup) => void;
  onCreateGroup: () => void;
  allGroups?: UserGroup[];
}

const CATEGORIES = [
  { name: 'Lodging / Hotel', icon: '🏨', color: 'text-rose-400' },
  { name: 'Artificial Intelligence', icon: '🤖', color: 'text-violet-400' },
  { name: 'Education', icon: '🎓', color: 'text-sky-400' },
  { name: 'Healthcare', icon: '🏥', color: 'text-red-400' },
  { name: 'Finance & Insurance', icon: '💰', color: 'text-yellow-400' },
  { name: 'Transport & Logistics', icon: '🚚', color: 'text-orange-400' },
  { name: 'Information Technology', icon: '💻', color: 'text-blue-400' },
  { name: 'Agriculture & Forestry', icon: '🌱', color: 'text-green-400' },
  { name: 'Construction', icon: '🏗️', color: 'text-stone-400' },
  { name: 'Real Estate', icon: '🏢', color: 'text-teal-400' },
  { name: 'Jewellery (Artificial)', icon: '💍', color: 'text-pink-300' },
  { name: 'Jewellery (Original)', icon: '💎', color: 'text-pink-500' },
  { name: 'Media & Entertainment', icon: '🎬', color: 'text-fuchsia-400' },
  { name: 'Plastic', icon: '🧪', color: 'text-slate-400' },
  { name: 'Packaging', icon: '📦', color: 'text-amber-400' },
  { name: 'Steel, Aluminium & Copper', icon: '🔩', color: 'text-gray-400' },
  { name: 'Electrical', icon: '⚡', color: 'text-yellow-500' },
  { name: 'Electronics', icon: '🔌', color: 'text-cyan-400' },
  { name: 'Skincare & Body Care', icon: '🧴', color: 'text-rose-300' },
  { name: 'Travelling', icon: '✈️', color: 'text-sky-500' },
  { name: 'Import & Export', icon: '🌍', color: 'text-emerald-500' },
  { name: 'Manufacturing', icon: '🏭', color: 'text-zinc-400' },
  { name: 'Wholesale & Retail', icon: '🛒', color: 'text-lime-400' },
  { name: 'Food Processing', icon: '🥫', color: 'text-amber-500' },
  { name: 'Spices & Dry Fruits', icon: '🌶️', color: 'text-orange-500' },
  { name: 'Fashion', icon: '👗', color: 'text-pink-400' },
  { name: 'Wood & Hardware', icon: '🪵', color: 'text-amber-600' },
  { name: 'Automobile', icon: '🚗', color: 'text-blue-500' },
  { name: 'Engineering Equipment', icon: '⚙️', color: 'text-slate-500' },
];

export default function LeftSidebar({
  channels,
  myGroups,
  selectedChannel,
  selectedGroup,
  onSelectChannel,
  onSelectGroup,
  onCreateGroup,
  allGroups = [],
}: LeftSidebarProps) {
  const [search, setSearch] = useState("");

  const filteredChannels = channels.filter(c => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return c.name.toLowerCase().includes(query) || 
           c.category?.toLowerCase().includes(query) ||
           c.description?.toLowerCase().includes(query);
  });

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search 29 channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {/* Official 29 Industry Channels */}
          <div>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Official Channels</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {filteredChannels.length}
              </Badge>
            </div>
            
            <div className="mt-1 space-y-0.5">
              {filteredChannels.map((channel) => {
                const isSelected = selectedChannel?.id === channel.id || selectedChannel?.name === channel.name;
                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left group ${
                      isSelected
                        ? "bg-primary/15 text-primary font-semibold shadow-xs"
                        : "hover:bg-secondary/50 text-foreground"
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{channel.icon || '💬'}</span>
                    <span className="text-sm flex-1 truncate font-medium">
                      {channel.name}
                    </span>
                    {channel.member_count > 0 && (
                      <Badge
                        variant="secondary"
                        className={`h-5 px-1.5 text-[11px] font-normal flex-shrink-0 ${isSelected ? "bg-primary/20 text-primary" : ""}`}
                      >
                        {channel.member_count}
                      </Badge>
                    )}
                  </button>
                );
              })}

              {filteredChannels.length === 0 && (
                <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                  No channels match "{search}"
                </div>
              )}
            </div>
          </div>

          {/* My Groups */}
          {myGroups.length > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>My Groups</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {myGroups.length}
                </Badge>
              </div>
              <div className="mt-1 space-y-0.5">
                {myGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroup?.id === group.id}
                    onClick={() => onSelectGroup(group)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Discover Groups */}
          {allGroups.length > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>Discover Groups</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {allGroups.length}
                </Badge>
              </div>
              <div className="mt-1 space-y-0.5">
                {allGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroup?.id === group.id}
                    onClick={() => onSelectGroup(group)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Group Button */}
      <div className="p-3 border-t border-border space-y-2">
        <Button
          onClick={onCreateGroup}
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
        <Link
          to="/networking-terms"
          className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors py-1"
        >
          Community Terms
        </Link>
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  isSelected,
  onClick,
}: {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group ${
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-secondary/50 text-foreground"
      }`}
    >
      <Hash className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="text-sm flex-1 truncate text-left font-medium">
        {channel.name}
      </span>
      {channel.member_count > 0 && (
        <Badge
          variant="secondary"
          className={`h-5 px-1.5 text-xs ${isSelected ? "bg-primary/20" : ""}`}
        >
          {channel.member_count}
        </Badge>
      )}
    </button>
  );
}

function GroupItem({
  group,
  isSelected,
  onClick,
}: {
  group: UserGroup;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-left group ${
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-secondary/50 text-foreground"
      }`}
      title={`${group.name} - ${group.member_count || 0} members`}
    >
      {group.is_private ? (
        <Lock className="h-3.5 w-3.5 flex-shrink-0" />
      ) : (
        <Hash className="h-3.5 w-3.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block font-medium">
          {group.name}
        </span>
        {group.description && (
          <span className="text-xs text-muted-foreground truncate block">
            {group.description}
          </span>
        )}
      </div>
      {group.member_count > 0 && (
        <Badge 
          variant="secondary" 
          className={`h-5 px-1.5 text-xs flex-shrink-0 ${isSelected ? "bg-primary/20" : ""}`}
        >
          {group.member_count}
        </Badge>
      )}
    </button>
  );
}

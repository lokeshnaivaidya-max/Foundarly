import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Reply, Edit2, Trash2, Heart } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChannelMessage, COLLABORATION_TAGS } from "@/services/networking";
import { useAuth } from "@/contexts/AuthContext";

interface MessageThreadProps {
  message: ChannelMessage;
  replies?: ChannelMessage[];
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  showReplies?: boolean;
}

export default function MessageThread({
  message,
  replies = [],
  onReply,
  onEdit,
  onDelete,
  showReplies = true,
}: MessageThreadProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showAllReplies, setShowAllReplies] = useState(false);

  const isOwner = user?.id === message.user_id;
  const displayedReplies = showAllReplies ? replies : replies.slice(0, 3);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="group">
      <div className="flex gap-3 hover:bg-secondary/30 -mx-2 px-2 py-2 rounded-lg transition-colors">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-sm font-semibold text-primary">
            {message.profiles?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm">
              {message.profiles?.full_name || 'Anonymous'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.created_at)}
            </span>
            {message.is_edited && (
              <span className="text-xs text-muted-foreground italic">(edited)</span>
            )}
            {message.tags && message.tags.length > 0 && (
              <div className="flex gap-1">
                {message.tags.map((tag) => {
                  const tagInfo = COLLABORATION_TAGS.find(t => t.value === tag);
                  return (
                    <Badge key={tag} variant="secondary" className="text-xs h-5">
                      {tagInfo?.icon} {tagInfo?.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[60px] px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap">
              {message.content}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onReply(message.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
            >
              <Heart className="h-3 w-3 mr-1" />
              {message.reactions ? Object.keys(message.reactions).length : 0}
            </Button>
            
            {isOwner && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-3 w-3 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(message.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
              {displayedReplies.map((reply) => (
                <div key={reply.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {reply.profiles?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-semibold text-xs">
                        {reply.profiles?.full_name || 'Anonymous'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(reply.created_at)}
                      </span>
                    </div>
                    <p className="text-xs break-words">{reply.content}</p>
                  </div>
                </div>
              ))}
              
              {replies.length > 3 && !showAllReplies && (
                <button
                  onClick={() => setShowAllReplies(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Show {replies.length - 3} more {replies.length - 3 === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

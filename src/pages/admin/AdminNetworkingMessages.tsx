import { useState, useEffect } from "react";
import { Search, Trash2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminNetworkingService } from "@/services/adminNetworking";
import { toast } from "sonner";

export default function AdminNetworkingMessages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const data = await adminNetworkingService.getAllMessagesAdmin(200);
      setMessages(data);
    } catch (error: any) {
      console.error('Error loading messages in AdminNetworkingMessages:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        fullError: error,
      });
      toast.error(`Failed to load messages: ${error?.message || error?.details || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;

    setSaving(true);
    try {
      await adminNetworkingService.deleteMessageAdmin(selectedMessage.id);
      toast.success("Message deleted successfully");
      setDeleteDialogOpen(false);
      loadMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error("Failed to delete message");
    } finally {
      setSaving(false);
    }
  };

  const filtered = messages.filter((m) =>
    m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.channels?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading messages...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Channel Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">{messages.length} recent messages</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Channel</TableHead>
              <TableHead className="text-xs">Message Preview</TableHead>
              <TableHead className="text-xs">Posted</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((message) => (
              <TableRow key={message.id}>
                <TableCell className="text-sm font-medium">
                  {message.profiles?.full_name || 'Unknown'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    #{message.channels?.name || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {message.content}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(message.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMessage(message);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMessage(message);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View Message Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Message Details</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">User:</span>
                  <p className="font-medium">{selectedMessage.profiles?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Channel:</span>
                  <p className="font-medium">#{selectedMessage.channels?.name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Posted:</span>
                  <p className="font-medium">{new Date(selectedMessage.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Message ID:</span>
                  <p className="font-mono text-xs">{selectedMessage.id.slice(0, 16)}...</p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Content:</span>
                <div className="mt-2 p-4 bg-secondary/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedMessage.content}</p>
                </div>
              </div>
              {selectedMessage.tags && selectedMessage.tags.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm">Tags:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedMessage.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this message and any replies.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

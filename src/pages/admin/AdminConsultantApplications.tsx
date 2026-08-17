import { useState, useEffect } from 'react';
import { Search, Eye, Check, X, UserPlus, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { consultantApplicationsService } from '@/services/consultantApplications';
import { consultantsService } from '@/services/consultants';
import { profilesService } from '@/services/profiles';
import { emailService } from '@/services/email';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type ConsultantApplication = Database['public']['Tables']['consultant_applications']['Row'];

export default function AdminConsultantApplications() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [applications, setApplications] = useState<ConsultantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ConsultantApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const data = await consultantApplicationsService.getAll();
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load applications',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const openView = (app: ConsultantApplication) => {
    setSelectedApp(app);
    setAdminNotes(app.admin_notes || '');
    setViewDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedApp) return;

    setProcessing(true);
    let createdConsultantId: string | null = null;
    try {
      // Step 1: Check if a user account exists with this applicant's email
      let linkedUserId: string | null = null;
      try {
        const userMatch = await profilesService.getByEmail(selectedApp.email);
        if (userMatch?.id) {
          linkedUserId = userMatch.id;
          // Step 2: Update user profile role to 'consultant'
          await profilesService.updateRole(linkedUserId, 'consultant');
        }
      } catch (userErr) {
        console.warn('Could not query or update user profile role:', userErr);
      }

      // Step 3: Insert consultant record in 'consultants' table
      const genderValue = (selectedApp.gender?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female';
      const newConsultant = await consultantsService.create({
        name: selectedApp.name,
        title: selectedApp.current_job || 'Consultant',
        bio: selectedApp.experience || '',
        expertise: ['Consulting', selectedApp.qualification || 'Advisory'].filter(Boolean),
        pricing_30: 1000,
        pricing_60: 1800,
        gender: genderValue,
        is_active: true,
        image_url: null,
        email: selectedApp.email,
        preferred_time: selectedApp.preferred_session_timing || 'Morning (8 AM – 12 PM)',
        user_id: linkedUserId
      } as any);

      if (newConsultant?.id) {
        createdConsultantId = newConsultant.id;
      }

      // Step 4: Update application status in 'consultant_applications' table
      await consultantApplicationsService.update(selectedApp.id, {
        status: 'approved',
        admin_notes: adminNotes
      });

      // Step 5: Send Application Approval Email Notification to the applicant
      try {
        console.log(`[AdminApplications] Sending approval email to ${selectedApp.email}...`);
        const emailResult = await emailService.sendApplicationApproval({
          applicantName: selectedApp.name,
          applicantEmail: selectedApp.email,
          qualification: selectedApp.qualification,
          currentJob: selectedApp.current_job,
          preferredTiming: selectedApp.preferred_session_timing,
          adminNotes: adminNotes || null,
        });

        if (emailResult.success) {
          toast({
            title: 'Application Approved & Email Sent',
            description: `${selectedApp.name} has been approved and a welcome email was sent to ${selectedApp.email}.`
          });
        } else {
          toast({
            title: 'Approved (Email Notice)',
            description: `${selectedApp.name} was approved, but email delivery noted: ${emailResult.error || 'Check Resend key'}`
          });
        }
      } catch (emailErr) {
        console.warn('[AdminApplications] Non-fatal email error on approval:', emailErr);
        toast({
          title: 'Application Approved',
          description: `${selectedApp.name} has been approved and added as a consultant!`
        });
      }

      setViewDialogOpen(false);
      loadApplications();
    } catch (error: any) {
      const logData = {
        action: 'Approve & Create Consultant',
        applicationId: selectedApp.id,
        applicantEmail: selectedApp.email,
        supabaseErrorObject: {
          message: error?.message || 'Unknown error during approval flow',
          code: error?.code || 'UNKNOWN_CODE',
          details: error?.details || null,
          hint: error?.hint || null,
          status: error?.status || null,
          statusText: error?.statusText || null,
          error
        }
      };
      console.error('[Supabase Consultant Approval Failure Log]: Complete Supabase Error Object:', JSON.stringify(logData, null, 2));

      // Rollback created consultant if step 4 failed to prevent duplicate consultants
      if (createdConsultantId) {
        try {
          await consultantsService.delete(createdConsultantId);
          console.info('Rolled back created consultant due to application update failure');
        } catch (rollbackErr) {
          console.error('Failed to rollback created consultant:', rollbackErr);
        }
      }

      toast({
        title: 'Error',
        description: error?.message ? `Failed to approve application: ${error.message}` : 'Failed to approve application',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;

    setProcessing(true);
    try {
      await consultantApplicationsService.update(selectedApp.id, {
        status: 'rejected',
        admin_notes: adminNotes
      });

      // Send Application Rejection Email Notification to the applicant
      try {
        console.log(`[AdminApplications] Sending rejection email to ${selectedApp.email}...`);
        const emailResult = await emailService.sendApplicationRejection({
          applicantName: selectedApp.name,
          applicantEmail: selectedApp.email,
          reason: adminNotes || null,
        });

        if (emailResult.success) {
          toast({
            title: 'Application Rejected & Email Sent',
            description: `Application rejected and notification email sent to ${selectedApp.email}.`
          });
        } else {
          toast({
            title: 'Application Rejected',
            description: `Application rejected. Note on email: ${emailResult.error || 'Check Resend key'}`
          });
        }
      } catch (emailErr) {
        console.warn('[AdminApplications] Non-fatal email error on rejection:', emailErr);
        toast({
          title: 'Application Rejected',
          description: 'Application has been rejected'
        });
      }

      setViewDialogOpen(false);
      loadApplications();
    } catch (error: any) {
      console.error('Error rejecting application:', error?.message || error, {
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        errorObj: error
      });
      toast({
        title: 'Error',
        description: error?.message ? `Failed to reject application: ${error.message}` : 'Failed to reject application',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleResendEmail = async () => {
    if (!selectedApp) return;
    setSendingEmail(true);

    try {
      if (selectedApp.status === 'approved') {
        const res = await emailService.sendApplicationApproval({
          applicantName: selectedApp.name,
          applicantEmail: selectedApp.email,
          qualification: selectedApp.qualification,
          currentJob: selectedApp.current_job,
          preferredTiming: selectedApp.preferred_session_timing,
          adminNotes: adminNotes || selectedApp.admin_notes || null,
        });
        if (res.success) {
          toast({ title: 'Email Sent', description: `Approval email sent to ${selectedApp.email}` });
        } else {
          toast({ title: 'Email Failed', description: res.error || 'Failed to send email', variant: 'destructive' });
        }
      } else if (selectedApp.status === 'rejected') {
        const res = await emailService.sendApplicationRejection({
          applicantName: selectedApp.name,
          applicantEmail: selectedApp.email,
          reason: adminNotes || selectedApp.admin_notes || null,
        });
        if (res.success) {
          toast({ title: 'Email Sent', description: `Rejection email sent to ${selectedApp.email}` });
        } else {
          toast({ title: 'Email Failed', description: res.error || 'Failed to send email', variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to resend email', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;

    try {
      await consultantApplicationsService.delete(id);
      toast({ title: 'Deleted', description: 'Application removed successfully' });
      loadApplications();
    } catch (error: any) {
      console.error('Error deleting application:', error?.message || error, {
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        errorObj: error
      });
      toast({
        title: 'Error',
        description: error?.message ? `Failed to delete application: ${error.message}` : 'Failed to delete application',
        variant: 'destructive'
      });
    }
  };

  const filtered = applications.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading applications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Consultant Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">{applications.length} total applications</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
        >
          All ({applications.length})
        </Button>
        <Button
          variant={filterStatus === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('pending')}
        >
          Pending ({statusCounts.pending})
        </Button>
        <Button
          variant={filterStatus === 'approved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('approved')}
        >
          Approved ({statusCounts.approved})
        </Button>
        <Button
          variant={filterStatus === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('rejected')}
        >
          Rejected ({statusCounts.rejected})
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Applications Table */}
      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-xs">Experience</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Applied</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium text-sm">
                  {app.name}
                  <span className="block text-xs text-muted-foreground">{app.age} yrs, {app.gender}</span>
                </TableCell>
                <TableCell className="text-sm">{app.email}</TableCell>
                <TableCell className="text-sm">{app.location}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{app.current_job}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      app.status === 'approved'
                        ? 'bg-green-500/15 text-green-400 border-green-500/30'
                        : app.status === 'rejected'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                    }`}
                  >
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(app.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => openView(app)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(app.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View/Action Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Application Details</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Review and take action on this consultant application
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-6 py-4">
              {/* Personal Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{selectedApp.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Age</Label>
                    <p className="font-medium">{selectedApp.age} years</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedApp.gender}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{selectedApp.location}</p>
                  </div>
                </div>
              </div>

              {/* Professional Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Professional Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Qualification</Label>
                    <p className="font-medium">{selectedApp.qualification}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Current Job / Business</Label>
                    <p className="font-medium">{selectedApp.current_job}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Experience & Expertise</Label>
                    <p className="font-medium whitespace-pre-wrap">{selectedApp.experience}</p>
                  </div>
                </div>
              </div>

              {/* Preferred Session Timing */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Preferred Session Timing</h3>
                <div className="text-sm">
                  <p className="font-medium">{selectedApp.preferred_session_timing || 'Not specified'}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedApp.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedApp.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">{selectedApp.whatsapp}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">LinkedIn</Label>
                    {selectedApp.linkedin_url ? (
                      <a
                        href={selectedApp.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        View Profile
                      </a>
                    ) : (
                      <p className="font-medium text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this application..."
                  rows={3}
                  className="bg-background"
                />
              </div>

              {/* Current Status */}
              <div className="flex items-center gap-2">
                <Label>Current Status:</Label>
                <Badge
                  variant="outline"
                  className={`${
                    selectedApp.status === 'approved'
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : selectedApp.status === 'rejected'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  }`}
                >
                  {selectedApp.status}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)} disabled={processing || sendingEmail}>
              Close
            </Button>
            {selectedApp?.status !== 'pending' && (
              <Button
                variant="outline"
                onClick={handleResendEmail}
                disabled={sendingEmail || processing}
                className="border-primary/40 text-primary hover:bg-primary/10"
              >
                <Mail className="h-4 w-4 mr-1" />
                {sendingEmail ? 'Sending Email...' : `Resend ${selectedApp?.status === 'approved' ? 'Approval' : 'Rejection'} Email`}
              </Button>
            )}
            {selectedApp?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  className="glow-gold-sm bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {processing ? 'Processing...' : 'Approve & Create Consultant'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

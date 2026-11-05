import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { isAllowedAdminEmail } from '../../src/lib/authorization.js';
import { sendEmail } from '../../src/server/mailer.js';
import {
  generateApplicationApprovedEmailHTML,
  generateApplicationApprovedEmailText,
} from '../../src/utils/emailTemplates.js';

dotenv.config();

interface RequestLike {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyxnshvtfswvaogjzwq.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd';

const supabaseAdminClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // 1. Authenticate Admin
  const authHeader = req.headers?.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  try {
    const { data: { user: adminUser }, error: userError } = await supabaseAdminClient.auth.getUser(token);
    if (userError || !adminUser) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    const adminEmail = (adminUser.email || '').toLowerCase().trim();
    const isAllowlisted = isAllowedAdminEmail(adminEmail);
    const isDevAdmin = adminEmail === 'foundarly@developer.in';
    const isAdmin = isAllowlisted;

    if (!isAdmin && !isDevAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin or Developer Admin authorization required.' });
    }
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const action = body?.action;

    if (action) {
      if (action === 'toggle-active') {
        const consultantId = body?.consultantId;
        const active = body?.active;

        if (typeof active !== 'boolean') {
          return res.status(400).json({ success: false, error: 'Request body must contain explicit boolean `active` value.' });
        }

        if (!consultantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(consultantId)) {
          return res.status(400).json({ success: false, error: 'Valid consultantId (UUID) is required.' });
        }

        // Fetch consultant record to verify existence and current state
        const { data: consultant, error: fetchError } = await supabaseAdminClient
          .from('consultants')
          .select('id, is_active')
          .eq('id', consultantId)
          .single();

        if (fetchError || !consultant) {
          return res.status(404).json({ success: false, error: 'Consultant record not found.' });
        }

        // Update ONLY is_active field - explicitly set from request, not blindly toggle
        const { error: updateError } = await supabaseAdminClient
          .from('consultants')
          .update({ is_active: active })
          .eq('id', consultantId);

        if (updateError) {
          return res.status(500).json({ success: false, error: 'Database error: ' + updateError.message });
        }

        // Verify the persisted value before reporting success
        const { data: verified } = await supabaseAdminClient
          .from('consultants')
          .select('is_active')
          .eq('id', consultantId)
          .single();

        if (!verified || verified.is_active !== active) {
          return res.status(500).json({ success: false, error: 'Verification failed: persisted value mismatch.' });
        }

        return res.json({ success: true, is_active: active, consultantId, previousState: consultant.is_active });
      }

      return res.status(400).json({ success: false, error: `Unsupported action: ${action}.` });
    }

    // 2. Parse request body for consultant application approval (when action is absent)
    const { applicationId, adminNotes, pricing30, pricing60, application: passedApp } = body || {};
    if (!applicationId) {
      return res.status(400).json({ success: false, error: 'applicationId is required.' });
    }

    // Initialize authenticated client using the verified admin bearer token to ensure RLS compliance
    const hasServiceRoleKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 20 &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('publishable')
    );

    const authenticatedClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QPkFtczpj8_WzxPf4ZoENw_ZpnfN9vd', {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const activeDbClient = hasServiceRoleKey ? supabaseAdminClient : authenticatedClient;

    // 3. Fetch application record using authenticated client or passed application data
    let app = passedApp && passedApp.id === applicationId ? passedApp : null;

    if (!app) {
      // First try activeDbClient (authenticated or service role)
      const { data: fetchedApp } = await activeDbClient
        .from('consultant_applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      if (fetchedApp) {
        app = fetchedApp;
      }
    }

    // Secondary fallback: if still not found, check if passedApp matches
    if (!app && passedApp) {
      app = passedApp;
    }

    if (!app) {
      return res.status(404).json({ success: false, error: 'Consultant application not found.' });
    }

    const cleanEmail = (app.email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Applicant record lacks a valid email address.' });
    }

    // 4. Identity Mapping — authoritative only; display-name matching is
    // deliberately NOT used (it linked the wrong account in production).
    // Preference order:
    //   1) user_id captured on the application at submission time (a verified
    //      authenticated account whose email matched the application email)
    //   2) service-role lookup of the auth account owning the application email
    // If neither succeeds, the consultant record is created UNLINKED; the
    // applicant's next authenticated /api/consultant/me call links it by
    // verified email.
    let linkedUserId: string | null =
      typeof app.user_id === 'string' && app.user_id.trim().length > 20 ? app.user_id.trim() : null;

    if (linkedUserId) {
      console.log(`[Approve Consultant] Application carries authenticated user_id; linking by UUID: ${linkedUserId}`);
    } else if (hasServiceRoleKey) {
      try {
        const { data: usersData, error: listUsersErr } = await supabaseAdminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listUsersErr) {
          console.warn('[Approve Consultant] Auth admin user lookup failed:', listUsersErr.message);
        } else {
          // Explicit shape: supabase-js listUsers types resolve differently
          // under Vercel's node16 moduleResolution (users can infer as never[]).
          const users = (usersData as { users?: Array<{ id: string; email?: string | null }> } | null | undefined)?.users;
          const matchedUser = users?.find(
            (u) => (u.email || '').toLowerCase().trim() === cleanEmail
          );
          if (matchedUser?.id) {
            linkedUserId = matchedUser.id;
          }
        }
      } catch (authLookupErr) {
        console.warn('[Approve Consultant] Auth admin user lookup warning:', authLookupErr);
      }
    }

    // 4b. Update the applicant's profile role (never demote admins).
    // The write result is checked explicitly: a silently failed profile update
    // is the exact bug that left approved consultants classified as clients.
    let profileUpdated = false;
    if (linkedUserId) {
      console.log(`[Approve Consultant] Matched applicant ${cleanEmail} to user ID ${linkedUserId}`);

      try {
        const { data: existingProfile } = await activeDbClient
          .from('profiles')
          .select('role')
          .eq('id', linkedUserId)
          .maybeSingle();

        const isApplicantAdmin =
          existingProfile?.role === 'super_admin' ||
          existingProfile?.role === 'admin' ||
          existingProfile?.role === 'developer_admin' ||
          isAllowedAdminEmail(cleanEmail);

        if (!isApplicantAdmin) {
          const { error: profileUpsertErr } = await activeDbClient
            .from('profiles')
            .upsert({
              id: linkedUserId,
              role: 'consultant',
              full_name: app.name,
            });
          if (profileUpsertErr) {
            console.error('[Approve Consultant] FAILED to update applicant profile role:', {
              linkedUserId,
              error: profileUpsertErr?.message || String(profileUpsertErr),
            });
            profileUpdated = false;
          } else {
            profileUpdated = true;
          }
        } else {
          // Admin privileges preserved; profile role left untouched.
          profileUpdated = true;
        }
      } catch (profErr: any) {
        console.error('[Approve Consultant] Profile update exception:', profErr?.message || profErr);
        profileUpdated = false;
      }
    } else {
      console.warn(
        `[Approve Consultant] No authenticated account could be verified for ${cleanEmail}. ` +
          'Consultant record will be created unlinked; it self-links by verified email at sign-in.'
      );
    }

    // 5. Idempotent Consultant Record Creation / Activation
    let consultantQuery = activeDbClient.from('consultants').select('*');
    if (linkedUserId) {
      consultantQuery = consultantQuery.or(`user_id.eq.${linkedUserId},email.ilike.${cleanEmail}`);
    } else {
      consultantQuery = consultantQuery.ilike('email', cleanEmail);
    }

    const { data: existingConsultants } = await consultantQuery.limit(1);
    let consultant = existingConsultants?.[0] || null;

    if (consultant) {
      // Re-approval / renewal: IDENTITY ONLY. Never overwrite reviewed
      // professional content (title/bio/expertise/pricing) with raw
      // application text, and never change publication state — public
      // profile content and is_active are managed explicitly via
      // Manage Consultants.
      console.log(`[Approve Consultant] Updating existing consultant record ${consultant.id} for ${cleanEmail} (identity fields only)`);
      const updateData: Record<string, any> = {
        email: cleanEmail,
      };

      if (linkedUserId) {
        updateData.user_id = linkedUserId;
      }

      const { data: updatedCons, error: updateErr } = await activeDbClient
        .from('consultants')
        .update(updateData)
        .eq('id', consultant.id)
        .select()
        .single();

      if (updateErr || !updatedCons) {
        console.error('[Approve Consultant] Error updating consultant record:', updateErr);
        return res.status(500).json({
          success: false,
          error: `Failed to activate consultant record: ${updateErr?.message || 'unknown error'}`,
        });
      }
      consultant = updatedCons;
    } else {
      // First approval: create a NON-PUBLIC draft record with clean defaults
      // so the account is activated without immediately publishing unreviewed free-text.
      console.log(`[Approve Consultant] Inserting NON-PUBLIC draft consultant record for ${cleanEmail} (linkedUserId: ${linkedUserId})`);
      const { data: newCons, error: insertErr } = await activeDbClient
        .from('consultants')
        .insert({
          name: app.name,
          email: cleanEmail,
          user_id: linkedUserId || null,
          is_active: false,
          title: '',
          bio: '',
          expertise: [],
          pricing_30: 0,
          pricing_60: 0,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[Approve Consultant] Error inserting consultant:', insertErr);
        return res.status(500).json({
          success: false,
          error: `Failed to create consultant record: ${insertErr.message}`,
        });
      }
      consultant = newCons;
    }

    // 6. Update Application Status to 'approved'
    const { error: appUpdateErr } = await activeDbClient
      .from('consultant_applications')
      .update({
        status: 'approved',
        admin_notes: adminNotes || app.admin_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (appUpdateErr) {
      console.error('[Approve Consultant] Error updating application status:', appUpdateErr);
    }

    // 7. Dispatch Approval Email Notification
    const siteUrl = process.env.SITE_URL || process.env.APP_URL || 'https://www.foundarlybusinessworld.in';
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'hello@foundarlybusinessworld.in';
    const replyTo = process.env.EMAIL_REPLY_TO || 'hello@foundarlybusinessworld.in';
    const consultantPortalUrl = `${siteUrl}/consultant/dashboard`;
    const loginUrl = `${siteUrl}/login?from=/consultant/dashboard`;

    let emailSent = false;
    let emailNotice: string | null = null;

    try {
      const emailHtml = generateApplicationApprovedEmailHTML({
        applicantName: app.name,
        applicantEmail: cleanEmail,
        qualification: app.qualification,
        currentJob: app.current_job,
        preferredTiming: app.preferred_session_timing,
        adminNotes: adminNotes || null,
        dashboardUrl: consultantPortalUrl,
      });

      const emailText = generateApplicationApprovedEmailText({
        applicantName: app.name,
        applicantEmail: cleanEmail,
        qualification: app.qualification,
        currentJob: app.current_job,
        preferredTiming: app.preferred_session_timing,
        adminNotes: adminNotes || null,
        dashboardUrl: consultantPortalUrl,
      });

      const mailResult = await sendEmail({
        from: fromEmail,
        to: cleanEmail,
        replyTo,
        subject: 'Foundarly Consultant Application Approved',
        html: emailHtml,
        text: emailText,
      });

      emailSent = mailResult.success;
      if (!mailResult.success) {
        emailNotice = mailResult.error || 'SMTP delivery not completed';
      }
    } catch (mailErr: any) {
      console.warn('[Approve Consultant] Email dispatch notice:', mailErr?.message);
      emailNotice = mailErr?.message || 'Email dispatch failed';
    }

    return res.status(200).json({
      success: true,
      // Approval = ACCOUNT ACTIVATION (profiles.role). The consultant LISTING is
      // created as a non-public draft (is_active: false) and must be reviewed,
      // completed and published explicitly via Manage Consultants.
      message: `${app.name} has been approved. Account activated; consultant listing created as a draft for review and publication.`,
      consultant,
      linkedUserId,
      profileUpdated,
      // Operational visibility: when false, admin-side profile linking and
      // auth-account lookups could not run (missing SUPABASE_SERVICE_ROLE_KEY)
      // and the consultant account will self-link at next verified sign-in.
      serviceRoleConfigured: hasServiceRoleKey,
      emailSent,
      emailNotice,
    });
  } catch (err: any) {
    console.error('[Approve Consultant Endpoint] Unexpected exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'An unexpected error occurred while approving the application.',
    });
  }
}

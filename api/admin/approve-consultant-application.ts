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

    const { data: adminProfile } = await supabaseAdminClient
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .maybeSingle();

    const isAdmin =
      isAllowlisted ||
      adminProfile?.role === 'super_admin' ||
      adminProfile?.role === 'admin' ||
      adminProfile?.role === 'developer_admin';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. Super Admin or Administrator privileges required to approve consultant applications.',
      });
    }

    // 2. Parse request body
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

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

    // 4. Identity Mapping: check if an authenticated user account already exists
    let linkedUserId: string | null = null;
    try {
      if (hasServiceRoleKey) {
        const { data: usersData } = await supabaseAdminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        const matchedUser = usersData?.users?.find(
          (u) => (u.email || '').toLowerCase().trim() === cleanEmail
        );

        if (matchedUser?.id) {
          linkedUserId = matchedUser.id;
        }
      }
    } catch (authLookupErr) {
      console.warn('[Approve Consultant] Auth admin user lookup warning:', authLookupErr);
    }

    // Fallback user matching: check profiles by full_name or consultants by email
    if (!linkedUserId && app.name) {
      try {
        const { data: matchedProfile } = await activeDbClient
          .from('profiles')
          .select('id, full_name, role')
          .ilike('full_name', app.name.trim())
          .limit(1);

        if (matchedProfile?.[0]?.id) {
          linkedUserId = matchedProfile[0].id;
        }
      } catch (pErr) {
        console.warn('[Approve Consultant] Profile name lookup warning:', pErr);
      }
    }

    if (linkedUserId) {
      console.log(`[Approve Consultant] Matched applicant ${cleanEmail} to user ID ${linkedUserId}`);

      // Update profile role to consultant (preserve admin privileges if already admin)
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
          await activeDbClient
            .from('profiles')
            .upsert({
              id: linkedUserId,
              role: 'consultant',
              full_name: app.name,
              is_consultant: true,
            });
        }
      } catch (profErr) {
        console.warn('[Approve Consultant] Profile update notice:', profErr);
      }
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

    const genderValue = (app.gender?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female';
    const parsedPricing30 = Number(pricing30) || 1000;
    const parsedPricing60 = Number(pricing60) || 1800;

    if (consultant) {
      // Re-activate and update existing consultant record
      console.log(`[Approve Consultant] Updating existing consultant record ${consultant.id} for ${cleanEmail}`);
      const updateData: Record<string, any> = {
        name: app.name,
        title: app.current_job || consultant.title || 'Consultant',
        bio: app.experience || consultant.bio || '',
        gender: genderValue,
        is_active: true,
        email: cleanEmail,
        preferred_time: app.preferred_session_timing || consultant.preferred_time || 'Morning (8 AM – 12 PM)',
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

      if (!updateErr && updatedCons) {
        consultant = updatedCons;
      }
    } else {
      // Insert new consultant record
      console.log(`[Approve Consultant] Inserting new consultant record for ${cleanEmail} (linkedUserId: ${linkedUserId})`);
      const { data: newCons, error: insertErr } = await activeDbClient
        .from('consultants')
        .insert({
          name: app.name,
          title: app.current_job || 'Consultant',
          bio: app.experience || '',
          expertise: ['Consulting', app.qualification || 'Advisory'].filter(Boolean),
          pricing_30: parsedPricing30,
          pricing_60: parsedPricing60,
          gender: genderValue,
          is_active: true,
          email: cleanEmail,
          preferred_time: app.preferred_session_timing || 'Morning (8 AM – 12 PM)',
          user_id: linkedUserId || null,
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
      message: `${app.name} has been approved as an active consultant.`,
      consultant,
      linkedUserId,
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

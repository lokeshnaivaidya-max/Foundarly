/**
 * Shared validation for public consultant applications.
 *
 * Used by both the browser form and the serverless API so the request that the
 * backend receives is always normalized, bounded and safe to insert.
 */

export interface ConsultantApplicationInput {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  age: number;
  gender: 'male' | 'female';
  qualification: string;
  current_job: string;
  location: string;
  experience: string;
  preferred_session_timing: string;
  linkedin_url: string | null;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ValidationResult =
  | { valid: true; value: ConsultantApplicationInput }
  | { valid: false; issues: ValidationIssue[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+]?[0-9\s().-]{6,32}$/;
const LINKEDIN_PATTERN = /^https?:\/\/[^\s]+$/i;

const LIMITS = {
  name: 120,
  email: 254,
  phone: 32,
  qualification: 200,
  current_job: 200,
  location: 160,
  experience: 5000,
  preferred_session_timing: 120,
  linkedin_url: 500,
} as const;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function addRequired(
  issues: ValidationIssue[],
  field: string,
  value: string,
  label: string,
  max: number,
  min = 1,
) {
  if (!value) {
    issues.push({ field, message: `${label} is required.` });
    return;
  }
  if (value.length < min) {
    issues.push({ field, message: `${label} is too short.` });
  }
  if (value.length > max) {
    issues.push({ field, message: `${label} must be ${max} characters or fewer.` });
  }
}

/**
 * Normalize and validate an untrusted request body.
 * Unknown fields (including `status`, `admin_notes`, `created_at`) are ignored.
 */
export function normalizeConsultantApplication(raw: unknown): ValidationResult {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const issues: ValidationIssue[] = [];

  const name = truncate(readString(source.name), LIMITS.name);
  const email = truncate(readString(source.email).toLowerCase(), LIMITS.email);
  const phone = truncate(readString(source.phone), LIMITS.phone);
  const whatsappRaw = readString(source.whatsapp);
  const whatsapp = truncate(whatsappRaw || phone, LIMITS.phone);
  const qualification = truncate(readString(source.qualification), LIMITS.qualification);
  const current_job = truncate(readString(source.current_job), LIMITS.current_job);
  const location = truncate(readString(source.location), LIMITS.location);
  const experience = truncate(readString(source.experience), LIMITS.experience);
  const preferred_session_timing = truncate(
    readString(source.preferred_session_timing),
    LIMITS.preferred_session_timing,
  );
  const linkedinRaw = readString(source.linkedin_url);
  const linkedin_url = linkedinRaw ? truncate(linkedinRaw, LIMITS.linkedin_url) : null;

  addRequired(issues, 'name', name, 'Full name', LIMITS.name, 2);
  addRequired(issues, 'email', email, 'Email address', LIMITS.email, 5);
  addRequired(issues, 'phone', phone, 'Phone number', LIMITS.phone, 6);
  addRequired(issues, 'whatsapp', whatsapp, 'WhatsApp number', LIMITS.phone, 6);
  addRequired(issues, 'qualification', qualification, 'Qualification', LIMITS.qualification, 2);
  addRequired(issues, 'current_job', current_job, 'Current job / business', LIMITS.current_job, 2);
  addRequired(issues, 'location', location, 'Location', LIMITS.location, 2);
  addRequired(issues, 'experience', experience, 'Experience & expertise', LIMITS.experience, 10);
  addRequired(
    issues,
    'preferred_session_timing',
    preferred_session_timing,
    'Preferred session timing',
    LIMITS.preferred_session_timing,
    2,
  );

  const hasIssue = (field: string) => issues.some((issue) => issue.field === field);

  if (email && !EMAIL_PATTERN.test(email) && !hasIssue('email')) {
    issues.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (phone && !PHONE_PATTERN.test(phone) && !hasIssue('phone')) {
    issues.push({ field: 'phone', message: 'Enter a valid phone number.' });
  }
  if (whatsapp && !PHONE_PATTERN.test(whatsapp) && !hasIssue('whatsapp')) {
    issues.push({ field: 'whatsapp', message: 'Enter a valid WhatsApp number.' });
  }
  if (linkedin_url && !LINKEDIN_PATTERN.test(linkedin_url) && !hasIssue('linkedin_url')) {
    issues.push({ field: 'linkedin_url', message: 'Enter a valid http(s) LinkedIn URL.' });
  }

  const ageNumber = Number(source.age);
  if (!Number.isFinite(ageNumber) || !Number.isInteger(ageNumber) || ageNumber < 18 || ageNumber > 100) {
    issues.push({ field: 'age', message: 'Age must be a whole number between 18 and 100.' });
  }

  const genderRaw = readString(source.gender).toLowerCase();
  if (genderRaw !== 'male' && genderRaw !== 'female') {
    issues.push({ field: 'gender', message: 'Gender must be either male or female.' });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    value: {
      name,
      email,
      phone,
      whatsapp,
      age: ageNumber,
      gender: genderRaw as 'male' | 'female',
      qualification,
      current_job,
      location,
      experience,
      preferred_session_timing,
      linkedin_url,
    },
  };
}

export function validationErrorMessage(issues: ValidationIssue[]): string {
  if (!issues.length) return 'Please check the application form and try again.';
  if (issues.length === 1) return issues[0].message;
  return issues
    .slice(0, 3)
    .map((issue) => issue.message)
    .join(' ');
}

export function maskApplicationEmail(email?: string | null): string {
  if (!email || typeof email !== 'string') return '[redacted]';
  const clean = email.trim();
  const at = clean.indexOf('@');
  if (at <= 1) return '[redacted]';
  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

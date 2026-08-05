-- Migration to add missing extended profile fields to public.consultants table

ALTER TABLE public.consultants 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'India',
ADD COLUMN IF NOT EXISTS qualification TEXT DEFAULT 'Industry Specialist',
ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT '10+ Years',
ADD COLUMN IF NOT EXISTS preferred_time TEXT DEFAULT 'Mon - Sat (10:00 AM - 6:00 PM)',
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['English', 'Hindi'],
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY['Information Technology'],
ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'Available Today',
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"linkedin": "", "twitter": "", "instagram": "", "youtube": ""}'::jsonb;

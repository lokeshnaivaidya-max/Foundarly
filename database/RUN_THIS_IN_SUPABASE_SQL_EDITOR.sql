-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION: FOLLOW-UP WORKFLOW & RLS POLICIES
-- Execute this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rfyxnshvtfswvaogjzwq/sql
-- ============================================================================

-- 1. Create the follow_up_requests table if it does not exist
CREATE TABLE IF NOT EXISTS public.follow_up_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE CASCADE NOT NULL,
  consultant_name TEXT,
  consultant_email TEXT,
  meeting_room_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  alternative_date DATE,
  alternative_time TEXT,
  consultant_note TEXT,
  confirmed_date DATE,
  confirmed_time TEXT,
  declined_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_consultant' 
    CHECK (status IN ('pending_consultant', 'alternative_proposed', 'confirmed', 'declined', 'completed', 'expired')),
  rejoin_deadline TIMESTAMPTZ NOT NULL,
  client_notified_at TIMESTAMPTZ,
  consultant_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for high performance lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_follow_up_per_booking 
ON public.follow_up_requests(booking_id) 
WHERE status IN ('pending_consultant', 'alternative_proposed', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_follow_up_booking_id ON public.follow_up_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_client_id ON public.follow_up_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_consultant_id ON public.follow_up_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.follow_up_requests(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.follow_up_requests ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Clients can view their follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Clients can request follow up" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Clients can update follow up when alternative proposed" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Consultants can view their follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Consultants can respond to follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Admins can view all follow up requests" ON public.follow_up_requests;
DROP POLICY IF EXISTS "Admins can manage all follow up requests" ON public.follow_up_requests;

-- 4. Client Policies
CREATE POLICY "Clients can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Clients can request follow up" 
ON public.follow_up_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Clients can update follow up when alternative proposed" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(auth.jwt() ->> 'email'))
  )
);

-- 5. Consultant Policies (Direct Consultant Access without Admin bottleneck)
CREATE POLICY "Consultants can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Consultants can respond to follow up requests" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(auth.jwt() ->> 'email'))
  )
);

-- 6. Admin Oversight Policies
CREATE POLICY "Admins can view all follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
  OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
);

CREATE POLICY "Admins can manage all follow up requests" 
ON public.follow_up_requests 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
  OR LOWER(auth.jwt() ->> 'email') = 'admin@foundarly.com'
);

-- 7. Grant Table Permissions
GRANT ALL ON TABLE public.follow_up_requests TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.follow_up_requests TO anon;

-- Verification query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'follow_up_requests'
ORDER BY ordinal_position;

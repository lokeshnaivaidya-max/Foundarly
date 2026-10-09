-- ============================================================================
-- Foundarly Follow-up Scheduling Workflow Migration
-- Consultant-Confirmed Follow-up without Admin Approval
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.follow_up_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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

-- Unique index to prevent duplicate pending/active follow-up requests per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_follow_up_per_booking 
ON public.follow_up_requests(booking_id) 
WHERE status IN ('pending_consultant', 'alternative_proposed', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_follow_up_booking_id ON public.follow_up_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_client_id ON public.follow_up_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_consultant_id ON public.follow_up_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.follow_up_requests(status);

-- Enable RLS
ALTER TABLE public.follow_up_requests ENABLE ROW LEVEL SECURITY;

-- 1. Client can view their own follow-ups
CREATE POLICY "Clients can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR b.email = auth.jwt() ->> 'email')
  )
);

-- 2. Client can insert follow-ups for their own bookings
CREATE POLICY "Clients can request follow up" 
ON public.follow_up_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR b.email = auth.jwt() ->> 'email')
  )
);

-- 3. Client can respond to alternative time proposed by consultant
CREATE POLICY "Clients can update follow up when alternative proposed" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  auth.uid() = client_id OR 
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = follow_up_requests.booking_id AND (b.user_id = auth.uid() OR b.email = auth.jwt() ->> 'email')
  )
);

-- 4. Assigned Consultants can view follow-up requests assigned to them
CREATE POLICY "Consultants can view their follow up requests" 
ON public.follow_up_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id AND (c.user_id = auth.uid() OR c.email = auth.jwt() ->> 'email')
  )
);

-- 5. Assigned Consultants can respond (accept, propose alternative, decline)
CREATE POLICY "Consultants can respond to follow up requests" 
ON public.follow_up_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.consultants c 
    WHERE c.id = follow_up_requests.consultant_id AND (c.user_id = auth.uid() OR c.email = auth.jwt() ->> 'email')
  )
);

-- Comments
COMMENT ON TABLE public.follow_up_requests IS '7-day consultant-confirmed follow-up requests. Direct consultant approval only, no admin intervention required.';

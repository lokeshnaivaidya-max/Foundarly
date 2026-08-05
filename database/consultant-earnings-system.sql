-- Consultant Earnings and Payout System
-- Run this after the main database setup

-- =====================================================
-- 0. ADD USER_ID TO CONSULTANTS TABLE (IF NOT EXISTS)
-- =====================================================

-- Link consultants to user accounts
ALTER TABLE consultants 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_consultants_user_id ON consultants(user_id);

-- =====================================================
-- 1. ADD EARNINGS TRACKING TO BOOKINGS
-- =====================================================

-- Add earnings field to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS consultant_earnings DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'requested', 'processing', 'paid'));

-- =====================================================
-- 2. CREATE PAYOUT REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  payment_method TEXT NOT NULL, -- 'bank_transfer', 'upi', 'paypal', etc.
  payment_details JSONB NOT NULL, -- Store bank details, UPI ID, etc.
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_payout_requests_consultant ON payout_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- =====================================================
-- 3. CREATE EARNINGS HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS consultant_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_consultant_earnings_consultant ON consultant_earnings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_earnings_booking ON consultant_earnings(booking_id);

-- =====================================================
-- 4. ADD RESCHEDULE FIELDS TO BOOKINGS
-- =====================================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reschedule_requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS reschedule_status TEXT DEFAULT 'none' CHECK (reschedule_status IN ('none', 'requested', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS original_date DATE,
ADD COLUMN IF NOT EXISTS original_time TIME,
ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;

-- =====================================================
-- 5. RLS POLICIES FOR PAYOUT REQUESTS
-- =====================================================

-- Enable RLS
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_earnings ENABLE ROW LEVEL SECURITY;

-- Consultants can view their own payout requests
CREATE POLICY "Consultants can view own payout requests"
  ON payout_requests FOR SELECT
  USING (
    consultant_id IN (
      SELECT id FROM consultants WHERE user_id = auth.uid()
    )
  );

-- Consultants can create payout requests
CREATE POLICY "Consultants can create payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (
    consultant_id IN (
      SELECT id FROM consultants WHERE user_id = auth.uid()
    )
  );

-- Admins can view all payout requests
CREATE POLICY "Admins can view all payout requests"
  ON payout_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update payout requests
CREATE POLICY "Admins can update payout requests"
  ON payout_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 6. RLS POLICIES FOR EARNINGS
-- =====================================================

-- Consultants can view their own earnings
CREATE POLICY "Consultants can view own earnings"
  ON consultant_earnings FOR SELECT
  USING (
    consultant_id IN (
      SELECT id FROM consultants WHERE user_id = auth.uid()
    )
  );

-- Admins can view all earnings
CREATE POLICY "Admins can view all earnings"
  ON consultant_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System can insert earnings (via service role)
CREATE POLICY "System can insert earnings"
  ON consultant_earnings FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 7. FUNCTIONS FOR EARNINGS CALCULATION
-- =====================================================

-- Function to calculate consultant earnings when booking is completed
CREATE OR REPLACE FUNCTION calculate_consultant_earnings()
RETURNS TRIGGER AS $$
DECLARE
  consultant_record RECORD;
  total_amount DECIMAL(10,2);
  platform_fee_percent DECIMAL(5,2) := 0.15; -- 15% platform fee
  platform_fee_amount DECIMAL(10,2);
  consultant_net DECIMAL(10,2);
BEGIN
  -- Only process if booking status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get consultant and pricing info
    SELECT c.*, p.price INTO consultant_record
    FROM consultants c
    JOIN pricing p ON c.id = p.consultant_id
    WHERE c.id = NEW.consultant_id
    LIMIT 1;
    
    IF consultant_record IS NOT NULL THEN
      -- Calculate amounts
      total_amount := consultant_record.price;
      platform_fee_amount := total_amount * platform_fee_percent;
      consultant_net := total_amount - platform_fee_amount;
      
      -- Update booking with earnings info
      NEW.consultant_earnings := consultant_net;
      NEW.platform_fee := platform_fee_amount;
      NEW.payout_status := 'pending';
      
      -- Insert into earnings history
      INSERT INTO consultant_earnings (
        consultant_id,
        booking_id,
        amount,
        platform_fee,
        net_amount
      ) VALUES (
        NEW.consultant_id,
        NEW.id,
        total_amount,
        platform_fee_amount,
        consultant_net
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for earnings calculation
DROP TRIGGER IF EXISTS trigger_calculate_earnings ON bookings;
CREATE TRIGGER trigger_calculate_earnings
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_consultant_earnings();

-- =====================================================
-- 8. HELPER VIEWS FOR CONSULTANTS
-- =====================================================

-- View for consultant dashboard stats
-- Note: Ratings will show as NULL until add-review-fields.sql is run
CREATE OR REPLACE VIEW consultant_dashboard_stats AS
SELECT 
  c.id as consultant_id,
  c.user_id,
  c.name as consultant_name,
  COUNT(DISTINCT b.id) as total_bookings,
  COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_sessions,
  COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as upcoming_sessions,
  COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.consultant_earnings END), 0) as total_earnings,
  COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.payout_status = 'pending' THEN b.consultant_earnings END), 0) as pending_earnings,
  COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.payout_status = 'paid' THEN b.consultant_earnings END), 0) as paid_earnings,
  NULL::numeric as average_rating,  -- Will be NULL until testimonials.booking_id exists
  0::bigint as total_reviews        -- Will be 0 until testimonials.booking_id exists
FROM consultants c
LEFT JOIN bookings b ON c.id = b.consultant_id
WHERE c.user_id IS NOT NULL  -- Only include consultants with user accounts
GROUP BY c.id, c.user_id, c.name;

-- =====================================================
-- 9. UPDATE BOOKINGS RLS FOR CONSULTANTS
-- =====================================================

-- Consultants can view their own bookings
DROP POLICY IF EXISTS "Consultants can view own bookings" ON bookings;
CREATE POLICY "Consultants can view own bookings"
  ON bookings FOR SELECT
  USING (
    consultant_id IN (
      SELECT id FROM consultants WHERE user_id = auth.uid()
    )
  );

-- Consultants can update their own bookings (for reschedule)
DROP POLICY IF EXISTS "Consultants can update own bookings" ON bookings;
CREATE POLICY "Consultants can update own bookings"
  ON bookings FOR UPDATE
  USING (
    consultant_id IN (
      SELECT id FROM consultants WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. NOTIFICATION PREFERENCES
-- =====================================================

ALTER TABLE consultants
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"new_booking": true, "reschedule": true, "review": true, "payout": true}'::jsonb;

-- =====================================================
-- SUMMARY
-- =====================================================

-- Tables Created:
-- 1. payout_requests - Track consultant payout requests
-- 2. consultant_earnings - History of all earnings

-- Fields Added to consultants:
-- 1. user_id - Link to auth.users (for consultant login)
-- 2. email_notifications - Email notification preference
-- 3. notification_preferences - Detailed notification settings

-- Fields Added to bookings:
-- 1. consultant_earnings - Amount consultant earns
-- 2. platform_fee - Platform commission
-- 3. payout_status - Payment status
-- 4. reschedule_* - Reschedule tracking fields

-- Views Created:
-- 1. consultant_dashboard_stats - Dashboard metrics

-- Functions Created:
-- 1. calculate_consultant_earnings() - Auto-calculate on completion

-- =====================================================
-- IMPORTANT: LINKING CONSULTANTS TO USER ACCOUNTS
-- =====================================================

-- For existing consultants, you need to link them to user accounts.
-- Option 1: Manual linking (if consultant already has an account)
-- UPDATE consultants SET user_id = 'user-uuid-here' WHERE id = 'consultant-uuid-here';

-- Option 2: When approving consultant applications, create the link
-- After creating consultant from application, update with user_id:
-- UPDATE consultants SET user_id = (SELECT user_id FROM consultant_applications WHERE id = 'app-id') WHERE id = 'new-consultant-id';

-- Option 3: For testing, link a consultant to your test user
-- UPDATE consultants SET user_id = auth.uid() WHERE email = 'your-email@example.com';
-- (Note: You'll need to add email field or use another identifier)

COMMENT ON TABLE payout_requests IS 'Consultant payout requests to admin';
COMMENT ON TABLE consultant_earnings IS 'History of consultant earnings per booking';
COMMENT ON VIEW consultant_dashboard_stats IS 'Dashboard statistics for consultants (ratings will be NULL until add-review-fields.sql is run)';
COMMENT ON COLUMN consultants.user_id IS 'Links consultant to their user account for dashboard access';
